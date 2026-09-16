import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { type ReceiptData } from '@/lib/print/format-receipt';
import { formatFoodLabelsTspl, formatRulerTestTspl } from '@/lib/print/format-label-tspl';

const ALLOWED_ROLES = ['KITCHEN', 'ADMIN'];

/**
 * GET /api/kds/food-label-test?offsetMm=<n>
 * GET /api/kds/food-label-test?ruler=1
 *
 * Kitchen's counterpart to /api/kds/sticker-test (Barista) -- same idea, same
 * TSPL formatter family, just formatFoodLabelsTspl() and a sample food item
 * instead of a drink. See that route's comments for the offsetMm/ruler
 * parameter behavior, which is identical here.
 *
 * Kitchen's physical printer is a separate unit from Barista's -- even
 * though both need TSPL, its real label pitch/offset may not match Barista's
 * confirmed numbers, so this has its own ?ruler=1 to calibrate independently
 * rather than assuming the two are identical.
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
        // actual food (main-course) name in the catalog -- same reasoning as
        // Barista's test sample: exercise the real worst-case wrap width
        // instead of an arbitrary placeholder. categorySlug is required here
        // -- isDrinkItem() falls back to matching keywords in the NAME when
        // it's absent, and this name doesn't happen to contain any, so
        // without it the item would be misclassified as a drink and
        // formatFoodLabelsTspl would filter it out, printing nothing.
        name: 'Sliced beef / Chicken karaage / salmon baked don',
        categorySlug: 'main-course',
        size: 'Regular',
        quantity: 1,
        notes: 'Sambal: Normal, Extra: Nori',
      },
    ],
  };

  const buffer = formatFoodLabelsTspl(sample, { offsetMm });
  return NextResponse.json({ bytes: buffer.toString('base64') });
}
