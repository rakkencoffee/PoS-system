/**
 * Shared category slugs for the automatic "buy 1 drink, get a Refreshment
 * free" promo -- imported by both order-pricing.ts (server-side discount
 * calculation) and the kiosk cart page (client-side picker eligibility), so
 * the two never drift apart.
 */

// All beverage categories count as the "buy" side, including Refreshment
// itself (2x the same Refreshment alone also qualifies).
export const AUTO_PROMO_TRIGGER_CATEGORY_SLUGS = ["rakken-signature", "rakken-style", "non-coffee", "refreshment"];
export const AUTO_PROMO_REWARD_CATEGORY_SLUG = "refreshment";

// Which categories are food (Kitchen station), as a keyword match against
// categorySlug -- everything NOT matched here defaults to Barista/drink.
// This is deliberately opt-out-of-Kitchen rather than opt-in-to-Barista: an
// unrecognized or newly-added category (a naming drift, a new menu group)
// should default to Barista, not silently vanish from both stations.
// Single source of truth for both the on-screen KDS Kitchen/Barista split
// (KdsView.tsx, api/orders/route.ts, api/orders/[id]/route.ts,
// pos.adapter.ts's hasCoffee/hasFood) and the physical label print split
// (lib/print/format-receipt.ts's isDrinkItem) -- confirmed live 2026-09-24
// that the on-screen split had drifted to a narrower (wrong) list than the
// print side, routing Refreshment/Non-Coffee orders to Kitchen's board
// instead of Barista's. Packaging (bags, cup carriers) is deliberately NOT
// here: it goes to Barista's board, but never gets a printed label (see
// isPackagingItem in lib/print/format-receipt.ts).
export const KITCHEN_CATEGORY_KEYWORDS = [
  "bites",
  "dessert",
  "main-course",
  "snack",
  "pastry",
  "makanan",
  "cemilan",
  "other",
];

export function isKitchenCategory(categorySlug: string | undefined | null): boolean {
  const slug = (categorySlug || "").toLowerCase();
  return KITCHEN_CATEGORY_KEYWORDS.some((keyword) => slug.includes(keyword));
}
