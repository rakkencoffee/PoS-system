import { NextRequest, NextResponse } from 'next/server';
import { orderEvents } from '@/lib/events';

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

        return NextResponse.json({
          id: id,
          queueNumber: olseraOrderId % 1000, // Last 3 digits as queue number
          status: kdsStatus,
          totalAmount: orderDetail.total || 0,
          createdAt: new Date().toISOString(),
          items: items.map((item: any, idx: number) => ({
            id: idx,
            menuItem: { name: item.product_name || item.name || 'Item' },
            quantity: item.qty || item.quantity || 1,
            size: item.variant_name || '-',
          })),
        });
      } catch (olseraError) {
        console.error('Olsera getOrderDetail failed:', olseraError);
        // Return a minimal order object so the page doesn't crash
        return NextResponse.json({
          id: id,
          queueNumber: olseraOrderId % 1000,
          status: 'PENDING',
          totalAmount: 0,
          createdAt: new Date().toISOString(),
          items: [],
        });
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

      // 1. Handle mock orders (TEST01, etc) by skipping Olsera sync
      if (id.includes('TEST')) {
        console.log(`[Mock Order] Skipping Olsera sync for test order ${id}`);
      } else {
        // Map KDS status to Olsera status
        let olseraStatus: 'P' | 'A' | 'S' | 'Z' | 'X' = 'P';
        if (body.status === 'PREPARING') olseraStatus = 'A'; // Confirmed/Preparing
        else if (body.status === 'COMPLETED') olseraStatus = 'Z'; // Completed
        
        try {
          await olsera.updateOrderStatus(olseraOrderId, olseraStatus);
          console.log(`Successfully synced Olsera order ${olseraOrderId} to status ${olseraStatus}`);
        } catch (err: any) {
          console.error('Initial sync failed, attempting self-healing for order:', olseraOrderId, err.message);
          
          if (err.message.includes('406') || err.message.includes('payment info')) {
            try {
              // 1. Fetch current order total to ensure full payment record
              detail = await olsera.getOrderDetail(olseraOrderId);
              const total = detail.total || detail.grand_total || 0;
              
              if (total > 0) {
                console.log(`[Self-Healing] Recording full payment of ${total} for order ${olseraOrderId}`);
                // Use default payment mode 1 (Cash/General) for force sync
                await olsera.updateOrderPayment(olseraOrderId, total, 1);
              }
              
              // 2. Explicitly mark as Paid flag
              await olsera.markOrderAsPaid(olseraOrderId, true);
              
              // 3. Retry the status update
              await olsera.updateOrderStatus(olseraOrderId, olseraStatus);
              console.log(`[Self-Healing] Successfully recovered and synced order ${olseraOrderId}`);
            } catch (recoveryError: any) {
              console.error('[Self-Healing] Failed to recover order:', recoveryError.message);
              return NextResponse.json({ 
                error: 'Order must be fully paid in Olsera before it can be prepared or completed.',
                details: 'Sistem mencoba melunasi otomatis namun gagal. Harap selesaikan pembayaran di dashboard Olsera.'
              }, { status: 400 });
            }
          } else {
            return NextResponse.json({ error: 'Failed to sync status to Olsera' }, { status: 500 });
          }
        }
      }

      // Fetch detail if not already fetched during self-healing
      if (!detail && !id.includes('TEST')) {
        detail = await olsera.getOrderDetail(olseraOrderId);
      }

      const updatedOrder = {
        id: id,
        queueNumber: olseraOrderId % 1000,
        status: body.status,
        totalAmount: detail ? (detail.total || detail.grand_total || 0) : 0,
        paymentMethod: 'MIDTRANS',
        createdAt: detail ? (detail.order_date || detail.created_at || new Date().toISOString()) : new Date().toISOString(),
        items: detail && Array.isArray(detail.items) ? detail.items.map((item: any, idx: number) => ({
          id: idx,
          menuItem: { name: item.product_name || item.name || 'Item' },
          quantity: item.qty || item.quantity || 1,
          size: item.variant_name || '-',
        })) : [],
      };

      // Emit SSE so KDS updates in real-time
      if (body.status === 'COMPLETED') {
        orderEvents.emit('ORDER_UPDATED', { order: updatedOrder });
      } else {
        orderEvents.emit('ORDER_UPDATED', { order: updatedOrder });
      }

      return NextResponse.json(updatedOrder);
    } else {
      throw new Error("Local database (Prisma) is no longer supported for updating orders.");
    }
  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}
