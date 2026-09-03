import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

/**
 * LoyaltyConfig is a singleton (id="singleton") — lazily created on first
 * read with schema defaults, so no separate seed script is needed.
 */
export async function getLoyaltyConfig(tx: Tx) {
  return tx.loyaltyConfig.upsert({
    where: { id: 'singleton' },
    create: {},
    update: {},
  });
}

/**
 * Records a paid order's points + tier effect for a member: writes a
 * PointLedger EARN entry and updates Member's cache columns. Must run
 * inside the same $transaction as whatever marks the order PAID, so the
 * ledger and the cache never drift apart.
 *
 * Tier rule (PRD Bab 5.2): within a period, tier only ever goes UP (locked
 * even if the member stops spending). At period rollover (tierPeriodDays
 * since tierPeriodStart), tierPeriodSpend resets to 0 and tier is
 * recalculated fresh from the new period's spend — which can come out
 * lower than before.
 */
export async function applyEarnedPoints(
  tx: Tx,
  memberId: string,
  orderTotal: number,
  orderId: string
): Promise<{ pointsEarned: number; tierLevel: number }> {
  const [config, member] = await Promise.all([
    getLoyaltyConfig(tx),
    tx.member.findUniqueOrThrow({ where: { id: memberId } }),
  ]);

  const now = new Date();
  const periodExpired =
    now.getTime() - member.tierPeriodStart.getTime() >= config.tierPeriodDays * 24 * 60 * 60 * 1000;

  let tierPeriodStart = member.tierPeriodStart;
  let tierPeriodSpend = member.tierPeriodSpend;
  let tierLevel = member.tierLevel;

  if (periodExpired) {
    tierPeriodStart = now;
    tierPeriodSpend = 0;
  }
  tierPeriodSpend += orderTotal;

  const tierRules = await tx.tierRule.findMany({ orderBy: { level: 'desc' } });
  const qualifiedTier = tierRules.find((rule) => tierPeriodSpend >= rule.minSpend);
  if (qualifiedTier) {
    tierLevel = periodExpired ? qualifiedTier.level : Math.max(tierLevel, qualifiedTier.level);
  }

  const pointsEarned = Math.floor(orderTotal * config.pointRatePerRupiah);

  await tx.pointLedger.create({
    data: { memberId, type: 'EARN', amount: pointsEarned, orderId, note: 'Order settlement' },
  });

  await tx.member.update({
    where: { id: memberId },
    data: {
      pointBalance: { increment: pointsEarned },
      tierPeriodStart,
      tierPeriodSpend,
      tierLevel,
      lastTransactionAt: now,
    },
  });

  return { pointsEarned, tierLevel };
}
