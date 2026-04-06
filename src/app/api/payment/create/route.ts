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

    // 1. Try to create order in POS (Olsera or local DB depending on USE_OLSERA)
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
      console.warn('Could not create POS order (non-fatal):', posError);
      // Continue — Midtrans payment can proceed without POS order
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

    // 3. [TEST MODE] Immediately bypass settlement webhook since Midtrans can't hit offline local test server
    if (process.env.NEXT_PUBLIC_TEST_MODE === 'true' && dbOrderId) {
      console.log('[Test Mode Bypassed] Auto-settling newly created order:', dbOrderId);
      import('@/lib/integrations/pos.adapter').then(adapter => {
        adapter.updateOrderPaymentStatus(String(dbOrderId), 'paid', totalAmount)
          .catch((e: any) => console.warn('Test mode auto-settle failed:', e));
      });
    }

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
