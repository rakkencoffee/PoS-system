import { NextRequest, NextResponse } from 'next/server';
import { pusherServer } from '@/lib/pusher';
import { prisma } from '@/lib/db';
import { getMenuItems } from '@/lib/integrations/pos.adapter';
import { logOrderStatusChange } from '@/lib/order-status-log';

const USE_OLSERA = process.env.USE_OLSERA === 'true';

// PATCH can wait up to ~9s for the checkout background sync to land before
// self-healing — stay well clear of the platform's default function timeout.
export const maxDuration = 30;

function isNonCoffeeItem(category: string, name: string): boolean {
  const cat = String(category || '').toLowerCase().trim();
  const itemName = String(name || '').toLowerCase().trim();
  return (
    cat === 'non-coffee' || 
    cat === 'non coffee' ||
    cat === 'milk-based' ||
    cat === 'refreshment' ||
    itemName.includes('tea') ||
    itemName.includes('milk') ||
    itemName.includes('matcha') ||
    (itemName.includes('latte') && !itemName.includes('coffee') && !itemName.includes('espresso'))
  );
}

function distributeItemsDiscount(items: any[], discount: number, totalAmount: number): any[] {
  if (!discount || discount <= 0 || !items || items.length === 0) {
    return items.map(item => ({ ...item, discount: 0 }));
  }

  const isNonCoffee = (i: any) => {
    const cat = i.categorySlug || '';
    const name = i.menuItem?.name || i.name || '';
    return isNonCoffeeItem(cat, name);
  };

  const hasNonCoffee = items.some(i => isNonCoffee(i));
  const hasOtherThanNonCoffee = items.some(i => !isNonCoffee(i));
  const isRestrictedToNonCoffee = hasNonCoffee && hasOtherThanNonCoffee && discount < totalAmount * 0.22;

  let eligibleItems = items;
  if (isRestrictedToNonCoffee) {
    eligibleItems = items.filter(i => isNonCoffee(i));
  }
  if (eligibleItems.length === 0) {
    eligibleItems = items;
  }

  const eligibleSum = eligibleItems.reduce((sum, i) => sum + ((i.price || i.subtotal || 0) * (i.quantity || 1)), 0);
  let remainingD = discount;

  const enrichedItems = items.map(item => ({ ...item, discount: 0 }));

  if (eligibleSum > 0) {
    eligibleItems.forEach((eligibleItem, idx) => {
      const targetItem = enrichedItems.find(ei => ei.id === eligibleItem.id);
      if (targetItem) {
        let itemD = 0;
        if (idx === eligibleItems.length - 1) {
          itemD = remainingD;
        } else {
          const itemPrice = targetItem.price || targetItem.subtotal || 0;
          const share = (itemPrice * (targetItem.quantity || 1)) / eligibleSum;
          itemD = Math.round(discount * share);
          remainingD -= itemD;
        }
        targetItem.discount = itemD;
      }
    });
  }

  return enrichedItems;
}


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const refresh = request.nextUrl.searchParams.get('refresh') === 'true';

    // Handle Olsera order IDs (e.g. "OLSERA-1262474270")
    if (USE_OLSERA && id.startsWith('OLSERA-')) {
      const olseraOrderId = parseInt(id.replace('OLSERA-', ''));
      const olsera = await import('@/lib/integrations/olsera.service');

      // Fetch menu items for category mapping globally for this request
      let menuItems: any[] = [];
      try {
        const { getMenuItems } = await import('@/lib/integrations/pos.adapter');
        menuItems = await getMenuItems();
      } catch (mErr) {}
      const catMap = new Map();
      menuItems.forEach(m => catMap.set(m.name, m.categorySlug));

      // Fetch stored full order details from local Prisma
      let localOrder: any = null;
      let storedQueueNumber: number | null = null;
      let localCreatedAt: string | null = null;
      try {
        localOrder = await prisma.order.findUnique({
          where: { id: id },
          include: { items: true }
        });
        storedQueueNumber = localOrder?.queueNumber || null;
        localCreatedAt = localOrder?.createdAt ? localOrder.createdAt.toISOString() : null;
      } catch (_) {}
      const displayQueue = storedQueueNumber || (olseraOrderId % 1000);

      try {
        const orderDetail = await olsera.getOrderDetail(olseraOrderId, refresh);
        
        // Normalize Olsera response to match our frontend format
        const items = Array.isArray(orderDetail.items) ? orderDetail.items : [];
        let kdsStatus = 'PENDING';
        const oStatus = orderDetail.status?.toUpperCase() || '';
        
        if (oStatus === 'A') kdsStatus = 'PREPARING';
        else if (oStatus === 'Z' || oStatus === 'S' || oStatus === 'T') kdsStatus = 'COMPLETED';
        else if (orderDetail.payment_status === '1' || orderDetail.payment_status === 'paid') {
          kdsStatus = 'PENDING'; // Paid but not yet prepared
        }

        // Determine base data from Olsera
        const olseraItems = Array.isArray(orderDetail.items) ? orderDetail.items : [];
        let totalAmount = localOrder?.total ?? parseFloat(orderDetail.total || orderDetail.grand_total || '0');
        let finalItems = olseraItems.map((item: any, idx: number) => {
          const name = item.product_name || item.name || 'Item';
          return {
            id: idx,
            menuItem: { name },
            quantity: item.qty || item.quantity || 1,
            price: parseFloat(item.price || item.product_price || '0'),
            size: item.variant_name || '-',
            notes: item.notes || item.note || item.item_notes || '',
            categorySlug: catMap.get(name) || 'other',
            discount: parseFloat(item.discount || '0'),
          };
        });

        // FALLBACK: If Olsera has no items or 0 total, fetch from local Prisma mirror
        // This is the most robust way to handle Olsera's sync delays.
        if (totalAmount === 0 || finalItems.length === 0 || finalItems.every((i: any) => i.price === 0)) {
          console.log(`[Sync] Olsera data incomplete for ${id}, fetching from local Prisma fallback...`);
          try {
            if (localOrder) {
              totalAmount = localOrder.total;
              finalItems = localOrder.items.map((item: any, idx: number) => {
                // Try to extract size from notes if notes contains "Size: ..."
                let displaySize = '-';
                const sizeMatch = item.notes?.match(/Size: ([^,)]+)/);
                if (sizeMatch) displaySize = sizeMatch[1];

                return {
                  id: idx,
                  menuItem: { name: item.name },
                  quantity: item.quantity,
                  price: item.price,
                  notes: item.notes,
                  size: displaySize,
                  categorySlug: catMap.get(item.name) || 'other',
                };
              });
              console.log(`[Sync] Successfully used local fallback for ${id}. Total: ${totalAmount}`);
            }
          } catch (prismaError) {
            console.error('[Sync] Local fallback failed:', prismaError);
          }
        } else {
          // ENRICH NOTES & PRICES: Olsera's OpenOrder API frequently drops the notes payload and lacks custom prices.
          // We MUST retrieve them from our local Prisma mirror where we saved them at checkout.
          try {
            if (localOrder && localOrder.items && localOrder.items.length > 0) {
              // We copy the items array so we can remove matched items and avoid duplicate assignments
              const availableLocalItems = [...localOrder.items];
              
              finalItems = finalItems.map((fItem: any) => {
                // Find a matching item by name and quantity (or just name if quantity differs slightly)
                const matchIdx = availableLocalItems.findIndex((li: any) => 
                  li.name.toLowerCase() === fItem.menuItem.name.toLowerCase()
                );
                
                if (matchIdx !== -1) {
                  const lItem = availableLocalItems[matchIdx];
                  // Remove it from available so we don't match the same local item twice if they ordered 2 of the same drink separately
                  availableLocalItems.splice(matchIdx, 1);
                  
                  // Enrich both price and notes from our local mirror where all custom toppings are factored in
                  fItem.price = lItem.price;

                  if (lItem.notes) {
                    fItem.notes = fItem.notes ? `${fItem.notes}, ${lItem.notes}` : lItem.notes;
                    // Also try to extract Size if Olsera didn't return it
                    const sizeMatch = lItem.notes.match(/Size:\s*([^,)]+)/i);
                    if (sizeMatch && (!fItem.size || fItem.size === '-')) {
                      fItem.size = sizeMatch[1];
                    }
                  }
                }
                return fItem;
              });
              console.log(`[Sync] Successfully enriched notes and prices from local fallback for ${id}`);
            }
          } catch (e) {
            console.error('[Sync] Local notes enrichment failed:', e);
          }
        }

        // Calculate total discount - Prioritize summing up individual item discounts if synced, then fallback to Olsera discount_amount
        let discount = finalItems.reduce((sum: number, item: any) => sum + (item.discount || 0), 0);
        
        if (discount === 0) {
          // Olsera's discount_amount can be a truthy string like "0", which would
          // otherwise short-circuit past the (more reliable) local calculation below.
          const olseraDiscount = orderDetail?.discount_amount ? parseFloat(orderDetail.discount_amount) : 0;
          if (olseraDiscount > 0) {
            discount = olseraDiscount;
          } else if (localOrder) {
            const baseTotal = localOrder.items.reduce((acc: number, item: any) => acc + item.price * item.quantity, 0);
            discount = Math.max(0, baseTotal - localOrder.total);
          }
        }

        const hasItemDiscounts = finalItems.some((item: any) => item.discount && item.discount > 0);
        const discountedItems = hasItemDiscounts 
          ? finalItems 
          : distributeItemsDiscount(finalItems, discount, totalAmount);

        return NextResponse.json({
          id: id,
          orderNo: orderDetail.order_no || '',
          queueNumber: displayQueue,
          status: kdsStatus,
          totalAmount: totalAmount,
          discount: discount,
          customerName: orderDetail.customer_name || '',
          createdAt: localCreatedAt || orderDetail.order_date || new Date().toISOString(),
          items: discountedItems,
        });
      } catch (olseraError) {
        console.warn(`Order ${olseraOrderId} not in open orders, checking closed orders...`);
        try {
          const closedOrder = await olsera.getClosedOrderDetail(olseraOrderId);
          const items = Array.isArray(closedOrder.items) ? closedOrder.items : [];
          
            let finalClosedItems = items.map((item: any, idx: number) => {
              const name = item.product_name || item.name || 'Item';
              return {
                id: idx,
                menuItem: { name },
                quantity: item.qty || item.quantity || 1,
                size: item.variant_name || '-',
                notes: item.notes || item.note || item.item_notes || '',
                categorySlug: catMap?.get(name) || 'other',
                discount: parseFloat(item.discount || '0'),
              };
            });
            
            // Enrich notes from local DB for closed orders too
            try {
              const localOrder = await prisma.order.findUnique({
                where: { id: id },
                include: { items: true }
              });

              if (localOrder && localOrder.items && localOrder.items.length > 0) {
                const availableLocalItems = [...localOrder.items];
                finalClosedItems = finalClosedItems.map((fItem: any) => {
                  const matchIdx = availableLocalItems.findIndex((li: any) => 
                    li.name.toLowerCase() === fItem.menuItem.name.toLowerCase()
                  );
                  if (matchIdx !== -1) {
                    const lItem = availableLocalItems[matchIdx];
                    availableLocalItems.splice(matchIdx, 1);
                    if (lItem.notes) {
                      fItem.notes = fItem.notes ? `${fItem.notes}, ${lItem.notes}` : lItem.notes;
                      const sizeMatch = lItem.notes.match(/Size:\s*([^,)]+)/i);
                      if (sizeMatch && (!fItem.size || fItem.size === '-')) {
                        fItem.size = sizeMatch[1];
                      }
                    }
                  }
                  return fItem;
                });
              }
            } catch (e) {}

            // Calculate total discount - Prioritize summing up individual item discounts if synced, then fallback to Olsera discount_amount
            let closedDiscount = finalClosedItems.reduce((sum: number, item: any) => sum + (item.discount || 0), 0);
            
            if (closedDiscount === 0) {
              const olseraClosedDiscount = closedOrder?.discount_amount ? parseFloat(closedOrder.discount_amount) : 0;
              if (olseraClosedDiscount > 0) {
                closedDiscount = olseraClosedDiscount;
              } else if (localOrder) {
                const baseTotal = localOrder.items.reduce((acc: number, item: any) => acc + item.price * item.quantity, 0);
                closedDiscount = Math.max(0, baseTotal - localOrder.total);
              }
            }

            const closedTotalAmount = parseFloat(closedOrder.total || closedOrder.grand_total || '0');
            const hasClosedItemDiscounts = finalClosedItems.some((item: any) => item.discount && item.discount > 0);
            const discountedClosedItems = hasClosedItemDiscounts 
              ? finalClosedItems 
              : distributeItemsDiscount(finalClosedItems, closedDiscount, closedTotalAmount);

            return NextResponse.json({
              id: id,
              orderNo: closedOrder.order_no || '',
              queueNumber: displayQueue,
              status: 'COMPLETED', // Found in closed orders, must be completed
              totalAmount: closedTotalAmount,
              discount: closedDiscount,
              customerName: closedOrder.customer_name || '',
              createdAt: localCreatedAt || closedOrder.order_date || new Date().toISOString(),
              items: discountedClosedItems,
            });
        } catch (closedError) {
          console.error('Order not found even in closed orders:', closedError);
          // Calculate local discount
          let localDiscount = 0;
          if (localOrder) {
            const baseTotal = localOrder.items.reduce((acc: number, item: any) => acc + item.price * item.quantity, 0);
            localDiscount = Math.max(0, baseTotal - localOrder.total);
          }

          const mappedItems = localOrder?.items?.map((item: any, idx: number) => ({
            id: idx,
            menuItem: { name: item.name },
            quantity: item.quantity,
            price: item.price,
            notes: item.notes,
            size: item.notes?.match(/Size: ([^,)]+)/)?.[1] || '-',
            categorySlug: catMap?.get(item.name) || 'other',
          })) || [];

          const discountedLocalItems = distributeItemsDiscount(mappedItems, localDiscount, localOrder?.total || 0);

          // Return the local status if we have it, instead of hardcoded 'PENDING'
          return NextResponse.json({
            id: id,
            orderNo: localOrder?.olseraTransactionId ? `OLSERA-${localOrder.olseraTransactionId}` : '',
            queueNumber: displayQueue,
            status: localOrder?.status || 'PENDING',
            totalAmount: localOrder?.total || 0,
            discount: localDiscount,
            createdAt: localCreatedAt || new Date().toISOString(),
            items: discountedLocalItems,
          });
        }
      }
    } else {
      throw new Error("Local database (Prisma) is no longer supported. Invalid Order ID format.");
    }
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

    // Olsera orders: update state locally and emit SSE event
    if (id.startsWith('OLSERA-')) {
      const olsera = await import('@/lib/integrations/olsera.service');
      
      // Normalize the ID for processing
      let olseraOrderId = 0;
      if (!id.includes('TEST')) {
        olseraOrderId = parseInt(id.replace('OLSERA-', ''));
      }

      let detail: any = null;
      let localOrder: any = null;

      // 1. Handle mock orders (TEST01, etc) by skipping Olsera sync
      if (id.includes('TEST')) {
        console.log(`[Mock Order] Skipping Olsera sync for test order ${id}`);
      } else {
        // Station-specific logic
        const stationType = body.stationType; // 'barista' or 'kitchen'
        const newKdsStatus = body.status; // 'PREPARING' or 'COMPLETED'
        
        console.log(`[Update] Station ${stationType} updating order ${id} to ${newKdsStatus}`);

        // 1. Get or Create local order record in Prisma
        localOrder = await prisma.order.findUnique({ where: { id } });

        // checkout's createOrder() mirrors the order to Prisma in the
        // background (with items, queueNumber, etc.) — but only AFTER
        // syncing items to Olsera first, which alone retries for up to
        // ~5.5s. If a barista/kitchen action lands before that write
        // finishes, give it real time to show up instead of immediately
        // self-healing with a skeleton record. Self-healing that early
        // loses the real items/queueNumber permanently (the background
        // write later fails on the duplicate id and gives up), which also
        // skips print-job creation entirely.
        for (let attempt = 0; !localOrder && attempt < 6; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          localOrder = await prisma.order.findUnique({ where: { id } });
        }

        if (!localOrder) {
          console.log(`[Sync] Creating local record for Olsera order ${id}`);
          detail = await olsera.getOrderDetail(olseraOrderId);
          const rawItems = detail.items || detail.orderitems || [];
          
          // Build category lookup
          let menuItems: any[] = [];
          try {
            menuItems = await getMenuItems();
          } catch (mErr) {}
          const catMap = new Map();
          menuItems.forEach(m => catMap.set(m.name, m.categorySlug));

          // Basic category detection matching client-side KDS logic
          const hasCoffee = rawItems.some((i: any) => {
            const name = i.product_name || i.name || '';
            const categorySlug = catMap.get(name);
            return ['rakken-signature', 'rakken-style'].includes(categorySlug);
          });
          const hasFood = rawItems.some((i: any) => {
            const name = i.product_name || i.name || '';
            const categorySlug = catMap.get(name);
            return !['rakken-signature', 'rakken-style'].includes(categorySlug);
          });

          // Fetch a valid user for cashierId to prevent Prisma foreign key constraints
          let firstUser = await prisma.user.findFirst();
          if (!firstUser) {
            // Auto-create a fallback SYSTEM user if DB is completely empty
            firstUser = await prisma.user.create({
              data: {
                id: 'SYSTEM',
                name: 'System Auto',
                username: 'system_auto',
                passwordHash: 'none',
                role: 'ADMIN'
              }
            });
          }
          const validCashierId = firstUser.id;

          localOrder = await (prisma.order as any).create({
            data: {
              id: id,
              stationId: 'OLSERA',
              cashierId: validCashierId,
              total: Math.round(Number(detail.total || 0)),
              status: 'PENDING',
              baristaStatus: hasCoffee ? 'PENDING' : 'COMPLETED',
              kitchenStatus: hasFood ? 'PENDING' : 'COMPLETED',
              olseraTransactionId: String(olseraOrderId),
              olseraSynced: true
            }
          });
        }

        // 2. Update the specific station's status
        const updateData: any = {};
        if (stationType === 'barista') updateData.baristaStatus = newKdsStatus;
        else if (stationType === 'kitchen') updateData.kitchenStatus = newKdsStatus;
        else updateData.status = newKdsStatus; // Fallback

        const prevBaristaStatus = localOrder.baristaStatus;
        const prevKitchenStatus = localOrder.kitchenStatus;

        localOrder = await (prisma.order as any).update({
          where: { id },
          data: updateData
        });

        if (stationType === 'barista' && prevBaristaStatus !== localOrder.baristaStatus) {
          await logOrderStatusChange({
            orderId: id, statusField: 'barista',
            fromStatus: prevBaristaStatus, toStatus: localOrder.baristaStatus,
            source: 'kds_manual', metadata: { stationType },
          });
        } else if (stationType === 'kitchen' && prevKitchenStatus !== localOrder.kitchenStatus) {
          await logOrderStatusChange({
            orderId: id, statusField: 'kitchen',
            fromStatus: prevKitchenStatus, toStatus: localOrder.kitchenStatus,
            source: 'kds_manual', metadata: { stationType },
          });
        }

        // 3. Determine overall Olsera status
        let olseraStatus: 'P' | 'A' | 'S' | 'Z' | 'X' = 'P';
        let localStatus: 'PENDING' | 'PREPARING' | 'COMPLETED' = 'PENDING';
        
        // If BOTH are completed, overall is completed
        if (localOrder.baristaStatus === 'COMPLETED' && localOrder.kitchenStatus === 'COMPLETED') {
          olseraStatus = 'Z';
          localStatus = 'COMPLETED';
        }
        // If either is preparing, or one is completed while the other is pending/preparing:
        // overall should be preparing (A) so it stays confirmed ("konfirmasi") in backoffice
        else if (
          localOrder.baristaStatus === 'PREPARING' || 
          localOrder.kitchenStatus === 'PREPARING' ||
          localOrder.baristaStatus === 'COMPLETED' || 
          localOrder.kitchenStatus === 'COMPLETED'
        ) {
          olseraStatus = 'A';
          localStatus = 'PREPARING';
        }

        // Update overall local order status if changed
        if (localOrder.status !== localStatus) {
          const prevOverallStatus = localOrder.status;
          localOrder = await prisma.order.update({
            where: { id },
            data: { status: localStatus }
          });
          await logOrderStatusChange({
            orderId: id, statusField: 'order',
            fromStatus: prevOverallStatus, toStatus: localStatus,
            source: 'kds_manual', metadata: { stationType },
          });
        }

        try {
          // Only sync if Olsera status needs to change
          await olsera.updateOrderStatus(olseraOrderId, olseraStatus);
          console.log(`Successfully synced Olsera order ${olseraOrderId} to combined status ${olseraStatus}`);
        } catch (err: any) {
          console.error('Initial sync failed for order:', olseraOrderId, err.message);
          
          if (err.message.includes('406') || err.message.includes('payment info')) {
            // Unpaid orders cannot be processed by the kitchen
            // Do NOT auto-pay them, as it will falsify financial records
            return NextResponse.json({ 
              error: 'Pesanan Belum Dibayar',
              details: 'Pesanan ini belum lunas di Olsera. Harap selesaikan pembayaran sebelum memproses pesanan di dapur.'
            }, { status: 400 });
          } else {
            return NextResponse.json({ error: 'Failed to sync status to Olsera' }, { status: 500 });
          }
        }
      }

      // Fetch detail if not already fetched during self-healing
      if (!detail && !id.includes('TEST')) {
        try {
          detail = await olsera.getOrderDetail(olseraOrderId);
        } catch (detailError) {
          console.warn(`Could not find order ${olseraOrderId} in open orders after status update, checking closed orders...`);
          try {
            detail = await olsera.getClosedOrderDetail(olseraOrderId);
          } catch (closedError: any) {
            console.error(`Status update likely succeeded but could not fetch final detail:`, closedError.message);
            // Don't throw here, we'll format a minimal response based on body status
          }
        }
      }

      // Build category lookup for final response
      let menuItems: any[] = [];
      try {
        menuItems = await getMenuItems();
      } catch (mErr) {}
      const catMap = new Map();
      menuItems.forEach(m => catMap.set(m.name, m.categorySlug));

      const updatedOrder = {
        id: id,
        orderNo: detail?.order_no || '',
        queueNumber: localOrder?.queueNumber || (olseraOrderId ? (olseraOrderId % 1000) : parseInt(id.replace(/[^0-9]/g, '').slice(-3) || '123')),
        status: localOrder ? localOrder.status : body.status,
        baristaStatus: localOrder?.baristaStatus,
        kitchenStatus: localOrder?.kitchenStatus,
        totalAmount: detail ? (detail.total || detail.grand_total || 0) : 0,
        paymentMethod: 'MIDTRANS',
        createdAt: detail ? (detail.order_date || detail.created_at || new Date().toISOString()) : new Date().toISOString(),
        customerName: detail?.customer_name || '',
        items: detail && Array.isArray(detail.items) ? detail.items.map((item: any, idx: number) => {
          const name = item.product_name || item.name || 'Item';
          return {
            id: idx,
            menuItem: { name },
            quantity: item.qty || item.quantity || 1,
            size: item.variant_name || '-',
            notes: item.notes || item.note || item.item_notes || '',
            categorySlug: catMap.get(name) || 'other',
          };
        }) : [],
      };

      // Broadcast via Pusher so KDS updates in real-time
      try {
        await pusherServer.trigger('kitchen', 'ORDER_UPDATED', { order: updatedOrder });
        console.log(`[Pusher] ORDER_UPDATED broadcast for ${id}`);
      } catch (pusherErr) {
        console.warn('[Pusher] Failed to broadcast ORDER_UPDATED:', pusherErr);
      }

      return NextResponse.json(updatedOrder);
    } else {
      throw new Error("Local database (Prisma) is no longer supported for updating orders.");
    }
  } catch (error: any) {
    console.error('Error updating order:', error);
    return NextResponse.json({ 
      error: 'Failed to update order',
      details: error?.message || String(error),
      stack: error?.stack 
    }, { status: 500 });
  }
}
