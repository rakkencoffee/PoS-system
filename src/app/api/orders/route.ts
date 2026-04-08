import { NextRequest, NextResponse } from 'next/server';
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
      let orders: any[] = [];
      try {
        const res = await olsera.olseraFetch('/order/openorder?per_page=50');
        if (res.ok) {
          const data = await res.json();
          const rawOrders = data.data || data || [];

          // Filter orders for KDS display - ONLY show PAID orders
          const validOrders = (Array.isArray(rawOrders) ? rawOrders : []).filter((order: any) => {
            const oStatus = (order.status || '').toUpperCase();
            // Critical Security: Only show if paid (1) or completed (Z)
            // This prevents unpaid orders from appearing in KDS
            return Number(order.is_paid) === 1 || oStatus === 'Z';
          });

          // Normalize Olsera orders to match frontend format
          orders = validOrders.map((order: any) => {
            let kdsStatus = 'PENDING';
            const oStatus = order.status?.toUpperCase() || '';
            const numericId = order.id || order.order_id;
            
            if (oStatus === 'A') kdsStatus = 'PREPARING';
            else if (oStatus === 'Z') kdsStatus = 'COMPLETED';
            else if (Number(order.is_paid) === 1) {
              kdsStatus = 'PENDING'; // Paid but not yet started (Status P)
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
        } else {
          console.error('Olsera orders fetch failed:', res.status);
        }
      } catch (olseraError) {
        console.error('Olsera orders error:', olseraError);
      }

      // Mock API removed as requested by user. Proceeding with real data only.
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
