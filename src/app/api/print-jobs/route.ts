import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const PRINT_BRIDGE_API_KEY = process.env.NEXT_PUBLIC_PRINT_BRIDGE_API_KEY || '';

/**
 * POST /api/print-jobs
 * 
 * Called by the kiosk tablet after successful checkout.
 * Creates a new print job in the database queue.
 * 
 * Body: PrintReceiptData (orderId, queueNumber, items, total, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    if (!payload.orderId) {
      return NextResponse.json(
        { error: 'orderId is required in payload' },
        { status: 400 }
      );
    }

    const dbOrderId = payload.dbOrderId || payload.orderId;

    // Prevent duplicate print jobs for the same order
    const existing = await prisma.printJob.findFirst({
      where: {
        OR: [
          { orderId: dbOrderId },
          { orderId: payload.orderId }
        ],
        status: { in: ['PENDING', 'PRINTING', 'PRINTED'] }
      }
    });

    if (existing) {
      return NextResponse.json({
        jobId: existing.id,
        status: existing.status,
        message: 'Print job already exists for this order'
      });
    }

    const job = await prisma.printJob.create({
      data: {
        orderId: dbOrderId,
        payload: payload, // Store entire PrintReceiptData as JSON
        status: 'PENDING',
      }
    });

    console.log(`[PrintQueue] ✅ Job created: ${job.id} for order ${payload.orderId}`);

    // Nudge the print-bridge daemon to check right away instead of waiting
    // for its next poll tick. Non-fatal — the daemon's own polling loop is
    // the safety net if this push never arrives.
    try {
      const { pusherServer } = await import('@/lib/pusher');
      await pusherServer.trigger('print-queue', 'NEW_JOB', { jobId: job.id });
      console.log(`[PrintQueue] NEW_JOB broadcast sent for job ${job.id}`);
    } catch (pusherErr) {
      console.warn('[PrintQueue] Failed to broadcast NEW_JOB (non-blocking):', pusherErr);
    }

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
    }, { status: 201 });

  } catch (error) {
    console.error('[PrintQueue] Failed to create print job:', error);
    return NextResponse.json(
      { error: 'Failed to create print job' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/print-jobs
 * 
 * Called by the local Print Bridge daemon to fetch pending print jobs.
 * Requires x-api-key header for authentication.
 * 
 * Query params:
 *   status (optional) — filter by status, defaults to "PENDING"
 *   limit (optional) — max number of jobs to return, defaults to 10
 */
export async function GET(request: NextRequest) {
  // Verify API key — only the daemon should call this
  const apiKey = request.headers.get('x-api-key');
  if (!PRINT_BRIDGE_API_KEY || apiKey !== PRINT_BRIDGE_API_KEY) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'PENDING';
    const limit = parseInt(searchParams.get('limit') || '10');

    const jobs = await prisma.printJob.findMany({
      where: { status },
      orderBy: { createdAt: 'asc' }, // FIFO — oldest first
      take: limit,
    });

    return NextResponse.json({ jobs });

  } catch (error) {
    console.error('[PrintQueue] Failed to fetch print jobs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch print jobs' },
      { status: 500 }
    );
  }
}
