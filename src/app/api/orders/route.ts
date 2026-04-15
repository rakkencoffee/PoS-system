import { NextRequest, NextResponse } from 'next/server';
import { orderEvents } from '@/lib/events';

const USE_OLSERA = process.env.USE_OLSERA === 'true';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const today = searchParams.get('today');

    if (USE_OLSERA) {
      const olsera = await import('@/lib/integrations/olsera.service');
      let orders: any[] = [];
      try {
        // Use consolidated fetching if 'today' is requested, otherwise fallback to open orders
        const rawData = today === 'true' 
          ? await olsera.getAllOrders({ today: true })
          : await olsera.olseraFetch('/order/openorder?per_page=50').then(res => res.json().then(d => d.data || d || []));

        // Normalize orders to match frontend format
        orders = (Array.isArray(rawData) ? rawData : []).map((order: any) => {
          let kdsStatus = 'PENDING';
          const oStatus = (order.status || '').toUpperCase();
          const numericId = order.id || order.order_id;
          const isPaid = Number(order.is_paid) === 1 || order.payment_status === '1' || oStatus === 'Z';
          
          if (oStatus === 'A') kdsStatus = 'PREPARING';
          else if (oStatus === 'Z' || oStatus === 'T') kdsStatus = 'COMPLETED';
          else if (isPaid) {
            kdsStatus = 'PENDING'; // Paid but no progress yet
          }

          // Payment method normalization
          let pMethod = order.payment_mode_name || order.payment_method || 'MIDTRANS';
          if (pMethod === '1' || pMethod === 'Cash') pMethod = 'CASH';

          return {
            id: `OLSERA-${numericId}`,
            queueNumber: numericId % 1000,
            status: kdsStatus,
            totalAmount: Number(order.total || order.total_amount || order.grand_total || 0),
            paymentMethod: pMethod,
            createdAt: order.order_date || order.created_at || new Date().toISOString(),
            items: (order.items || order.orderitems || order.order_items || []).map((item: any, idx: number) => ({
              id: idx,
              menuItem: { name: item.product_name || item.name || 'Item' },
              quantity: Number(item.qty || item.quantity || 1),
              size: item.variant_name || '-',
              subtotal: Number(item.price || 0),
            })),
          };
        });

        // If filtering for KDS (status provided), restrict to paid/active only
        if (status) {
          orders = orders.filter(o => o.status !== 'COMPLETED' || status === 'COMPLETED');
        }
      } catch (olseraError) {
        console.error('Olsera orders error:', olseraError);
      }

      return NextResponse.json(orders);
    } else {
      throw new Error("Local database (Prisma) is no longer supported for fetching orders.");
    }
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: 'POST to /api/orders is deprecated in Olsera-only mode.' }, 
    { status: 501 }
  );
}
