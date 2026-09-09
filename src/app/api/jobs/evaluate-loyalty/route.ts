import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { NextResponse } from 'next/server';
import { runDailyLoyaltyEvaluation } from '@/lib/loyalty-cron';

/**
 * Background Job: Evaluate Loyalty (birthday + Hari Member)
 *
 * Triggered by a QStash schedule once a day (set up manually in the
 * Upstash Console — see project_rakken_loyalty_app memory for the
 * exact cron expression, WIB-adjusted). Uses Upstash Signature
 * Verification like /api/jobs/sync-products.
 */
async function handler() {
  try {
    console.log('[Job] 🎂 Daily loyalty evaluation started...');

    const result = await runDailyLoyaltyEvaluation();

    console.log(
      `[Job] ✅ Loyalty evaluation done: ${result.birthdaysProcessed} birthday(s), ${result.weeklyMemberDayGenerated} Hari Member benefit(s)`
    );

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[Job] ❌ Loyalty evaluation failed:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export const POST = process.env.NODE_ENV === 'production' ? verifySignatureAppRouter(handler) : handler;
