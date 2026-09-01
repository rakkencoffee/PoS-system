import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { formatDrinkLabels, type ReceiptData } from '@/lib/print/format-receipt';

const ALLOWED_ROLES = ['KITCHEN', 'ADMIN'];

/**
 * GET /api/kds/sticker/[orderId]
 *
 * Renders the barista drink-label sticker for one order, on demand, straight
 * from the same PrintJob.payload already saved for the cashier receipt --
 * no separate sticker queue/table. The barista's Android tablet calls this
 * (both on auto-print and on manual retry) and relays the bytes to its
 * paired Bluetooth printer; formatting itself never runs in the browser.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session || !ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { orderId } = await params;

  const job = await prisma.printJob.findUnique({ where: { orderId } });
  if (!job) {
    return NextResponse.json({ error: 'Order tidak ditemukan.' }, { status: 404 });
  }

  const data = job.payload as unknown as ReceiptData;
  const buffer = formatDrinkLabels(data);

  if (buffer.length === 0) {
    return new NextResponse(null, { status: 204 });
  }

  return NextResponse.json({ bytes: buffer.toString('base64') });
}
