import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMemberApiKey } from '@/lib/member-api-guard';
import { applyEarnedPoints } from '@/lib/loyalty';
import { sendPushToMember } from '@/lib/push';

/**
 * POST /api/member/orders/:id/simulate-pay
 *
 * Placeholder payment (PRD Bab 13 — real gateway not chosen yet). Reuses
 * pos.adapter.updateOrderPaymentStatus(), the same settlement path the
 * kiosk uses, then writes the member's PointLedger EARN entry and updates
 * their tier cache in one transaction so the ledger and cache can't drift.
 *
 * Body: {} — the settlement amount is always the order's own `total` in the
 * database (set when the order was created), never trusted from the client.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guardError = requireMemberApiKey(request);
  if (guardError) return guardError;

  const { id: orderId } = await params;

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.channel !== 'MEMBER_APP' || !order.memberId) {
    return NextResponse.json({ error: 'Member order not found' }, { status: 404 });
  }
  if (!order.total || order.total <= 0) {
    return NextResponse.json({ error: 'Order has no valid total to settle' }, { status: 400 });
  }
  const totalAmount = order.total;

  try {
    const posAdapter = await import('@/lib/integrations/pos.adapter');
    await posAdapter.updateOrderPaymentStatus(orderId, 'paid', totalAmount, 'system_simulated');

    const { pointsEarned, tierLevel, tierUpgradedTo } = await prisma.$transaction((tx) =>
      applyEarnedPoints(tx, order.memberId!, totalAmount, orderId)
    );
    if (tierUpgradedTo) {
      await sendPushToMember(order.memberId, {
        title: 'Selamat, tier kamu naik!',
        body: `Kamu sekarang ${tierUpgradedTo}. Cek benefit barumu di app.`,
      });
    }

    return NextResponse.json({ status: 'paid', pointsEarned, tierLevel });
  } catch (err) {
    console.error('[Member Simulate-Pay] Failed to settle order:', err);
    return NextResponse.json({ error: 'Failed to settle payment' }, { status: 500 });
  }
}
