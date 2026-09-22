import { NextResponse } from "next/server";
import { isAutoPromoActiveNow } from "@/lib/order-pricing";

/**
 * GET /api/promo/status
 *
 * Tells the kiosk cart page whether the automatic "buy 1 drink, get a
 * Refreshment free" promo is currently active, so it knows whether to show
 * the free-item picker. The active window (AUTO_PROMO_START/AUTO_PROMO_END)
 * is server-only env vars, not exposed to the client directly.
 */
export async function GET() {
  return NextResponse.json({ active: isAutoPromoActiveNow() });
}
