import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMemberApiKey } from '@/lib/member-api-guard';
import { getLoyaltyConfig } from '@/lib/loyalty';

/**
 * GET /api/member/admin/config — all TierRule rows + the LoyaltyConfig singleton.
 * PUT /api/member/admin/config — upsert either or both.
 *
 * Body (PUT): {
 *   tierRules?: [{ level, name, minSpend, upgradeVoucherPercent, birthdayPointMultiplier, weeklyDiscountPercent }],
 *   loyaltyConfig?: { pointRatePerRupiah?, pointExpiryMonths?, tierPeriodDays?, tierUpgradeClaimWindowDays?, weeklyMemberDayOfWeek? }
 * }
 */
export async function GET(request: NextRequest) {
  const guardError = requireMemberApiKey(request);
  if (guardError) return guardError;

  const [tierRules, loyaltyConfig] = await Promise.all([
    prisma.tierRule.findMany({ orderBy: { level: 'asc' } }),
    prisma.$transaction((tx) => getLoyaltyConfig(tx)),
  ]);

  return NextResponse.json({ tierRules, loyaltyConfig });
}

export async function PUT(request: NextRequest) {
  const guardError = requireMemberApiKey(request);
  if (guardError) return guardError;

  const { tierRules, loyaltyConfig } = await request.json();

  if (Array.isArray(tierRules)) {
    await prisma.$transaction(
      tierRules.map((rule: any) =>
        prisma.tierRule.upsert({
          where: { level: rule.level },
          create: rule,
          update: rule,
        })
      )
    );
  }

  if (loyaltyConfig && typeof loyaltyConfig === 'object') {
    await prisma.loyaltyConfig.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', ...loyaltyConfig },
      update: loyaltyConfig,
    });
  }

  const [updatedTierRules, updatedLoyaltyConfig] = await Promise.all([
    prisma.tierRule.findMany({ orderBy: { level: 'asc' } }),
    prisma.$transaction((tx) => getLoyaltyConfig(tx)),
  ]);

  return NextResponse.json({ tierRules: updatedTierRules, loyaltyConfig: updatedLoyaltyConfig });
}
