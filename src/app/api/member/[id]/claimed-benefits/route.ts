import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMemberApiKey } from '@/lib/member-api-guard';

/**
 * GET /api/member/:id/claimed-benefits
 *
 * List of AVAILABLE ClaimedBenefit rows for the Klaim Benefit page (see
 * project_rakken_loyalty_app memory for the 3-card spec: TIER_UPGRADE,
 * BIRTHDAY, WEEKLY_MEMBER_DAY). Percentages are looked up LIVE from
 * TierRule (not stored on the benefit row itself) so an admin changing the
 * config later is reflected immediately — same principle as elsewhere in
 * this loyalty system.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guardError = requireMemberApiKey(request);
  if (guardError) return guardError;

  const { id: memberId } = await params;

  const member = await prisma.member.findUnique({ where: { id: memberId }, select: { tierLevel: true } });
  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  const [benefits, tierRules] = await Promise.all([
    prisma.claimedBenefit.findMany({
      where: { memberId, status: 'AVAILABLE' },
      orderBy: { createdAt: 'desc' },
      include: { rewardsCatalog: { select: { name: true, category: true } } },
    }),
    prisma.tierRule.findMany(),
  ]);

  const tierRuleByLevel = new Map(tierRules.map((r) => [r.level, r]));
  const currentTierRule = tierRuleByLevel.get(member.tierLevel);

  const result = benefits.map((benefit) => {
    const base = {
      id: benefit.id,
      type: benefit.type,
      expiresAt: benefit.expiresAt,
    };

    if (benefit.type === 'TIER_UPGRADE') {
      const rule = benefit.tierLevelReached ? tierRuleByLevel.get(benefit.tierLevelReached) : undefined;
      return { ...base, tierName: rule?.name, upgradeVoucherPercent: rule?.upgradeVoucherPercent };
    }

    if (benefit.type === 'WEEKLY_MEMBER_DAY') {
      return { ...base, weeklyDiscountPercent: currentTierRule?.weeklyDiscountPercent };
    }

    // BIRTHDAY — null rewardsCatalogId means the "cheapest beverage in cart" perk.
    return {
      ...base,
      rewardsCatalogId: benefit.rewardsCatalogId,
      rewardsCatalogName: benefit.rewardsCatalog?.name,
      rewardsCatalogCategory: benefit.rewardsCatalog?.category,
    };
  });

  return NextResponse.json(result);
}
