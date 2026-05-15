import { NextRequest, NextResponse } from 'next/server';
import { pusherServer } from '@/lib/pusher';
import { prisma } from '@/lib/db';
import { getMenuItems } from '@/lib/integrations/pos.adapter';

const USE_OLSERA = process.env.USE_OLSERA === 'true';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

      try {
        const orderDetail = await olsera.getOrderDetail(olseraOrderId);
        
        // Normalize Olsera response to match our frontend format
        const items = Array.isArray(orderDetail.items) ? orderDetail.items : [];
        let kdsStatus = 'PENDING';
        const oStatus = orderDetail.status?.toUpperCase() || '';
        
        if (oStatus === 'A') kdsStatus = 'PREPARING';
        else if (oStatus === 'Z') kdsStatus = 'COMPLETED';
        else if (orderDetail.payment_status === '1' || orderDetail.payment_status === 'paid') {
          kdsStatus = 'PENDING'; // Paid but not yet prepared
        }

        // Determine base data from Olsera
        const olseraItems = Array.isArray(orderDetail.items) ? orderDetail.items : [];
        let totalAmount = parseFloat(orderDetail.total || orderDetail.grand_total || '0');
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
          };
        });

        // FALLBACK: If Olsera has no items or 0 total, fetch from local Prisma mirror
        // This is the most robust way to handle Olsera's sync delays.
        if (totalAmount === 0 || finalItems.length === 0 || finalItems.every((i: any) => i.price === 0)) {
          console.log(`[Sync] Olsera data incomplete for ${id}, fetching from local Prisma fallback...`);
          try {
            const localOrder = await prisma.order.findUnique({
              where: { id: id },
              include: { items: true }
            });

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
          // ENRICH NOTES: Olsera's OpenOrder API frequently drops the notes payload.
          // We MUST retrieve the notes from our local Prisma mirror where we saved them at checkout.
          try {
            const localOrder = await prisma.order.findUnique({
              where: { id: id },
              include: { items: true }
            });

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
              console.log(`[Sync] Successfully enriched notes from local fallback for ${id}`);
            }
          } catch (e) {
            console.error('[Sync] Local notes enrichment failed:', e);
          }
        }

        return NextResponse.json({
          id: id,
          queueNumber: olseraOrderId % 1000,
          status: kdsStatus,
          totalAmount: totalAmount,
          createdAt: orderDetail.order_date || new Date().toISOString(),
          items: finalItems,
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

            return NextResponse.json({
              id: id,
              queueNumber: olseraOrderId % 1000,
              status: 'COMPLETED', // Found in closed orders, must be completed
              totalAmount: parseFloat(closedOrder.total || closedOrder.grand_total || '0'),
              createdAt: closedOrder.order_date || new Date().toISOString(),
              items: finalClosedItems,
            });
        } catch (closedError) {
          console.error('Order not found even in closed orders:', closedError);
          // Return a minimal order object as last resort
          return NextResponse.json({
            id: id,
            queueNumber: olseraOrderId % 1000,
            status: 'PENDING',
            totalAmount: 0,
            createdAt: new Date().toISOString(),
            items: [],
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
        
        if (!localOrder) {
          console.log(`[Sync] Creating local record for Olsera order ${id}`);
          detail = await olsera.getOrderDetail(olseraOrderId);
          const rawItems = detail.items || detail.orderitems || [];
          
          // Basic category detection for initial status
          const hasCoffee = rawItems.some((i: any) => {
            const name = (i.product_name || '').toLowerCase();
            return name.includes('coffee') || name.includes('signature') || name.includes('style');
          });
          const hasFood = rawItems.some((i: any) => {
            const name = (i.product_name || '').toLowerCase();
            return !name.includes('coffee') && !name.includes('signature') && !name.includes('style');
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

        localOrder = await (prisma.order as any).update({
          where: { id },
          data: updateData
        });

        // 3. Determine overall Olsera status
        let olseraStatus: 'P' | 'A' | 'S' | 'Z' | 'X' = 'P';
        
        // If either station is preparing, overall is preparing
        if (localOrder.baristaStatus === 'PREPARING' || localOrder.kitchenStatus === 'PREPARING') {
          olseraStatus = 'A';
        }
        // If BOTH are completed, overall is completed
        if (localOrder.baristaStatus === 'COMPLETED' && localOrder.kitchenStatus === 'COMPLETED') {
          olseraStatus = 'Z';
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
        queueNumber: olseraOrderId % 1000,
        status: localOrder ? localOrder.status : body.status,
        baristaStatus: localOrder?.baristaStatus,
        kitchenStatus: localOrder?.kitchenStatus,
        totalAmount: detail ? (detail.total || detail.grand_total || 0) : 0,
        paymentMethod: 'MIDTRANS',
        createdAt: detail ? (detail.order_date || detail.created_at || new Date().toISOString()) : new Date().toISOString(),
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
