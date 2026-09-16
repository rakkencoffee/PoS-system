import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { type ReceiptData } from '@/lib/print/format-receipt';
import { formatFoodLabelsTspl } from '@/lib/print/format-label-tspl';

const ALLOWED_ROLES = ['KITCHEN', 'ADMIN'];

/**
 * GET /api/kds/food-label/[jobId]
 *
 * Same shape as /api/kds/sticker/[jobId] (Barista, drinks) but for food
 * items -- see that route's comments for the NEW_JOB/PrintJob.id rationale,
 * and for why Order.id is also accepted as a fallback lookup.
 *
 * Switched from the ESC/POS formatter (formatFoodLabels) to TSPL
 * (formatFoodLabelsTspl) 2026-09-16: confirmed live via the Kitchen
 * printer's own self-test sticker that it's the same TSPL-only class of
 * unit as Barista's (see format-label-tspl.ts's file comment) -- ESC/POS
 * writes were "succeeding" over BLE (no error) but silently discarded by
 * the printer since none of it parsed as valid TSPL/CPCL, so nothing ever
 * printed. formatFoodLabelsTspl() already existed (written alongside the
 * Barista fix) but was never wired up here until now.
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
  const buffer = formatFoodLabelsTspl(data);

  if (buffer.length === 0) {
    return new NextResponse(null, { status: 204 });
  }

  return NextResponse.json({ bytes: buffer.toString('base64') });
}
