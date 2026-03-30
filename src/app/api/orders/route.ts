import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getNextQueueNumber } from '@/lib/queue';
import { orderEvents } from '@/lib/events';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const today = searchParams.get('today');

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (today === 'true') {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      where.createdAt = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    const orders = await prisma.order.findMany({
      where,
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
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const queueNumber = await getNextQueueNumber();

    const order = await prisma.order.create({
      data: {
        queueNumber,
        totalAmount: body.totalAmount,
        paymentMethod: body.paymentMethod || 'QRIS',
        customerName: body.customerName || '',
        items: {
          create: body.items.map((item: {
            menuItemId: number;
            quantity: number;
            size: string;
            sugarLevel: string;
            iceLevel: string;
            extraShot: boolean;
            note: string[];
            subtotal: number;
            toppings: { id: number; name: string; price: number }[];
          }) => ({
            menuItemId: Number(item.menuItemId),
            quantity: item.quantity,
            size: item.size || '-',
            sugarLevel: item.sugarLevel || 'normal',
            iceLevel: item.iceLevel || 'normal',
            extraShot: item.extraShot || false,
            subtotal: item.subtotal,
            notes: item.note ? item.note.join('\n') : '',
            toppings: item.toppings?.length ? {
              create: item.toppings.map((t: { id: number; name: string }) => ({
                toppingId: typeof t.id === 'number' ? t.id : parseInt(String(t.id).split('-')[0]) || 0
              })).filter((t: { toppingId: number }) => t.toppingId > 0)
            } : undefined,
          })),
        },
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
    orderEvents.emit('ORDER_CREATED', { order });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
