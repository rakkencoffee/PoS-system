import { NextResponse } from "next/server";
import { breakfastPromoRemainingMs, isBreakfastPromoActive } from "@/lib/promo-categories";

export const dynamic = "force-dynamic";

/**
 * GET /api/promo/status
 *
 * Kasih tahu kiosk apakah promo Breakfast lagi jam aktif + sisa waktunya.
 * Dicek pakai jam server (bukan jam tablet kiosk yang bisa ngaco), lihat
 * BREAKFAST_PROMO.
 */
export async function GET() {
  return NextResponse.json({ active: isBreakfastPromoActive(), remainingMs: breakfastPromoRemainingMs() });
}
