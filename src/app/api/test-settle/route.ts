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
    
    // Simulate payment settlement and force order to 'Preparing' status in Olsera
    await posAdapter.updateOrderPaymentStatus(orderId, 'paid', 1000); // 1000 is a dummy amount

    console.log(`[Test Mode] Automatically settled Olsera order: ${orderId}`);

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
