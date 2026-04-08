import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/test-settle
 *
 * This endpoint is STRICTLY for the E2E Test Automation environment (TestSprite).
 * It bypasses the Midtrans Webhook requirement by directly commanding Olsera to
 * advance the order to "Paid" (Preparing / Status 'A').
 * This ensures the order appears on the Kitchen Display System (KDS) during automated testing.
 */
export async function POST(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_TEST_MODE !== 'true') {
    return NextResponse.json(
      { error: 'Forbidden: Endpoint is only available in Test Mode.' },
      { status: 403 }
    );
  }

  try {
    const { orderId } = await request.json();

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    const posAdapter = await import('@/lib/integrations/pos.adapter');
    const olsera = await import('@/lib/integrations/olsera.service');
    const olseraOrderId = parseInt(orderId.replace('OLSERA-', ''));

    // Step 1: Fetch actual order detail to get the correct total
    const orderDetail = await olsera.getOrderDetail(orderId);
    // Use 'total' field from Olsera detail response
    const actualTotal = orderDetail.total ? parseFloat(String(orderDetail.total)) : 0;

    if (actualTotal <= 0) {
      throw new Error(`Order ${orderId} has no items or zero total. Cannot settle.`);
    }
    
    // Step 2: Simulate payment settlement with the CORRECT amount
    console.log(`[Test Mode] Settling order ${orderId} with actual amount: ${actualTotal}`);
    await posAdapter.updateOrderPaymentStatus(orderId, 'paid', actualTotal);

    console.log(`[Test Mode] Successfully settled Olsera order: ${orderId}`);

    return NextResponse.json({
      success: true,
      message: `Test-mode auto settlement for ${orderId} executed successfully`,
    });
  } catch (error) {
    console.error('[Test Mode] Error auto-settling order:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to settle test order', details: errorMessage },
      { status: 500 }
    );
  }
}
