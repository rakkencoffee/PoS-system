import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMemberApiKey } from '@/lib/member-api-guard';

/**
 * GET /api/member/:id/redeemed-rewards
 *
 * AVAILABLE redeemed rewards for the checkout picker. MERCHANDISE is
 * excluded — those are claimed physically at the outlet, never through
 * checkout (see POST /api/member/orders for the category split).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guardError = requireMemberApiKey(request);
  if (guardError) return guardError;

  const { id: memberId } = await params;

  const rewards = await prisma.redeemedReward.findMany({
    where: {
      memberId,
      status: 'AVAILABLE',
      expiresAt: { gt: new Date() },
      rewardsCatalog: { category: { in: ['VOUCHER', 'FREE_ITEM'] } },
    },
    orderBy: { redeemedAt: 'desc' },
    include: { rewardsCatalog: true },
  });

  return NextResponse.json(
    rewards.map((r) => ({
      id: r.id,
      expiresAt: r.expiresAt,
      rewardName: r.rewardsCatalog.name,
      category: r.rewardsCatalog.category,
      discountType: r.rewardsCatalog.discountType,
      discountValue: r.rewardsCatalog.discountValue,
    }))
  );
}
