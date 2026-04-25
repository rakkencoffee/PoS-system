import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { pusherServer } from '@/lib/pusher';

/**
 * Olsera Webhook Receiver
 * 
 * Path: /api/webhooks/olsera
 * Function: Receives real-time updates for products, stock, and orders.
 */

export async function POST(req: Request) {
  const timestamp = new Date().toISOString();
  
  try {
    const headers = Object.fromEntries(req.headers.entries());
    const body = await req.json().catch(() => ({}));

    console.log(`[Olsera Webhook] [${timestamp}] Received event`);
    const event = headers['x-olsera-event'] || body.flag_webhook || body.event;

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

        // 1. Update local database
        try {
          await prisma.order.update({
            where: { id: localOrderId },
            data: { status: newStatus }
          });
          console.log(`[Olsera Webhook] Local order ${localOrderId} synced to ${newStatus}`);
        } catch (dbErr) {
          console.warn(`[Olsera Webhook] Order ${localOrderId} not found in local DB, skipping sync.`);
        }

        // 2. Broadcast to Kitchen (KDS)
        await pusherServer.trigger('kitchen', 'ORDER_UPDATED', {
          orderId: localOrderId,
          status: newStatus
        });

        // 3. Broadcast to Admin Reports
        await pusherServer.trigger('admin-reports', 'SALES_UPDATED', {
          orderId: localOrderId,
          status: newStatus
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
