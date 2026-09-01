import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { formatFoodLabels, type ReceiptData } from '@/lib/print/format-receipt';

const ALLOWED_ROLES = ['KITCHEN', 'ADMIN'];

/**
 * GET /api/kds/food-label/[jobId]
 *
 * Same shape as /api/kds/sticker/[jobId] (Barista, drinks) but for food
 * items -- see that route's comments for the NEW_JOB/PrintJob.id rationale.
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

  const job = await prisma.printJob.findUnique({ where: { id: jobId } });
  if (!job) {
    return NextResponse.json({ error: 'Print job tidak ditemukan.' }, { status: 404 });
  }

  const data = job.payload as unknown as ReceiptData;
  const buffer = formatFoodLabels(data);

  if (buffer.length === 0) {
    return new NextResponse(null, { status: 204 });
  }

  return NextResponse.json({ bytes: buffer.toString('base64') });
}
