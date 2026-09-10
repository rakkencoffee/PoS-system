import { prisma } from '@/lib/db';
import { sendPushToMember, sendPushToMembers } from '@/lib/push';

/**
 * Daily loyalty evaluation — birthday benefits + Hari Member (weekly
 * discount day) + expiring stale AVAILABLE rewards/benefits. The first two
 * need a cron because neither has an order to hook into (unlike
 * TIER_UPGRADE, which fires event-driven from applyEarnedPoints() in
 * loyalty.ts). Triggered by a native Vercel Cron Job (see vercel.json) —
 * moved off QStash 2026-09-10, see /api/jobs/evaluate-loyalty for why.
 *
 * All date math is done in WIB (UTC+7), matching the convention already
 * used for queue numbers (see src/lib/queue-number.ts) — this project has
 * no members outside Indonesia, so a fixed +7h offset is enough, no need
 * for a real timezone library.
 */

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** A Date whose UTC getters read as WIB wall-clock fields. */
function nowAsWIBFields(): Date {
  return new Date(Date.now() + WIB_OFFSET_MS);
}

/** Converts a Date built from WIB wall-clock fields back to a real UTC instant. */
function wibFieldsToUTC(wibFields: Date): Date {
  return new Date(wibFields.getTime() - WIB_OFFSET_MS);
}

function endOfWIBDay(wibNow: Date): Date {
  return wibFieldsToUTC(
    new Date(Date.UTC(wibNow.getUTCFullYear(), wibNow.getUTCMonth(), wibNow.getUTCDate(), 23, 59, 59))
  );
}

function startOfWIBDay(wibNow: Date): Date {
  return wibFieldsToUTC(new Date(Date.UTC(wibNow.getUTCFullYear(), wibNow.getUTCMonth(), wibNow.getUTCDate())));
}

function endOfWIBMonth(wibNow: Date): Date {
  // Day 0 of next month = last day of this month.
  return wibFieldsToUTC(
    new Date(Date.UTC(wibNow.getUTCFullYear(), wibNow.getUTCMonth() + 1, 0, 23, 59, 59))
  );
}

async function evaluateBirthdays(wibNow: Date) {
  const todayMonth = wibNow.getUTCMonth() + 1;
  const todayDay = wibNow.getUTCDate();

  const members = await prisma.member.findMany({ select: { id: true, birthDate: true, tierLevel: true } });
  const birthdayMembers = members.filter(
    (m) => m.birthDate.getUTCMonth() + 1 === todayMonth && m.birthDate.getUTCDate() === todayDay
  );
  if (birthdayMembers.length === 0) return 0;

  const tierRules = await prisma.tierRule.findMany();
  const tierRuleByLevel = new Map(tierRules.map((r) => [r.level, r]));
  const [snackItem, merchItem] = await Promise.all([
    prisma.rewardsCatalog.findFirst({ where: { category: 'FREE_ITEM', isBirthdayReward: true, isActive: true } }),
    prisma.rewardsCatalog.findFirst({ where: { category: 'MERCHANDISE', isBirthdayReward: true, isActive: true } }),
  ]);

  const expiresAt = endOfWIBMonth(wibNow);
  const yearStart = wibFieldsToUTC(new Date(Date.UTC(wibNow.getUTCFullYear(), 0, 1)));

  let processed = 0;
  for (const member of birthdayMembers) {
    const rule = tierRuleByLevel.get(member.tierLevel);
    if (!rule) continue;

    // Idempotency: birthday only comes once a year, but guard against the
    // cron being retried/redelivered on the same day anyway.
    const alreadyGranted = await prisma.claimedBenefit.findFirst({
      where: { memberId: member.id, type: 'BIRTHDAY', createdAt: { gte: yearStart } },
    });
    if (alreadyGranted) continue;

    const rows: { memberId: string; type: 'BIRTHDAY'; expiresAt: Date; rewardsCatalogId?: string }[] = [];
    if (rule.birthdayFreeBeverage) {
      rows.push({ memberId: member.id, type: 'BIRTHDAY', expiresAt });
    }
    if (rule.birthdayFreeSnack && snackItem) {
      rows.push({ memberId: member.id, type: 'BIRTHDAY', expiresAt, rewardsCatalogId: snackItem.id });
    }
    if (rule.birthdayFreeMerch && merchItem) {
      rows.push({ memberId: member.id, type: 'BIRTHDAY', expiresAt, rewardsCatalogId: merchItem.id });
    }
    if (rows.length > 0) {
      await prisma.claimedBenefit.createMany({ data: rows });
      processed++;
      await sendPushToMember(member.id, {
        title: 'Selamat ulang tahun!',
        body: 'Ada hadiah spesial nunggu kamu klaim di app.',
      });
    }
  }
  return processed;
}

async function evaluateWeeklyMemberDay(wibNow: Date) {
  const config = await prisma.loyaltyConfig.upsert({ where: { id: 'singleton' }, create: {}, update: {} });
  if (wibNow.getUTCDay() !== config.weeklyMemberDayOfWeek) return 0;

  // One guard query instead of one per member — good enough at this scale,
  // and correctly idempotent against a retried/redelivered cron run.
  const alreadyRanToday = await prisma.claimedBenefit.findFirst({
    where: { type: 'WEEKLY_MEMBER_DAY', createdAt: { gte: startOfWIBDay(wibNow) } },
  });
  if (alreadyRanToday) return 0;

  const eligibleMembers = await prisma.member.findMany({ where: { tierLevel: { gte: 2 } }, select: { id: true } });
  if (eligibleMembers.length === 0) return 0;

  const expiresAt = endOfWIBDay(wibNow);
  await prisma.claimedBenefit.createMany({
    data: eligibleMembers.map((m) => ({ memberId: m.id, type: 'WEEKLY_MEMBER_DAY' as const, expiresAt })),
  });
  await sendPushToMembers(
    eligibleMembers.map((m) => m.id),
    { title: 'Hari Member!', body: 'Diskon spesial berlaku hari ini — jangan sampai kelewat.' }
  );
  return eligibleMembers.length;
}

/**
 * Marks past-due AVAILABLE rows EXPIRED on both reward tables. Neither
 * table gets deleted from cron (history stays queryable), and neither list
 * endpoint ever showed expired-but-not-yet-flipped rows anyway (they both
 * filter `expiresAt > now()` themselves) — this is pure housekeeping so the
 * raw status column stops lying about what's actually still claimable.
 */
async function expireStaleRewards(now: Date) {
  const [redeemedRewards, claimedBenefits] = await Promise.all([
    prisma.redeemedReward.updateMany({
      where: { status: 'AVAILABLE', expiresAt: { lt: now } },
      data: { status: 'EXPIRED' },
    }),
    prisma.claimedBenefit.updateMany({
      where: { status: 'AVAILABLE', expiresAt: { lt: now } },
      data: { status: 'EXPIRED' },
    }),
  ]);
  return { redeemedRewardsExpired: redeemedRewards.count, claimedBenefitsExpired: claimedBenefits.count };
}

export async function runDailyLoyaltyEvaluation() {
  const wibNow = nowAsWIBFields();
  const [birthdaysProcessed, weeklyMemberDayGenerated, expired] = await Promise.all([
    evaluateBirthdays(wibNow),
    evaluateWeeklyMemberDay(wibNow),
    expireStaleRewards(new Date()),
  ]);
  return { birthdaysProcessed, weeklyMemberDayGenerated, ...expired };
}
