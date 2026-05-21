import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/print-jobs/status?orderId=xxx
 * 
 * Public endpoint called by the kiosk success page to poll
 * whether the receipt has been printed by the daemon.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json(
        { error: 'orderId query parameter is required' },
        { status: 400 }
      );
    }

    const job = await prisma.printJob.findFirst({
      where: { orderId },
      orderBy: { createdAt: 'desc' }, // Get the latest job for this order
      select: {
        id: true,
        status: true,
        attempts: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    if (!job) {
      return NextResponse.json({ status: 'NOT_FOUND' });
    }

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      attempts: job.attempts,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    });

  } catch (error) {
    console.error('[PrintQueue] Failed to check print job status:', error);
    return NextResponse.json(
      { error: 'Failed to check status' },
      { status: 500 }
    );
  }
}
