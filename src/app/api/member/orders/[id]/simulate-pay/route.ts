import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMemberApiKey } from '@/lib/member-api-guard';
import { applyEarnedPoints } from '@/lib/loyalty';

/**
 * POST /api/member/orders/:id/simulate-pay
 *
 * Placeholder payment (PRD Bab 13 — real gateway not chosen yet). Reuses
 * pos.adapter.updateOrderPaymentStatus(), the same settlement path the
 * kiosk uses, then writes the member's PointLedger EARN entry and updates
 * their tier cache in one transaction so the ledger and cache can't drift.
 *
 * Body: { totalAmount } — trusted from the client the same way the kiosk's
 * /api/payment/create already does (see docs/reference/LOYALTY-MEMBER-APP.md).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guardError = requireMemberApiKey(request);
  if (guardError) return guardError;

  const { id: orderId } = await params;
  const { totalAmount } = await request.json();

  if (typeof totalAmount !== 'number' || totalAmount <= 0) {
    return NextResponse.json({ error: 'totalAmount is required' }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.channel !== 'MEMBER_APP' || !order.memberId) {
    return NextResponse.json({ error: 'Member order not found' }, { status: 404 });
  }

  try {
    const posAdapter = await import('@/lib/integrations/pos.adapter');
    await posAdapter.updateOrderPaymentStatus(orderId, 'paid', totalAmount, 'system_simulated');

    const { pointsEarned, tierLevel } = await prisma.$transaction((tx) =>
      applyEarnedPoints(tx, order.memberId!, totalAmount, orderId)
    );

    return NextResponse.json({ status: 'paid', pointsEarned, tierLevel });
  } catch (err) {
    console.error('[Member Simulate-Pay] Failed to settle order:', err);
    return NextResponse.json({ error: 'Failed to settle payment' }, { status: 500 });
  }
}
