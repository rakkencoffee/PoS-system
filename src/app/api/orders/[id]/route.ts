import { NextRequest, NextResponse } from 'next/server';
import { orderEvents } from '@/lib/events';

const USE_OLSERA = process.env.USE_OLSERA === 'true';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Handle Olsera order IDs (e.g. "OLSERA-1262474270")
    if (USE_OLSERA && id.startsWith('OLSERA-')) {
      const olseraOrderId = parseInt(id.replace('OLSERA-', ''));
      const olsera = await import('@/lib/integrations/olsera.service');

      try {
        const orderDetail = await olsera.getOrderDetail(olseraOrderId);
        
        // Normalize Olsera response to match our frontend format
        const items = Array.isArray(orderDetail.items) ? orderDetail.items : [];
        return NextResponse.json({
          id: id,
          queueNumber: olseraOrderId % 1000, // Last 3 digits as queue number
          status: orderDetail.status === '1' || orderDetail.status === 'paid' ? 'PREPARING' : 'PENDING',
          totalAmount: orderDetail.total || 0,
          createdAt: new Date().toISOString(),
          items: items.map((item: any, idx: number) => ({
            id: idx,
            menuItem: { name: item.product_name || item.name || 'Item' },
            quantity: item.qty || item.quantity || 1,
            size: item.variant_name || '-',
          })),
        });
      } catch (olseraError) {
        console.error('Olsera getOrderDetail failed:', olseraError);
        // Return a minimal order object so the page doesn't crash
        return NextResponse.json({
          id: id,
          queueNumber: olseraOrderId % 1000,
          status: 'PENDING',
          totalAmount: 0,
          createdAt: new Date().toISOString(),
          items: [],
        });
      }
    }

    // Fallback: local Prisma DB
    const prisma = (await import('@/lib/prisma')).default;
    const order = await prisma.order.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: {
          include: {
            menuItem: true,
            toppings: {
              include: {
                topping: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Olsera orders can't be patched via local DB
    if (id.startsWith('OLSERA-')) {
      return NextResponse.json({ id, status: body.status });
    }

    const prisma = (await import('@/lib/prisma')).default;
    const order = await prisma.order.update({
      where: { id: parseInt(id) },
      data: {
        status: body.status,
      },
      include: {
        items: {
          include: {
            menuItem: true,
            toppings: {
              include: {
                topping: true,
              },
            },
          },
        },
      },
    });

    // Emit SSE event
    orderEvents.emit('ORDER_UPDATED', { order });

    return NextResponse.json(order);
  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}
