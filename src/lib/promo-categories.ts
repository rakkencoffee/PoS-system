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
