import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/edc-jobs/status?orderId=xxx
 *
 * Public endpoint called by the kiosk checkout page to poll whether the
 * EDC payment for this order has been approved/rejected by the daemon yet.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json({ error: 'orderId query parameter is required' }, { status: 400 });
    }

    const job = await prisma.edcJob.findFirst({
      where: { orderId },
      orderBy: { createdAt: 'desc' }, // latest job for this order
      select: {
        id: true,
        status: true,
        amount: true,
        approvalCode: true,
        traceNumber: true,
        cardType: true,
        pan: true,
        errorMessage: true,
        attempts: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!job) {
      return NextResponse.json({ status: 'NOT_FOUND' });
    }

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      amount: job.amount,
      approvalCode: job.approvalCode,
      traceNumber: job.traceNumber,
      cardType: job.cardType,
      pan: job.pan,
      errorMessage: job.errorMessage,
      attempts: job.attempts,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    });
  } catch (error) {
    console.error('[EdcQueue] Failed to check EDC job status:', error);
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  }
}
