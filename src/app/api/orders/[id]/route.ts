import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { orderEvents } from '@/lib/events';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
