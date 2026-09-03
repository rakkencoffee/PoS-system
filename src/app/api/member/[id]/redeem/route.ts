import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMemberApiKey } from '@/lib/member-api-guard';

/**
 * POST /api/member/:id/redeem
 *
 * Body: { rewardId }
 *
 * Deducts Poin Reward and writes the PointLedger REDEEM entry — this part
 * is fully implemented. Issuing a real Olsera Discount Voucher (PRD Bab 6)
 * is NOT implemented yet: olsera.service.ts has no voucher-creation
 * function, and guessing its request shape risks writing bad data to the
 * real Olsera account, so it's left as a tracked TODO
 * (docs/reference/LOYALTY-MEMBER-APP.md) instead of a guess.
 *
 * stockQuota on RewardsCatalog is also not enforced yet — there's no
 * counter tracking how many times a reward has been redeemed.
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
  if (member.pointBalance < reward.pointCost) {
    return NextResponse.json({ error: 'Insufficient points' }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.pointLedger.create({
      data: {
        memberId,
        type: 'REDEEM',
        amount: -reward.pointCost,
        note: `Redeem: ${reward.name}`,
      },
    }),
    prisma.member.update({
      where: { id: memberId },
      data: { pointBalance: { decrement: reward.pointCost } },
    }),
  ]);

  return NextResponse.json({
    status: 'redeemed',
    reward: { id: reward.id, name: reward.name, category: reward.category },
    voucherIssued: false, // see function docblock — Olsera voucher issuance not implemented yet
  });
}
