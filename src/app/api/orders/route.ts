import { NextRequest, NextResponse } from 'next/server';
import { getNextQueueNumber } from '@/lib/queue';
import { orderEvents } from '@/lib/events';

const USE_OLSERA = process.env.USE_OLSERA === 'true';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const today = searchParams.get('today');

    if (USE_OLSERA) {
      // Fetch open orders from Olsera
      const olsera = await import('@/lib/integrations/olsera.service');
      try {
        const res = await olsera.olseraFetch('/order/openorder?per_page=50');
        if (!res.ok) {
          console.error('Olsera orders fetch failed:', res.status);
          return NextResponse.json([]);
        }
        
        const data = await res.json();
        const rawOrders = data.data || data || [];

        // Filter out unpaid orders so they don't show up in the KDS
        const validOrders = (Array.isArray(rawOrders) ? rawOrders : []).filter((order: any) => {
          const isPaid = order.payment_status === '1' || order.payment_status === 'paid';
          const oStatus = order.status?.toUpperCase() || '';
          return isPaid || oStatus === 'A' || oStatus === 'Z' || oStatus === 'S' || oStatus === 'T';
        });

        // Normalize Olsera orders to match frontend format
        const orders = validOrders.map((order: any) => {
          let kdsStatus = 'PENDING';
          const oStatus = order.status?.toUpperCase() || '';
          const numericId = order.id || order.order_id;
          
          if (oStatus === 'A') kdsStatus = 'PREPARING';
          else if (oStatus === 'Z') kdsStatus = 'COMPLETED';
          else if (order.payment_status === '1' || order.payment_status === 'paid') {
            kdsStatus = 'PENDING'; // Paid but not yet prepared
          }

          return {
            id: `OLSERA-${numericId}`,
            queueNumber: numericId % 1000,
            status: kdsStatus,
            totalAmount: order.total || order.grand_total || 0,
            paymentMethod: 'MIDTRANS',
            createdAt: order.order_date || order.created_at || new Date().toISOString(),
            items: (order.items || []).map((item: any, idx: number) => ({
              id: idx,
              menuItem: { name: item.product_name || item.name || 'Item' },
              quantity: item.qty || item.quantity || 1,
              size: item.variant_name || '-',
              subtotal: item.price || 0,
            })),
          };
        });

        return NextResponse.json(orders);
      } catch (olseraError) {
        console.error('Olsera orders error:', olseraError);
        return NextResponse.json([]);
      }
    }

    // Fallback: Prisma
    const prisma = (await import('@/lib/prisma')).default;

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

    const prisma = (await import('@/lib/prisma')).default;
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
