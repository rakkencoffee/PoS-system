import { NextRequest, NextResponse } from 'next/server';
import { olseraApi } from '@/lib/integrations/olsera';

/**
 * POST /api/payment/validate-voucher
 * Body: { code: string, totalAmount: number }
 */
export async function POST(request: NextRequest) {
  try {
    const { code, totalAmount } = await request.json();

    if (!code || typeof totalAmount !== 'number') {
      return NextResponse.json({ error: 'Kode dan totalAmount wajib diisi.' }, { status: 400 });
    }

    // Best Practice: Validate against Olsera Backoffice (Single Source of Truth)
    const result = await olseraApi.validateVoucherRemote(code, totalAmount);

    if (!result.valid) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({
      valid: true,
      message: result.message,
      discountAmount: result.discountAmount,
      code: code.toUpperCase().trim()
    });

  } catch (error: any) {
    console.error('Error validating voucher:', error);
    return NextResponse.json({ 
      error: 'Gagal memvalidasi voucher', 
      details: error.message 
    }, { status: 500 });
  }
}
