import { NextRequest, NextResponse } from "next/server";
import { ratelimit } from "@/lib/redis";

/**
 * POST /api/orders/[id]/cancel
 *
 * Called by the kiosk when a customer backs out of an in-progress EDC
 * payment ("Batalkan"). Marks the order CANCELLED locally and voids the
 * matching Olsera Open Order (best-effort) -- without this, an abandoned
 * checkout just sat as an unpaid order forever in both places.
 *
 * No login is involved in this flow (kiosk order IDs aren't secret and
 * there's no session to check ownership against), so this only rate-limits
 * by IP -- cancelOrder() itself already refuses to touch a PAID order, so
 * the real risk here was ever just griefing via ID enumeration, not fraud.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const { success } = await ratelimit.limit(`cancel-order:${ip}`);
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { id } = await params;
    const posAdapter = await import("@/lib/integrations/pos.adapter");
    await posAdapter.cancelOrder(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[CancelOrder] Failed to cancel order:", error);
    return NextResponse.json({ error: "Failed to cancel order" }, { status: 500 });
  }
}
