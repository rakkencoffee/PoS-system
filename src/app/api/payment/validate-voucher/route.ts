import { NextRequest, NextResponse } from 'next/server';

/**
 * Hardcoded Voucher Database Configuration
 * Ideal for 'No-Database' Single Source of Truth architecture.
 * Format: 
 * - type: 'nominal' or 'percentage'
 * - value: amount of discount
 * - minPurchase: minimum transaction amount needed to use the voucher (0 for none)
 */
const VOUCHERS: Record<string, { type: 'nominal' | 'percentage'; value: number; minPurchase: number }> = {
  'STARTFRIDAY10': { type: 'nominal', value: 10000, minPurchase: 50000 },
  'RAKKENCOFFEE': { type: 'percentage', value: 15, minPurchase: 0 },
  'MINUS5': { type: 'nominal', value: 5000, minPurchase: 0 },
};

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

    const uppercaseCode = code.toUpperCase().trim();
    const voucher = VOUCHERS[uppercaseCode];

    if (!voucher) {
      return NextResponse.json({ error: 'Kode voucher tidak valid atau telah kadaluarsa.' }, { status: 404 });
    }

    if (totalAmount < voucher.minPurchase) {
      return NextResponse.json({ 
        error: `Minimal pembelian untuk voucher ini adalah Rp ${voucher.minPurchase.toLocaleString('id-ID')}` 
      }, { status: 400 });
    }

    // Hitung potongan harga
    let discountAmount = 0;
    if (voucher.type === 'nominal') {
      discountAmount = voucher.value;
    } else if (voucher.type === 'percentage') {
      discountAmount = Math.floor(totalAmount * (voucher.value / 100));
    }

    // Pastikan diskon tidak lebih besar dari total belanjaan
    if (discountAmount > totalAmount) {
      discountAmount = totalAmount;
    }

    return NextResponse.json({
      valid: true,
      message: 'Voucher berhasil diterapkan!',
      discountAmount: discountAmount,
      code: uppercaseCode
    });

  } catch (error) {
    console.error('Error validating voucher:', error);
    return NextResponse.json({ error: 'Gagal memvalidasi voucher' }, { status: 500 });
  }
}
