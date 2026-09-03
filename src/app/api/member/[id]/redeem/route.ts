import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMemberApiKey } from '@/lib/member-api-guard';

/**
 * POST /api/member/:id/redeem
 *
 * Body: { rewardId }
 *
 * Deducts Poin Reward, writes the PointLedger REDEEM entry, and increments
 * RewardsCatalog.timesRedeemed (checked against stockQuota).
 *
 * DECISION (2026-09-03): redemption does NOT create a separate Olsera
 * "Discount Voucher" — olsera.service.ts has no voucher-creation function,
 * and guessing its request shape risked writing bad data to the real
 * Olsera account. Instead, a redeemed VOUCHER-category reward is meant to
 * be applied as a plain discountAmount on the member's next order via
 * POST /api/member/orders, which already threads discountAmount/voucherCode
 * straight into pos.adapter.createOrder() (the same mechanism the kiosk's
 * own hardcoded voucher codes use) — so the discount still lands on the
 * real Olsera order, just not as a separate Voucher entity.
 *
 * NOT YET DESIGNED: there is no structured "this member has an unused
 * redeemed voucher worth Rp X" state anywhere — this endpoint only spends
 * the points. Wiring redemption through to an actual checkout discount is
 * a separate open question, tracked in docs/reference/LOYALTY-MEMBER-APP.md,
 * not solved here.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guardError = requireMemberApiKey(request);
  if (guardError) return guardError;

  const { id: memberId } = await params;
  const { rewardId } = await request.json();

  if (!rewardId) {
    return NextResponse.json({ error: 'rewardId is required' }, { status: 400 });
  }

  const [member, reward] = await Promise.all([
    prisma.member.findUnique({ where: { id: memberId } }),
    prisma.rewardsCatalog.findUnique({ where: { id: rewardId } }),
  ]);

  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }
  if (!reward || !reward.isActive) {
    return NextResponse.json({ error: 'Reward not found or inactive' }, { status: 404 });
  }
  const now = new Date();
  if (reward.validFrom && now < reward.validFrom) {
    return NextResponse.json({ error: 'Reward not available yet' }, { status: 400 });
  }
  if (reward.validUntil && now > reward.validUntil) {
    return NextResponse.json({ error: 'Reward has expired' }, { status: 400 });
  }
  if (reward.stockQuota !== null && reward.timesRedeemed >= reward.stockQuota) {
    return NextResponse.json({ error: 'Reward is out of stock' }, { status: 409 });
  }
  if (member.pointBalance < reward.pointCost) {
    return NextResponse.json({ error: 'Insufficient points' }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Conditional updates (WHERE still-in-stock / still-enough-points) so a
      // concurrent redemption can't oversell stock or overdraw the balance —
      // count === 0 means another request beat this one, roll back via throw.
      if (reward.stockQuota !== null) {
        const stockUpdate = await tx.rewardsCatalog.updateMany({
          where: { id: rewardId, timesRedeemed: { lt: reward.stockQuota } },
          data: { timesRedeemed: { increment: 1 } },
        });
        if (stockUpdate.count === 0) throw new Error('OUT_OF_STOCK');
      } else {
        await tx.rewardsCatalog.update({
          where: { id: rewardId },
          data: { timesRedeemed: { increment: 1 } },
        });
      }

      const balanceUpdate = await tx.member.updateMany({
        where: { id: memberId, pointBalance: { gte: reward.pointCost } },
        data: { pointBalance: { decrement: reward.pointCost } },
      });
      if (balanceUpdate.count === 0) throw new Error('INSUFFICIENT_POINTS');

      await tx.pointLedger.create({
        data: { memberId, type: 'REDEEM', amount: -reward.pointCost, note: `Redeem: ${reward.name}` },
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'OUT_OF_STOCK') {
      return NextResponse.json({ error: 'Reward is out of stock' }, { status: 409 });
    }
    if (err instanceof Error && err.message === 'INSUFFICIENT_POINTS') {
      return NextResponse.json({ error: 'Insufficient points' }, { status: 400 });
    }
    console.error('[Member Redeem] Failed to redeem reward:', err);
    return NextResponse.json({ error: 'Failed to redeem reward' }, { status: 500 });
  }

  return NextResponse.json({
    status: 'redeemed',
    reward: { id: reward.id, name: reward.name, category: reward.category },
  });
}
