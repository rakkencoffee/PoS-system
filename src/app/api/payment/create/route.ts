import { NextRequest, NextResponse } from 'next/server';
import { createSnapTransaction } from '@/lib/integrations/midtrans.service';

/**
 * POST /api/payment/create
 *
 * Creates a Midtrans Snap payment token for the given cart items.
 *
 * Body: {
 *   items: [{ productId, variantId?, quantity, name, price, note? }],
 *   totalAmount: number
 * }
 *
 * Response: { snapToken, orderId }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items, totalAmount, customerName } = body;

    if (!items || !items.length || !totalAmount) {
      return NextResponse.json(
        { error: 'Items and totalAmount are required' },
        { status: 400 }
      );
    }

    // Generate unique order ID
    const orderId = `SF-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // 1. Create order in POS (Olsera)
    let dbOrderId: string | null = null;
    try {
      const posAdapter = await import('@/lib/integrations/pos.adapter');
      const adapterOrder = await posAdapter.createOrder(
        items.map((item: any) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          price: item.price,
          note: item.note,
        })),
        customerName
      );
      dbOrderId = adapterOrder.orderId;
      console.log('Successfully created POS order:', dbOrderId);
    } catch (posError) {
      console.error('CRITICAL: Could not create POS order in Olsera:', posError);
      throw new Error('Gagal menyinkronkan pesanan dengan sistem POS. Harap coba lagi atau hubungi kasir.');
    }

    // 2. Create Midtrans Snap token
    const snapResult = await createSnapTransaction({
      orderId: dbOrderId ? String(dbOrderId) : orderId,
      grossAmount: totalAmount,
      items: items.map((item: { productId: string; name: string; price: number; quantity: number }) => ({
        id: item.productId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      })),
    });

    // 3. Auto-settlement logic removed to prevent premature KDS appearance.
    // Orders will now only be marked as paid via the Midtrans webhook or manual verification.

    return NextResponse.json({
      snapToken: snapResult.token,
      redirectUrl: snapResult.redirect_url,
      orderId: dbOrderId ? String(dbOrderId) : orderId,
    });
  } catch (error) {
    console.error('Error creating payment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to create payment', details: errorMessage },
      { status: 500 }
    );
  }
}
