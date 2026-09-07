import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const EDC_BRIDGE_API_KEY = process.env.EDC_BRIDGE_API_KEY || '';

/**
 * POST /api/edc-jobs
 *
 * Called by the kiosk after choosing "Bayar Kartu EDC" at checkout.
 * Creates a new EDC payment job for an existing order — the local edc-bridge
 * daemon (USB-connected to the physical Ingenico terminal) polls for it,
 * pushes the amount to the EDC, and reports the result back via PATCH.
 *
 * Body: { orderId: string, amount: number, deviceId?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { orderId, amount, deviceId } = await request.json();

    if (!orderId || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'orderId and a positive numeric amount are required' },
        { status: 400 }
      );
    }

    const existing = await prisma.edcJob.findFirst({
      where: { orderId, status: { in: ['PENDING', 'PROCESSING', 'APPROVED'] } },
    });

    if (existing) {
      return NextResponse.json({
        jobId: existing.id,
        status: existing.status,
        message: 'EDC job already exists for this order',
      });
    }

    const job = await prisma.edcJob.create({
      data: { orderId, amount, status: 'PENDING', deviceId: deviceId || null },
    });

    console.log(`[EdcQueue] Job created: ${job.id} for order ${orderId} (Rp${amount})`);

    return NextResponse.json({ jobId: job.id, status: job.status }, { status: 201 });
  } catch (error) {
    console.error('[EdcQueue] Failed to create EDC job:', error);
    return NextResponse.json({ error: 'Failed to create EDC job' }, { status: 500 });
  }
}

/**
 * GET /api/edc-jobs
 *
 * Called by the local edc-bridge daemon to fetch pending EDC jobs.
 * Requires x-api-key header for authentication.
 *
 * Query params:
 *   status (optional) — filter by status, defaults to "PENDING"
 *   limit (optional) — max number of jobs to return, defaults to 5
 *   deviceId (optional) — only jobs created by this kiosk device. Each
 *     daemon.config sets its own DeviceId so a device with 3 independent
 *     EDC terminals doesn't have its 3 daemons race each other for the
 *     same job (see edc-bridge/EdcDaemon.cs). Omitted = any device (used
 *     for local single-EDC testing).
 */
export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  if (!EDC_BRIDGE_API_KEY || apiKey !== EDC_BRIDGE_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'PENDING';
    const limit = parseInt(searchParams.get('limit') || '5');
    const deviceId = searchParams.get('deviceId');

    const jobs = await prisma.edcJob.findMany({
      where: deviceId ? { status, deviceId } : { status },
      orderBy: { createdAt: 'asc' }, // FIFO — oldest first
      take: limit,
    });

    return NextResponse.json({ jobs });
  } catch (error) {
    console.error('[EdcQueue] Failed to fetch EDC jobs:', error);
    return NextResponse.json({ error: 'Failed to fetch EDC jobs' }, { status: 500 });
  }
}
