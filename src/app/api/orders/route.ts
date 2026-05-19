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

        // 3. Fetch local order statuses from Prisma to merge with Olsera data
        const { prisma } = await import('@/lib/db');
        const localOrders = await (prisma.order as any).findMany({
          where: {
            id: { in: activeOrdersToEnrich.map(o => `OLSERA-${o.id || o.order_id}`) }
          },
          include: { items: true }
        });
        const localMap = new Map(localOrders.map((lo: any) => [lo.id, lo]));

        // 4. Fetch details for each active order sequentially with rate limit protection
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

        // 4. Fetch master menu to map categories accurately based on product names
        // This is the most reliable fallback if order details lack category info.
        const { getMenuItems } = await import('@/lib/integrations/pos.adapter');
        const menuItemsMaster = await getMenuItems();
        const masterCategoryMap = new Map();
        menuItemsMaster.forEach(m => masterCategoryMap.set(m.name.toLowerCase(), m.categorySlug));

        // 5. Normalize enriched orders
        orders = enrichedOrders.map((order: any) => {
          let kdsStatus = 'PENDING';
          const oStatus = (order.status || '').toUpperCase();
          const numericId = order.id || order.order_id;
          
          const localData = localMap.get(`OLSERA-${numericId}`) as any;
          
          if (oStatus === 'A') kdsStatus = 'PREPARING';
          else if (oStatus === 'Z' || oStatus === 'T') kdsStatus = 'COMPLETED';
          else kdsStatus = 'PENDING';

          let pMethod = order.payment_mode_name || order.payment_method || 'MIDTRANS';
          if (pMethod === '1' || pMethod === 'Cash') pMethod = 'CASH';

          const rawItems = order.items || order.orderitems || order.order_items || [];
          
          // Get local items for notes enrichment (RULE 6: Olsera drops notes)
          const localItems = localData?.items || [];
          const availableLocalItems = [...localItems];
          
          const normalizedItems = rawItems.map((item: any, idx: number) => {
            const name = item.product_name || item.name || 'Item';
            let cat = masterCategoryMap.get(name.toLowerCase()) || 'other';
            if (cat === 'other') {
              const groupName = (item.product_group_name || item.group_name || item.category_name || item.klasifikasi || '').toLowerCase();
              if (groupName.includes('signature')) cat = 'rakken-signature';
              else if (groupName.includes('style')) cat = 'rakken-style';
            }
            
            // Enrich notes from local Prisma (customization details)
            let enrichedNotes = item.notes || item.note || '';
            const localMatchIdx = availableLocalItems.findIndex((li: any) => 
              li.name.toLowerCase() === name.toLowerCase()
            );
            if (localMatchIdx !== -1) {
              const localItem = availableLocalItems[localMatchIdx];
              availableLocalItems.splice(localMatchIdx, 1);
              if (localItem.notes && localItem.notes.length > enrichedNotes.length) {
                enrichedNotes = localItem.notes;
              }
            }
            
            return {
              id: idx,
              menuItem: { name },
              quantity: Number(item.qty || item.quantity || 1),
              size: item.variant_name || '-',
              subtotal: Number(item.price || 0),
              categorySlug: cat,
              notes: enrichedNotes,
            };
          });

          // Determine station-specific statuses
          // If no local data exists, use Olsera's global status as default
          let baristaStatus = localData?.baristaStatus || kdsStatus;
          let kitchenStatus = localData?.kitchenStatus || kdsStatus;

          // AUTO-COMPLETE station if it has no relevant items
          const hasCoffee = normalizedItems.some((i: any) => ['rakken-signature', 'rakken-style'].includes(i.categorySlug));
          const hasKitchen = normalizedItems.some((i: any) => !['rakken-signature', 'rakken-style'].includes(i.categorySlug));

          if (!hasCoffee) baristaStatus = 'COMPLETED';
          if (!hasKitchen) kitchenStatus = 'COMPLETED';

          // Extract customer name from Olsera order detail
          const customerName = order.customer_name || order.customer?.name || '';
          
          // Extract the backoffice order number (format: OL26051500000205)
          const orderNo = order.order_no || '';
          
          return {
            id: `OLSERA-${numericId}`,
            orderNo: orderNo,
            queueNumber: localData?.queueNumber || (numericId % 1000),
            status: kdsStatus,
            baristaStatus,
            kitchenStatus,
            totalAmount: Number(order.total || order.total_amount || order.grand_total || 0),
            paymentMethod: pMethod,
            createdAt: localData?.createdAt || order.order_date || order.created_at || new Date().toISOString(),
            customerName: customerName,
            items: normalizedItems,
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
