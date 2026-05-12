import { NextRequest, NextResponse } from 'next/server';

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
        // 1. Fetch List of Orders from Olsera
        const rawList = today === 'true' 
          ? await olsera.getAllOrders({ today: true })
          : await olsera.olseraFetch('/order/openorder?per_page=100').then(res => res.json().then(d => d.data || d || []));
        
        // 2. Identify "Active" orders that need details (Pending/Preparing)
        // Increased limit to 50 to cover all orders seen in backoffice
        const allPotentialOrders = (Array.isArray(rawList) ? rawList : []);
        const activeOrdersToEnrich = allPotentialOrders
          .filter(o => {
            const status = (o.status || '').toUpperCase();
            return status !== 'Z' && status !== 'T'; // Not Completed / Not Cancelled
          })
          .slice(0, 50);

        console.log(`[API] Total list items: ${allPotentialOrders.length}, Active to enrich: ${activeOrdersToEnrich.length}`);

        // 3. Fetch details for each active order sequentially with rate limit protection
        const enrichedOrders = [];
        for (const o of activeOrdersToEnrich) {
          try {
            const numericId = o.id || o.order_id;
            const detail = await olsera.getOrderDetail(numericId);
            enrichedOrders.push({ ...o, ...detail });
            
            // Add a small delay to respect Olsera's rate limits
            await new Promise(resolve => setTimeout(resolve, 300));
          } catch (err) {
            console.error(`[API] Failed to fetch detail for order ${o.id}:`, err);
            enrichedOrders.push({
              ...o,
              items: [{ product_name: 'Menu (Detail Loading...)', qty: 1, group_name: 'Other' }]
            });
          }
        }

        // 5. Normalize enriched orders
        orders = enrichedOrders.map((order: any) => {
          let kdsStatus = 'PENDING';
          const oStatus = (order.status || '').toUpperCase();
          const numericId = order.id || order.order_id;
          
          if (oStatus === 'A') kdsStatus = 'PREPARING';
          else if (oStatus === 'Z' || oStatus === 'T') kdsStatus = 'COMPLETED';
          else kdsStatus = 'PENDING';

          let pMethod = order.payment_mode_name || order.payment_method || 'MIDTRANS';
          if (pMethod === '1' || pMethod === 'Cash') pMethod = 'CASH';

          const rawItems = order.items || order.orderitems || order.order_items || [];
          
          return {
            id: `OLSERA-${numericId}`,
            queueNumber: numericId % 1000,
            status: kdsStatus,
            totalAmount: Number(order.total || order.total_amount || order.grand_total || 0),
            paymentMethod: pMethod,
            createdAt: order.order_date || order.created_at || new Date().toISOString(),
            items: rawItems.map((item: any, idx: number) => {
              const name = item.product_name || item.name || 'Item';
              
              // Normalize category from Olsera group name or category name
              const groupName = (item.product_group_name || item.group_name || item.category_name || '').toLowerCase();
              
              let cat = 'other';
              // Check for Rakken Signature or Rakken Style specifically
              if (groupName.includes('signature')) cat = 'rakken-signature';
              else if (groupName.includes('style')) cat = 'rakken-style';

              return {
                id: idx,
                menuItem: { name },
                quantity: Number(item.qty || item.quantity || 1),
                size: item.variant_name || '-',
                subtotal: Number(item.price || 0),
                categorySlug: cat,
                notes: item.notes || item.note || '',
              };
            }),
          };
        });

        console.log(`[API] Returning ${orders.length} normalized orders to KDS`);

        // 6. If filtering for KDS (status provided), restrict to active only
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
