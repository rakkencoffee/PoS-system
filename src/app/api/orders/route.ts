import { NextRequest, NextResponse } from 'next/server';

const USE_OLSERA = process.env.USE_OLSERA === 'true';

/**
 * Start of "today" in WIB (UTC+7), as a UTC Date instant -- matches the
 * WIB-day convention already used by getNextQueueNumber() in queue-number.ts.
 * Vercel functions run in UTC, so a naive `setHours(0,0,0,0)` would reset at
 * UTC midnight (07:00 WIB) instead of local midnight, cutting the "today"
 * window short by 7 hours.
 */
function startOfTodayWIB(): Date {
  const wibOffsetMs = 7 * 60 * 60 * 1000;
  const wibNow = new Date(Date.now() + wibOffsetMs);
  const wibMidnightAsUTC = new Date(Date.UTC(wibNow.getUTCFullYear(), wibNow.getUTCMonth(), wibNow.getUTCDate()));
  return new Date(wibMidnightAsUTC.getTime() - wibOffsetMs);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const today = searchParams.get('today');

    if (USE_OLSERA) {
      const olsera = await import('@/lib/integrations/olsera.service');
      const { prisma } = await import('@/lib/db');
      let orders: any[] = [];

      try {
        let activeOrdersToEnrich: any[] = [];
        let localMap = new Map<string, any>();

        if (today === 'true') {
          // "Active for KDS" must come from OUR OWN baristaStatus/kitchenStatus,
          // not Olsera's order status/paid list -- Olsera can transition an
          // order to a closed status within seconds of our instant-settlement
          // (payment is simulated, not a real gateway round-trip), well before
          // staff have actually made the drink/food. Filtering on Olsera's
          // list status here made paid orders vanish off the KDS board under a
          // minute after being placed (confirmed via production logs 2026-09-01).
          const localActiveOrders = await prisma.order.findMany({
            where: {
              createdAt: { gte: startOfTodayWIB() },
              status: { not: 'CANCELLED' },
              NOT: { baristaStatus: 'COMPLETED', kitchenStatus: 'COMPLETED' },
            },
            include: { items: true },
            orderBy: { createdAt: 'asc' },
            take: 50,
          });
          localMap = new Map(localActiveOrders.map((lo) => [lo.id, lo]));
          // olseraTransactionId is only ever populated by a rare recovery
          // path, not the normal create flow -- filtering on it here (an
          // earlier version of this fix did) silently matched zero orders
          // every time, confirmed via production logs 2026-09-01 right
          // after placing a fresh order. Order.id is always `OLSERA-<id>`
          // (or `OFFLINE-<id>`) per pos.adapter.ts's early synchronous
          // create, so extract the numeric id from there instead.
          activeOrdersToEnrich = localActiveOrders
            .map((lo) => ({ id: lo.id.replace(/^OLSERA-/, '').replace(/^OFFLINE-/, '') }))
            .filter((o) => o.id);

          console.log(`[API] Local active orders (not fully completed) today: ${activeOrdersToEnrich.length}`);
        } else {
          // 1. Fetch List of Orders from Olsera
          const rawList = await olsera.olseraFetch('/order/openorder?per_page=100').then(res => res.json().then(d => d.data || d || []));

          // 2. Identify "Active" orders that need details (Pending/Preparing)
          const allPotentialOrders = (Array.isArray(rawList) ? rawList : []);
          activeOrdersToEnrich = allPotentialOrders
            .filter(o => {
              const status = (o.status || '').toUpperCase();
              const isPaid = o.is_paid === true ||
                             o.is_paid === 1 ||
                             o.is_paid === '1' ||
                             o.payment_status === '1' ||
                             o.payment_status === 'paid' ||
                             o.payment_status_name === 'Paid' ||
                             o.payment_status_name === 'Lunas';
              return status !== 'Z' && status !== 'T' && isPaid; // ONLY paid orders
            })
            .slice(0, 50);

          console.log(`[API] Total list items: ${allPotentialOrders.length}, Active to enrich: ${activeOrdersToEnrich.length}`);

          // 3. Fetch local order statuses from Prisma to merge with Olsera data
          const localOrders = await (prisma.order as any).findMany({
            where: {
              id: { in: activeOrdersToEnrich.map(o => `OLSERA-${o.id || o.order_id}`) }
            },
            include: { items: true }
          });
          localMap = new Map(localOrders.map((lo: any) => [lo.id, lo]));
        }

        // 4. Fetch details for active orders in small concurrent batches.
        // getOrderDetail() already has its own 429 detection + backoff retry,
        // so a fixed per-call sleep here was redundant on top of that — this
        // caps concurrency instead of either serializing everything or firing
        // all requests at once.
        const DETAIL_FETCH_CONCURRENCY = 5;
        const enrichedOrders: any[] = [];
        for (let i = 0; i < activeOrdersToEnrich.length; i += DETAIL_FETCH_CONCURRENCY) {
          const batch = activeOrdersToEnrich.slice(i, i + DETAIL_FETCH_CONCURRENCY);
          const batchResults = await Promise.all(batch.map(async (o) => {
            try {
              const numericId = o.id || o.order_id;
              const detail = await olsera.getOrderDetail(numericId);
              return { ...o, ...detail };
            } catch (err) {
              console.error(`[API] Failed to fetch detail for order ${o.id}:`, err);
              return {
                ...o,
                items: [{ product_name: 'Menu (Detail Loading...)', qty: 1, group_name: 'Other' }]
              };
            }
          }));
          enrichedOrders.push(...batchResults);
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
          
          if (localData) {
            // Local baristaStatus/kitchenStatus is authoritative when we have
            // it -- Olsera's own status (oStatus below) can say "closed"
            // while staff are still actively preparing the order.
            const bothCompleted = localData.baristaStatus === 'COMPLETED' && localData.kitchenStatus === 'COMPLETED';
            const anyPreparing = localData.baristaStatus === 'PREPARING' || localData.kitchenStatus === 'PREPARING';
            kdsStatus = bothCompleted ? 'COMPLETED' : anyPreparing ? 'PREPARING' : 'PENDING';
          } else if (oStatus === 'A') kdsStatus = 'PREPARING';
          else if (oStatus === 'Z' || oStatus === 'S' || oStatus === 'T') kdsStatus = 'COMPLETED';
          else kdsStatus = 'PENDING';

          let pMethod = order.payment_mode_name || order.payment_method || 'SIMULATED';
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
            totalAmount: localData?.total || Number(order.total || order.total_amount || order.grand_total || 0),
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
