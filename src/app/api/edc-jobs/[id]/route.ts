import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { safeEqual } from '@/lib/safe-equal';

const EDC_BRIDGE_API_KEY = process.env.EDC_BRIDGE_API_KEY || '';

// Same reasoning as api/payment/create/route.ts's maxDuration: the after()
// settlement callback below runs several sequential Olsera calls, which
// can silently exceed the platform's default function timeout and get
// killed mid-flight -- the order never gets marked PAID (invisible on KDS)
// and Olsera never gets told the paid amount (POS/EDC nominal mismatch).
export const maxDuration = 60;

/**
 * PATCH /api/edc-jobs/[id]
 *
 * Called by the local edc-bridge daemon after calling EdcClient.Purchase()
 * against the physical EDC. Updates job status to PROCESSING, APPROVED,
 * REJECTED, or FAILED with the parsed EdcResult fields.
 * Requires x-api-key header.
 *
 * Body: { status, approvalCode?, traceNumber?, cardType?, pan?, responseCode?,
 *         rawResponseData?, errorMessage? }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const apiKey = request.headers.get('x-api-key');
  if (!EDC_BRIDGE_API_KEY || !apiKey || !safeEqual(apiKey, EDC_BRIDGE_API_KEY)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const {
      status,
      approvalCode,
      traceNumber,
      cardType,
      pan,
      responseCode,
      rawResponseData,
      errorMessage,
    } = body;

    if (!['PROCESSING', 'APPROVED', 'REJECTED', 'FAILED'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be PROCESSING, APPROVED, REJECTED, or FAILED' },
        { status: 400 }
      );
    }

    const job = await prisma.edcJob.update({
      where: { id },
      data: {
        status,
        approvalCode: approvalCode ?? undefined,
        traceNumber: traceNumber ?? undefined,
        cardType: cardType ?? undefined,
        pan: pan ?? undefined,
        responseCode: responseCode ?? undefined,
        rawResponseData: rawResponseData ?? undefined,
        errorMessage: errorMessage ?? null,
        attempts: { increment: status === 'FAILED' || status === 'REJECTED' ? 1 : 0 },
      },
    });

    console.log(`[EdcQueue] Job ${id} updated to ${status}`);

    // Push the new status straight to whatever kiosk tab is showing this
    // job's EdcPaymentFlow FIRST -- this is the near-instant "Payment
    // Approved" signal the kiosk reacts to, so it must not sit behind the
    // settlement chain below (Olsera sync + Pusher broadcasts + a local DB
    // retry loop that can take up to ~7s in the worst case). Its own poll()
    // loop exits permanently the first time it reads FAILED/REJECTED (see
    // EdcPaymentFlow.tsx) -- without this, staff manually flipping a
    // genuinely-successful job to APPROVED via ResolveEdcJob.ps1 had no way
    // to reach that tab except a manual "Cek Status Lagi" click. Best-effort:
    // if this fails, the manual recheck button is still there as a fallback.
    try {
      const { pusherServer } = await import('@/lib/pusher');
      await pusherServer.trigger(`edc-job-${job.orderId}`, 'STATUS_UPDATE', { status: job.status });
    } catch (err) {
      console.warn(`[EdcQueue] Failed to broadcast STATUS_UPDATE for job ${id}:`, err);
    }

    // Settle the order (Olsera sync, KDS/admin Pusher broadcasts, local
    // mirror update, print-job trigger) the instant the daemon confirms the
    // EDC approved the charge -- this is the actual payment-succeeded
    // trigger, not a client-side poll (keeps working even if the kiosk tab
    // is closed). Deferred via after() (same pattern /api/payment/create
    // already uses) so the daemon's PATCH response and the Pusher push above
    // don't wait on it -- updateOrderPaymentStatus already swallows its own
    // errors internally, so this only changes *when* settlement runs
    // relative to the response, not how errors are handled.
    if (status === 'APPROVED') {
      const { after } = await import('next/server');
      after(async () => {
        const posAdapter = await import('@/lib/integrations/pos.adapter');
        await posAdapter.updateOrderPaymentStatus(job.orderId, 'paid', job.amount, 'edc_bridge');
      });
    }

    return NextResponse.json({
      id: job.id,
      status: job.status,
      approvalCode: job.approvalCode,
      attempts: job.attempts,
    });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'EDC job not found' }, { status: 404 });
    }
    console.error('[EdcQueue] Failed to update EDC job:', error);
    return NextResponse.json({ error: 'Failed to update EDC job' }, { status: 500 });
  }
}
