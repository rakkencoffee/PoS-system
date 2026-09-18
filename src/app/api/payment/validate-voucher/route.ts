import { NextRequest, NextResponse } from 'next/server';
import { computeVoucherDiscount } from '@/lib/order-pricing';

/**
 * POST /api/payment/validate-voucher
 * Body: { code: string, totalAmount: number, items: any[] }
 */
export async function POST(request: NextRequest) {
  try {
    const { code, totalAmount, items } = await request.json();

    if (!code || typeof totalAmount !== 'number') {
      return NextResponse.json({ error: 'Kode dan totalAmount wajib diisi.' }, { status: 400 });
    }

    const uppercaseCode = code.toUpperCase().trim();
    const result = await computeVoucherDiscount(uppercaseCode, totalAmount, items);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      valid: true,
      message: result.message,
      discountAmount: result.discountAmount,
      itemDiscounts: result.itemDiscounts,
      code: uppercaseCode
    });

  } catch (error: any) {
    console.error('Error validating voucher:', error);
    return NextResponse.json({ 
      error: 'Gagal memvalidasi voucher', 
      details: error.message 
    }, { status: 500 });
  }
}
