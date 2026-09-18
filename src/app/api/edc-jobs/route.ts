import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { safeEqual } from '@/lib/safe-equal';

const EDC_BRIDGE_API_KEY = process.env.EDC_BRIDGE_API_KEY || '';

function isAuthorized(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key');
  return !!EDC_BRIDGE_API_KEY && !!apiKey && safeEqual(apiKey, EDC_BRIDGE_API_KEY);
}

/**
 * POST /api/edc-jobs
 *
 * NOT currently called by any kiosk code (checkout creates the EdcJob row
 * directly via Prisma inside /api/payment/create, which is also where the
 * amount is verified against the real order total) -- kept here only for the
 * edc-bridge daemon, which already sends the same x-api-key header on every
 * request (see edc-bridge/EdcDaemon.cs). Requiring it here too closes what
 * used to be an unauthenticated endpoint that trusted an arbitrary `amount`.
 *
 * Body: { orderId: string, amount: number, deviceId?: string, method?: "CARD" | "QRIS" }
 */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { orderId, amount, deviceId, method } = await request.json();

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
      data: { orderId, amount, status: 'PENDING', deviceId: deviceId || null, method: method === 'QRIS' ? 'QRIS' : 'CARD' },
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
  if (!isAuthorized(request)) {
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
