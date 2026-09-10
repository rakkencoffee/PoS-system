import { NextRequest, NextResponse } from 'next/server';
import { runDailyLoyaltyEvaluation } from '@/lib/loyalty-cron';

/**
 * Background Job: Evaluate Loyalty (birthday + Hari Member + expire stale rewards)
 *
 * Triggered by a native Vercel Cron Job (see `crons` in vercel.json) once a
 * day — moved off QStash (2026-09-10) because it only needs once-a-day
 * triggering, which Vercel's own scheduler already covers on the Hobby plan
 * without any external service or manual dashboard setup (unlike QStash,
 * whose schedule for this job was accidentally created under the wrong
 * region in Upstash Console and silently failed signature verification
 * every night). `sync-products` still needs QStash — it runs every 5
 * minutes, more often than Hobby's native cron allows.
 *
 * Vercel signs every cron invocation with `Authorization: Bearer
 * $CRON_SECRET` — see https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[Job] Daily loyalty evaluation started...');

    const result = await runDailyLoyaltyEvaluation();

    console.log(
      `[Job] Loyalty evaluation done: ${result.birthdaysProcessed} birthday(s), ${result.weeklyMemberDayGenerated} Hari Member benefit(s), ${result.redeemedRewardsExpired} redeemed reward(s) + ${result.claimedBenefitsExpired} claimed benefit(s) expired`
    );

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[Job] Loyalty evaluation failed:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
