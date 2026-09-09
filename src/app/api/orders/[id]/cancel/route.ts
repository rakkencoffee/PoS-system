import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/orders/[id]/cancel
 *
 * Called by the kiosk when a customer backs out of an in-progress EDC
 * payment ("Batalkan"). Marks the order CANCELLED locally and voids the
 * matching Olsera Open Order (best-effort) -- without this, an abandoned
 * checkout just sat as an unpaid order forever in both places.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const posAdapter = await import("@/lib/integrations/pos.adapter");
    await posAdapter.cancelOrder(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[CancelOrder] Failed to cancel order:", error);
    return NextResponse.json({ error: "Failed to cancel order" }, { status: 500 });
  }
}
