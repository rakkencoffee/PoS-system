import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyCallbackSignature } from '@/lib/integrations/tripay.service';
import { applyEarnedPoints } from '@/lib/loyalty';
import { sendPushToMember } from '@/lib/push';

/**
 * Tripay Webhook Receiver
 *
 * Path: /api/webhooks/tripay
 * Settles a Member App order once Tripay confirms the QRIS payment. Reuses
 * the same posAdapter.updateOrderPaymentStatus() + applyEarnedPoints() path
 * as /api/member/orders/:id/simulate-pay (see that file) — the pipeline
 * that already fires print/point logic on settlement doesn't need to know
 * how the order got paid.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();

  if (!verifyCallbackSignature(rawBody, req.headers.get('x-callback-signature'))) {
    console.error('[Tripay Webhook] Invalid or missing signature — rejecting.');
    return NextResponse.json({ success: false }, { status: 403 });
  }

  const body = JSON.parse(rawBody || '{}');
  const { merchant_ref: orderId, status, total_amount: totalAmount } = body;

  if (status !== 'PAID') {
    // UNPAID / EXPIRED / FAILED — nothing to settle, just acknowledge.
    return NextResponse.json({ success: true });
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.channel !== 'MEMBER_APP' || !order.memberId) {
    console.error(`[Tripay Webhook] Order ${orderId} not found or not a Member App order.`);
    return NextResponse.json({ success: false }, { status: 404 });
  }
  if (order.status !== 'PENDING') {
    // Already settled (e.g. a retried callback) — acknowledge without re-applying points.
    return NextResponse.json({ success: true });
  }

  try {
    const posAdapter = await import('@/lib/integrations/pos.adapter');
    await posAdapter.updateOrderPaymentStatus(orderId, 'paid', totalAmount, 'tripay_webhook');

    const { tierUpgradedTo } = await prisma.$transaction((tx) =>
      applyEarnedPoints(tx, order.memberId!, totalAmount, orderId)
    );
    if (tierUpgradedTo) {
      await sendPushToMember(order.memberId, {
        title: 'Selamat, tier kamu naik!',
        body: `Kamu sekarang ${tierUpgradedTo}. Cek benefit barumu di app.`,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(`[Tripay Webhook] Failed to settle order ${orderId}:`, err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
