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

          let createdAtStr = '';
          // Priority: add_datetime > add_date+add_time > order_date+order_time > created_at
          if (order.add_datetime) {
            createdAtStr = order.add_datetime;
          } else if (order.add_date && order.add_time) {
            createdAtStr = `${order.add_date} ${order.add_time}`;
          } else if (order.order_date && order.order_time) {
            createdAtStr = `${order.order_date} ${order.order_time}`;
          } else if (order.order_date) {
            // order_date may contain '00:00:00' time — strip it and use current time
            const datePart = order.order_date.split(' ')[0]; // "2026-04-01 00:00:00" → "2026-04-01"
            const now = new Date();
            const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
            createdAtStr = `${datePart} ${timeStr}`;
          } else {
            createdAtStr = order.created_at || new Date().toISOString();
          }

          return {
            id: `OLSERA-${numericId}`,
            queueNumber: numericId % 1000,
            status: kdsStatus,
            totalAmount: Number(order.total || order.total_amount || order.grand_total || 0),
            paymentMethod: pMethod,
            createdAt: createdAtStr,
            items: (order.items || order.orderitems || order.order_items || []).map((item: any, idx: number) => {
              const rawNote = item.note || item.notes || '';
              let sugarLevel = 'normal';
              let iceLevel = 'normal';
              let isExtraShot = false;

              if (typeof rawNote === 'string') {
                const parts = rawNote.split(';').map((p: string) => p.trim());
                parts.forEach((p: string) => {
                  const lower = p.toLowerCase();
                  if (lower.startsWith('sugar:')) sugarLevel = p.substring(6).trim();
                  else if (lower.startsWith('ice:')) iceLevel = p.substring(4).trim();
                  else if (lower === 'extra shot') isExtraShot = true;
                });
              }

              // Variant/size: try multiple fields. Olsera list API often
              // doesn't return variant_name, so also check variant object.
              let size = item.variant_name
                || item.product_variant_name
                || item.variant?.name
                || item.size
                || '-';

              return {
                id: idx,
                menuItem: { name: item.product_name || item.name || 'Item' },
                quantity: Number(item.qty || item.quantity || 1),
                size,
                sugarLevel,
                iceLevel,
                extraShot: isExtraShot,
                notes: rawNote,
                subtotal: Number(item.price || 0),
              };
            }),
          };
        });

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
