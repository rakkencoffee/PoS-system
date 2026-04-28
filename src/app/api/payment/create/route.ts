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
    const { items, totalAmount, customerName, discountAmount, voucherCode } = body;

    if (!items || !items.length || typeof totalAmount !== 'number') {
      return NextResponse.json(
        { error: 'Items and totalAmount are required' },
        { status: 400 }
      );
    }

    // Generate unique order ID
    const orderId = `SF-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // 1. Create order in POS (Olsera) — NON-BLOCKING
    // Best Practice POS: Jangan pernah gagalkan pembayaran pelanggan karena API backend error.
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

      // Inject discount natively to Olsera if a voucher was applied
      if (discountAmount && discountAmount > 0) {
        await posAdapter.applyOrderDiscount(dbOrderId, discountAmount);
      }

    } catch (posError) {
      // RESILIENT: Jika Olsera gagal, tetap lanjutkan pembayaran dengan order ID lokal.
      // Pesanan akan disinkronkan ke Olsera nanti via webhook atau manual reconciliation.
      console.error('WARNING: Could not create POS order in Olsera (non-blocking):', posError);
      dbOrderId = orderId; // Gunakan orderId lokal (SF-xxxx) sebagai fallback
    }

    // 2. Format Midtrans Items
    const midtransItems = items.map((item: { productId: string; name: string; price: number; quantity: number }) => ({
      id: item.productId,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
    }));

    // If discount exists, subtract it using Midtrans dummy item
    let finalGrossAmount = totalAmount;
    if (discountAmount && discountAmount > 0) {
      finalGrossAmount -= discountAmount;
      midtransItems.push({
        id: 'VOUCHER',
        name: voucherCode ? `Voucher: ${voucherCode}` : 'Discount Voucher',
        price: -Math.abs(discountAmount),
        quantity: 1,
      });
    }

    // 3. Create Midtrans Snap token
    const snapResult = await createSnapTransaction({
      orderId: dbOrderId ? String(dbOrderId) : orderId,
      grossAmount: finalGrossAmount,
      items: midtransItems,
    });

    // 4. Broadcast ke Kitchen Display (KDS) via Pusher — IMMEDIATELY
    // Agar barista langsung lihat order baru tanpa menunggu Midtrans webhook
    try {
      const { pusherServer } = await import('@/lib/pusher');
      
      const coffeeKeywords = ['coffee', 'kopi', 'espresso', 'latte', 'cappuccino', 'americano', 'mocha', 'macchiato', 'v60', 'affogato'];
      const coffeeCategories = ['coffee-based', 'coffee based', 'milk-based', 'milk based'];
      
      const isCoffeeOrder = items.some((item: any) => {
        const itemName = (item.name || '').toLowerCase();
        const catName = (item.categoryName || item.group_name || item.product_group_name || '').toLowerCase();
        return coffeeCategories.some(c => catName.includes(c)) || coffeeKeywords.some(k => itemName.includes(k));
      });

      await pusherServer.trigger('kitchen', 'ORDER_CREATED', {
        order: {
          id: dbOrderId || orderId,
          queueNumber: dbOrderId?.startsWith('OLSERA-') 
            ? parseInt(dbOrderId.replace('OLSERA-', '')) % 1000 
            : Math.floor(Math.random() * 900) + 100,
          status: 'PENDING',
          totalAmount: finalGrossAmount,
          paymentMethod: 'MIDTRANS',
          createdAt: new Date().toISOString(),
          isCoffeeOrder,
          items: items.map((item: any, idx: number) => ({
            id: idx,
            menuItem: { name: item.name || 'Item' },
            quantity: item.quantity || 1,
            size: item.variantName || '-',
            categoryName: item.categoryName || item.group_name || item.product_group_name || '',
          })),
        },
      });
      console.log(`[Pusher] ORDER_CREATED broadcast for ${dbOrderId || orderId}`);
    } catch (pusherErr) {
      console.warn('[Pusher] Failed to broadcast ORDER_CREATED (non-blocking):', pusherErr);
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
