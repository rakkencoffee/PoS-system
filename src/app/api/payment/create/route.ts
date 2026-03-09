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
    const { items, totalAmount } = body;

    if (!items || !items.length || !totalAmount) {
      return NextResponse.json(
        { error: 'Items and totalAmount are required' },
        { status: 400 }
      );
    }

    // Generate unique order ID
    const orderId = `SF-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // 1. Try to create order in local DB
    let dbOrderId: number | null = null;
    try {
      const prisma = (await import('@/lib/prisma')).default;

      // Get queue number
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const lastOrder = await prisma.order.findFirst({
        where: { createdAt: { gte: todayStart } },
        orderBy: { queueNumber: 'desc' },
      });
      const queueNumber = (lastOrder?.queueNumber || 0) + 1;

      const order = await prisma.order.create({
        data: {
          queueNumber,
          totalAmount,
          paymentMethod: 'MIDTRANS',
          status: 'PENDING',
          items: {
            create: items.map((item: { productId: string; quantity: number; variantId?: string; price: number; name: string }) => ({
              menuItemId: parseInt(item.productId) || 1,
              quantity: item.quantity,
              size: item.variantId || 'M',
              price: item.price,
              subtotal: item.price * item.quantity,
              notes: '',
            })),
          },
        },
      });

      dbOrderId = order.id;
    } catch (dbError) {
      console.warn('Could not create DB order (non-fatal):', dbError);
      // Continue — Midtrans payment can proceed without local DB order
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
