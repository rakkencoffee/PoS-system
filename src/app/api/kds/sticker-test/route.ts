import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { type ReceiptData } from '@/lib/print/format-receipt';
import { formatDrinkLabelsTspl, formatRulerTestTspl } from '@/lib/print/format-label-tspl';

const ALLOWED_ROLES = ['KITCHEN', 'ADMIN'];

/**
 * GET /api/kds/sticker-test?offsetMm=<n>
 * GET /api/kds/sticker-test?ruler=1
 *
 * Renders one dummy drink label through the same TSPL formatter as the real
 * sticker endpoint (`/api/kds/sticker/[jobId]`), but from hardcoded sample
 * data instead of a PrintJob lookup -- lets staff test-print the physical
 * layout (wrap, line spacing, date placement) without placing a real order.
 * The sample notes deliberately mirror the comma-separated modifier text
 * that broke wrapping/line-height in earlier iterations, so a test print
 * exercises the same code path a real order would.
 *
 * `offsetMm` (optional) is forwarded as TSPL's `OFFSET` command, for
 * physically calibrating the gap-sensor/print-head vertical registration
 * (see the note on TsplLabelOptions.offsetMm) -- print a few labels with
 * different values (e.g. -8, -4, 0, 4, 8) and see which one is fully inside
 * the physical label instead of getting clipped at the top. The value used
 * is echoed into the printed customer-name line so each label in a batch is
 * self-identifying.
 *
 * `ruler=1` prints formatRulerTestTspl() instead -- a column of mm markers
 * for reading the real physical label height directly off a test print
 * (see that function's comment). Use this once to get a real heightMm value
 * before relying on any vertical-centering behavior in formatItemLabelsTspl.
 */
export async function GET(request: Request) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session || !ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  if (params.get('ruler') === '1') {
    return NextResponse.json({ bytes: formatRulerTestTspl().toString('base64') });
  }

  const offsetParam = params.get('offsetMm');
  const offsetMm = offsetParam !== null && offsetParam !== '' ? Number(offsetParam) : undefined;
  if (offsetMm !== undefined && !Number.isFinite(offsetMm)) {
    return NextResponse.json({ error: 'offsetMm must be a number' }, { status: 400 });
  }

  const sample: ReceiptData = {
    orderId: 'TEST-0001',
    queueNumber: '99',
    customerName: offsetMm !== undefined ? `Test OFFSET ${offsetMm}mm` : 'Test Print',
    total: 0,
    items: [
      {
        // Real menu item from ProductCache (2026-09-15 query), the longest
        // actual drink name in the catalog (25 chars) -- picked deliberately
        // over the old made-up "Rakken Signature Roar & Bold" so this test
        // print exercises the real worst-case wrap width for the Barista
        // station instead of an arbitrary/unrealistic one.
        name: 'Butterscotch Cloud Coffee',
        size: 'Regular',
        quantity: 1,
        notes: 'Sugar: Normal, Ice: Less, Milk: Oat Milk',
      },
    ],
  };

  const buffer = formatDrinkLabelsTspl(sample, { offsetMm });
  return NextResponse.json({ bytes: buffer.toString('base64') });
}
