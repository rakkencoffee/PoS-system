import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMemberApiKey } from '@/lib/member-api-guard';

/**
 * GET /api/member/admin/members/:id/pending-pickups
 *
 * MERCHANDISE items are never handed out through checkout (see the
 * MERCHANDISE rejection in POST /api/member/orders) — a member redeems or
 * gets granted one digitally, then has to physically pick it up at the
 * outlet. This lists everything a staff member should be able to hand over
 * right now for one member: AVAILABLE RedeemedReward rows for a
 * MERCHANDISE catalog item, and AVAILABLE ClaimedBenefit rows linked to one
 * (Tier 4 birthday merch — see TierRule.birthdayFreeMerch). Both come from
 * the same RewardsCatalog category but live in different tables (member's
 * own point redemption vs. an automatic tier/birthday grant), so this
 * endpoint merges them into one list for the staff-facing pickup screen.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guardError = requireMemberApiKey(request);
  if (guardError) return guardError;

  const { id: memberId } = await params;

  const [redeemedRewards, claimedBenefits] = await Promise.all([
    prisma.redeemedReward.findMany({
      where: {
        memberId,
        status: 'AVAILABLE',
        rewardsCatalog: { category: 'MERCHANDISE' },
      },
      include: { rewardsCatalog: { select: { name: true } } },
      orderBy: { redeemedAt: 'asc' },
    }),
    prisma.claimedBenefit.findMany({
      where: {
        memberId,
        status: 'AVAILABLE',
        rewardsCatalog: { category: 'MERCHANDISE' },
      },
      include: { rewardsCatalog: { select: { name: true } } },
      orderBy: { availableAt: 'asc' },
    }),
  ]);

  return NextResponse.json({
    redeemedRewards: redeemedRewards.map((r) => ({
      id: r.id,
      source: 'REDEEMED' as const,
      rewardName: r.rewardsCatalog.name,
      availableSince: r.redeemedAt,
      expiresAt: r.expiresAt,
    })),
    claimedBenefits: claimedBenefits.map((b) => ({
      id: b.id,
      source: 'BIRTHDAY_BENEFIT' as const,
      rewardName: b.rewardsCatalog!.name,
      availableSince: b.availableAt,
      expiresAt: b.expiresAt,
    })),
  });
}
