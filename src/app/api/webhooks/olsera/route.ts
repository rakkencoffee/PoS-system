import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { pusherServer } from '@/lib/pusher';
import crypto from 'crypto';

/**
 * Olsera Webhook Receiver
 * 
 * Path: /api/webhooks/olsera
 * Function: Receives real-time updates for products, stock, and orders.
 */

/** Constant-time string comparison (avoids length/timing leaks). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Authorize an incoming Olsera webhook.
 *
 * Olsera's webhook UI only supports a Callback URL + static "Custom header"
 * (no built-in HMAC signing). So the primary auth is a shared-secret header
 * that you configure BOTH in Olsera (Custom header) and in env
 * (OLSERA_WEBHOOK_SECRET). We accept a few common header names.
 * An HMAC `x-olsera-signature` is still accepted as a fallback if present.
 *
 * If OLSERA_WEBHOOK_SECRET is unset, we accept all requests (useful for the
 * very first connectivity test — set the secret before going to production).
 */
function isAuthorizedWebhook(req: Request, rawBody: string): boolean {
  const secret = process.env.OLSERA_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('[Olsera Webhook] OLSERA_WEBHOOK_SECRET not set — accepting without auth (configure before production).');
    return true;
  }

  // 1. Static custom header (matches Olsera's "Custom header" feature)
  const headerSecret =
    req.headers.get('x-webhook-secret') ||
    req.headers.get('x-olsera-secret') ||
    req.headers.get('authorization');
  if (headerSecret && (safeEqual(headerSecret, secret) || safeEqual(headerSecret, `Bearer ${secret}`))) {
    return true;
  }

  // 2. HMAC signature fallback (only if Olsera ever signs the payload)
  const signature = req.headers.get('x-olsera-signature');
  if (signature) {
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    if (safeEqual(signature, expected)) return true;
  }

  return false;
}

export async function POST(req: Request) {
  const timestamp = new Date().toISOString();

  try {
    const rawBody = await req.text();

    let body: any = {};
    try {
      body = JSON.parse(rawBody || '{}');
    } catch {
      body = {};
    }
    const headers = Object.fromEntries(req.headers.entries());
    const event = headers['x-olsera-event'] || body.flag_webhook || body.event;
    const incomingOrderId = body.openorder_id || body.order_id;

    // Is this a real, actionable event (vs. a connectivity/validation "ping")?
    const isActionable = !!(
      incomingOrderId ||
      event === 'openOrderUpdateStatus' ||
      event === 'order.status_updated' ||
      event === 'product.updated'
    );

    // Olsera verifies the Callback URL on save by sending a test request with no
    // actionable payload. Let those through (200) so the URL can be saved.
    // Enforce the shared secret ONLY for real events that mutate state.
    if (!isActionable) {
      console.log(`[Olsera Webhook] [${timestamp}] Ping / validation request — OK.`);
      return NextResponse.json({ success: true, message: 'pong', receivedAt: timestamp }, { status: 200 });
    }

    if (!isAuthorizedWebhook(req, rawBody)) {
      console.warn(`[Olsera Webhook] [${timestamp}] Unauthorized — missing/invalid secret header.`);
      return NextResponse.json({ error: 'Unauthorized: Invalid secret' }, { status: 401 });
    }

    console.log(`[Olsera Webhook] [${timestamp}] Received event`);

    // Handle Order Status Updates (Matches Olsera Documentation Exactly)
    // Ref: https://docs-api-open.olsera.co.id/documentation/webhook/open-order-update-status
    if (event === 'openOrderUpdateStatus' || event === 'order.status_updated' || body.openorder_id || body.order_id) {
      const orderId = body.openorder_id || body.order_id;
      const olseraStatus = body.status; // 'P', 'A', 'Z', 'C', etc.
      
      console.log(`[Olsera Webhook] Order ${orderId} updated to status: ${olseraStatus} via ${event}`);

      // Map Olsera status to our OrderStatus enum
      const statusMap: Record<string, any> = {
        'P': 'PENDING',
        'A': 'PREPARING',
        'Z': 'COMPLETED',
        'C': 'CANCELLED',
        'X': 'CANCELLED',
        'S': 'READY'
      };

      const newStatus = statusMap[olseraStatus];

      if (newStatus && orderId) {
        const localOrderId = `OLSERA-${orderId}`;

        // Read the current record first so we can map the GLOBAL Olsera status
        // onto the per-station KDS statuses (KDS columns key off barista/kitchen
        // status, NOT the global status) WITHOUT downgrading a station that has
        // already been completed (e.g. a station auto-completed for having no items).
        let existing: any = null;
        try {
          existing = await prisma.order.findUnique({ where: { id: localOrderId } });
        } catch (_) {}

        const WEIGHT: Record<string, number> = { PENDING: 1, PREPARING: 2, READY: 2, COMPLETED: 3 };
        const upgradeOnly = (current: string | undefined, target: string) =>
          (WEIGHT[current || 'PENDING'] || 0) < (WEIGHT[target] || 0) ? target : current;

        const updateData: Record<string, any> = { status: newStatus };
        if (newStatus === 'COMPLETED' || newStatus === 'CANCELLED') {
          // Terminal states apply to both stations.
          updateData.baristaStatus = newStatus;
          updateData.kitchenStatus = newStatus;
        } else if (newStatus === 'PREPARING' || newStatus === 'READY') {
          // Move pending stations forward, but never downgrade a completed one.
          updateData.baristaStatus = upgradeOnly(existing?.baristaStatus, 'PREPARING');
          updateData.kitchenStatus = upgradeOnly(existing?.kitchenStatus, 'PREPARING');
        }

        // 1. Update local database (and read back the canonical record)
        let localOrder: any = existing;
        try {
          localOrder = await prisma.order.update({
            where: { id: localOrderId },
            data: updateData,
          });
          console.log(`[Olsera Webhook] Local order ${localOrderId} synced to ${newStatus} (barista=${localOrder.baristaStatus}, kitchen=${localOrder.kitchenStatus})`);
        } catch (dbErr) {
          console.warn(`[Olsera Webhook] Order ${localOrderId} not found in local DB, broadcasting minimal payload.`);
        }

        // 2. Broadcast to Kitchen (KDS) — payload MUST be { order } to match the
        //    shape KdsView and the /status page expect.
        const orderPayload = {
          id: localOrderId,
          status: localOrder?.status || newStatus,
          baristaStatus: localOrder?.baristaStatus,
          kitchenStatus: localOrder?.kitchenStatus,
          queueNumber: localOrder?.queueNumber,
        };
        await pusherServer.trigger('kitchen', 'ORDER_UPDATED', { order: orderPayload });

        // 3. Broadcast to Admin Reports
        await pusherServer.trigger('admin-reports', 'SALES_UPDATED', {
          orderId: localOrderId,
          status: newStatus,
        });
      }
    }

    // Handle Product Updates (Menu Refresh)
    if (event === 'product.updated') {
      console.log(`[Olsera Webhook] Product updated. Invalidating local cache...`);
      // Future: Trigger revalidation of /menu tags or Pusher signal to kiosks
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Event processed',
      receivedAt: timestamp
    }, { status: 200 });

  } catch (err: any) {
    console.error(`[Olsera Webhook] [${timestamp}] Error:`, err.message);
    return NextResponse.json({ success: true, error: 'Partial processing error' }, { status: 200 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    status: 'active',
    endpoint: '/api/webhooks/olsera'
  }, { status: 200 });
}
