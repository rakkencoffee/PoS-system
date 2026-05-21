import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const PRINT_BRIDGE_API_KEY = process.env.NEXT_PUBLIC_PRINT_BRIDGE_API_KEY || '';

/**
 * PATCH /api/print-jobs/[id]
 * 
 * Called by the local Print Bridge daemon after attempting to print.
 * Updates job status to PRINTED or FAILED.
 * Requires x-api-key header.
 * 
 * Body: { status: 'PRINTED' | 'FAILED', errorMessage?: string }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Verify API key
  const apiKey = request.headers.get('x-api-key');
  if (!PRINT_BRIDGE_API_KEY || apiKey !== PRINT_BRIDGE_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { status, errorMessage } = body;

    if (!['PRINTING', 'PRINTED', 'FAILED'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be PRINTING, PRINTED, or FAILED' },
        { status: 400 }
      );
    }

    const job = await prisma.printJob.update({
      where: { id },
      data: {
        status,
        errorMessage: errorMessage || null,
        attempts: { increment: status === 'FAILED' ? 1 : 0 },
      }
    });

    console.log(`[PrintQueue] Job ${id} updated to ${status}`);

    return NextResponse.json({
      id: job.id,
      status: job.status,
      attempts: job.attempts,
    });

  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Print job not found' }, { status: 404 });
    }
    console.error('[PrintQueue] Failed to update print job:', error);
    return NextResponse.json(
      { error: 'Failed to update print job' },
      { status: 500 }
    );
  }
}
