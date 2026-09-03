import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMemberApiKey } from '@/lib/member-api-guard';

/**
 * GET /api/member/rewards
 *
 * Active, currently-valid RewardsCatalog items — what a member browses
 * before calling POST /api/member/:id/redeem. Missed from the original
 * endpoint list (only redeem itself was planned) — added once the Member
 * App frontend needed something to list.
 */
export async function GET(request: NextRequest) {
  const guardError = requireMemberApiKey(request);
  if (guardError) return guardError;

  const now = new Date();
  const rewards = await prisma.rewardsCatalog.findMany({
    where: {
      isActive: true,
      OR: [{ validFrom: null }, { validFrom: { lte: now } }],
      AND: [{ OR: [{ validUntil: null }, { validUntil: { gte: now } }] }],
    },
    orderBy: { pointCost: 'asc' },
  });

  return NextResponse.json(rewards);
}
