import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/test-settle
 *
 * This endpoint is STRICTLY for the E2E Test Automation environment (TestSprite).
 * It bypasses the Midtrans Webhook requirement by directly commanding Olsera to
 * advance the order to "Paid" (Preparing / Status 'A').
 * This ensures the order appears on the Kitchen Display System (KDS) during automated testing.
 */
export async function POST(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_TEST_MODE !== "true") {
    return NextResponse.json(
      { error: "Forbidden: Endpoint is only available in Test Mode." },
      { status: 403 },
    );
  }

  try {
    const { orderId } = await request.json();

    if (!orderId) {
      return NextResponse.json(
        { error: "orderId is required" },
        { status: 400 },
      );
    }

    const posAdapter = await import("@/lib/integrations/pos.adapter");
    const olsera = await import("@/lib/integrations/olsera.service");
    const olseraOrderId = parseInt(orderId.replace("OLSERA-", ""));

    // Step 1: Fetch actual order detail to get the correct total
    const orderDetail = await olsera.getOrderDetail(olseraOrderId);

    // Initial total from Olsera
    let actualTotal = orderDetail.total ? parseFloat(String(orderDetail.total)) : 0;
    const olseraItems = Array.isArray(orderDetail.items) ? orderDetail.items : [];

    // FALLBACK: If Olsera is slow (0 total or 0 items), use local Prisma mirror
    if (actualTotal === 0 || olseraItems.length === 0) {
      console.log(`[Test Mode] Olsera sync delay for ${orderId}, using Prisma fallback...`);
      try {
        const { prisma } = await import("@/lib/db");
        const localOrder = await prisma.order.findUnique({
          where: { id: orderId },
        });
        if (localOrder) {
          actualTotal = localOrder.total;
          console.log(`[Test Mode] Used local total: ${actualTotal}`);
        }
      } catch (e) {
        console.error("[Test Mode] Prisma fallback failed:", e);
      }
    }

    if (actualTotal <= 0) {
      throw new Error(`Order ${orderId} has no items or zero total. Cannot settle.`);
    }

    // Step 2: Simulate payment settlement with the CORRECT amount
    console.log(
      `[Test Mode] Settling order ${orderId} with actual amount: ${actualTotal}`,
    );
    await posAdapter.updateOrderPaymentStatus(orderId, "paid", actualTotal);

    console.log(`[Test Mode] Successfully settled Olsera order: ${orderId}`);

    return NextResponse.json({
      success: true,
      message: `Test-mode auto settlement for ${orderId} executed successfully`,
    });
  } catch (error) {
    console.error("[Test Mode] Error auto-settling order:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to settle test order", details: errorMessage },
      { status: 500 },
    );
  }
}
