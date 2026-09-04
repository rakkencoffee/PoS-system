import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const EDC_BRIDGE_API_KEY = process.env.EDC_BRIDGE_API_KEY || '';

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
  if (!EDC_BRIDGE_API_KEY || apiKey !== EDC_BRIDGE_API_KEY) {
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

    // Settle the order the instant the daemon confirms the EDC approved the
    // charge — this is the actual payment-succeeded trigger, not a
    // client-side poll (keeps working even if the kiosk tab is closed).
    if (status === 'APPROVED') {
      const posAdapter = await import('@/lib/integrations/pos.adapter');
      await posAdapter.updateOrderPaymentStatus(job.orderId, 'paid', job.amount, 'edc_bridge');
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
