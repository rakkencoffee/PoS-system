import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { type ReceiptData } from '@/lib/print/format-receipt';
import { formatDrinkLabelsTspl } from '@/lib/print/format-label-tspl';

const ALLOWED_ROLES = ['KITCHEN', 'ADMIN'];

/**
 * GET /api/kds/sticker/[jobId]
 *
 * Renders the barista drink-label sticker for one order, on demand, straight
 * from the same PrintJob.payload already saved for the cashier receipt --
 * no separate sticker queue/table. The barista's Android tablet calls this
 * (both on auto-print and on manual retry) and relays the bytes to its
 * paired Bluetooth printer; formatting itself never runs in the browser.
 *
 * Keyed by PrintJob.id primarily, because the caller reacts to the
 * `print-queue` / NEW_JOB Pusher event, which fires exactly when the job
 * row (and its payload) exists -- unlike `kitchen` / ORDER_CREATED, which
 * fires as soon as the order is placed, before settlement has created the
 * PrintJob. Confirmed via dev logs 2026-09-01: fetching by orderId off
 * ORDER_CREATED raced the job creation and 404'd every time.
 *
 * Also accepts Order.id as a fallback lookup (PrintJob.orderId is unique,
 * one row per order) -- this is what the manual "Print Label" button on
 * each KDS order card passes, since that card only ever has order.id, not
 * the PrintJob.id from a Pusher event it may never have received.
 *
 * Formats as TSPL, not ESC/POS -- confirmed 2026-09-13 via the barista
 * printer's own self-test sticker ("App: TSPL+CPCL") that this RPP02N
 * (TSC 5824TSC clone) unit doesn't speak ESC/POS at all. Every earlier
 * ESC/POS write reported success (BLE writes don't get a parse-result back)
 * but silently printed nothing. If Barista's printer is ever swapped for an
 * ESC/POS model again, switch this back to formatDrinkLabels.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session || !ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { jobId } = await params;

  const job = await prisma.printJob.findUnique({ where: { id: jobId } })
    ?? await prisma.printJob.findUnique({ where: { orderId: jobId } });
  if (!job) {
    return NextResponse.json({ error: 'Print job tidak ditemukan.' }, { status: 404 });
  }

  const data = job.payload as unknown as ReceiptData;
  const buffer = formatDrinkLabelsTspl(data);

  if (buffer.length === 0) {
    return new NextResponse(null, { status: 204 });
  }

  return NextResponse.json({ bytes: buffer.toString('base64') });
}
