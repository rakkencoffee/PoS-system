import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { type ReceiptData } from '@/lib/print/format-receipt';
import { formatDrinkLabelsTspl } from '@/lib/print/format-label-tspl';

const ALLOWED_ROLES = ['KITCHEN', 'ADMIN'];

/**
 * GET /api/kds/sticker-test
 *
 * Renders one dummy drink label through the same TSPL formatter as the real
 * sticker endpoint (`/api/kds/sticker/[jobId]`), but from hardcoded sample
 * data instead of a PrintJob lookup -- lets staff test-print the physical
 * layout (wrap, line spacing, date placement) without placing a real order.
 * The sample notes deliberately mirror the comma-separated modifier text
 * that broke wrapping/line-height in earlier iterations, so a test print
 * exercises the same code path a real order would.
 */
export async function GET() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session || !ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sample: ReceiptData = {
    orderId: 'TEST-0001',
    queueNumber: '99',
    customerName: 'Test Print',
    total: 0,
    items: [
      {
        name: 'Rakken Signature Roar & Bold',
        size: 'Regular',
        quantity: 1,
        notes: 'Sugar: Normal, Ice: Less, Milk: Oat Milk',
      },
    ],
  };

  const buffer = formatDrinkLabelsTspl(sample);
  return NextResponse.json({ bytes: buffer.toString('base64') });
}
