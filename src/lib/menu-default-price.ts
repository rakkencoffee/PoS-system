// Coffee bean flavor -- a real Olsera variant dimension, baked into the
// variant name as its trailing comma segment (e.g. "Hot,Small,Bold & Nutty").
// Order here also drives display order and the default ("Roar", no add-on).
export const BEAN_FLAVORS = ['Roar', 'Bold & Nutty', 'Rich & Fruity'];

export function matchBeanFlavor(segment: string): string | null {
  const trimmed = segment.trim();
  return BEAN_FLAVORS.find((b) => b.toLowerCase() === trimmed.toLowerCase()) || null;
}

interface PricedItem {
  price: number;
  olseraVariants?: { name: string; price: number }[];
}

/**
 * Price of the variant CustomizeModal preselects when it opens, for the menu
 * card. Olsera fills a variant product's own price ("Refer ke varian") with
 * its CHEAPEST variant -- confirmed 2026-09-29 on 32 of 33 variant menus --
 * which is almost always Hot, so cards kept showing the Hot price even after
 * Ice was moved to the top in Olsera. Display only: the popup and checkout
 * still price from the chosen variant exactly as before.
 *
 * Mirrors CustomizeModal's default: the first variant, or for items with a
 * bean-flavor dimension the "Roar" entry of the first temp/size combo.
 */
export function defaultVariantPrice(item: PricedItem): number {
  const variants = item.olseraVariants || [];
  if (variants.length === 0) return item.price;

  const parsed = variants.map((v) => {
    const segments = v.name.split(',').map((s) => s.trim());
    const bean = matchBeanFlavor(segments[segments.length - 1]);
    return { variant: v, baseKey: bean ? segments.slice(0, -1).join(',') : v.name, bean };
  });
  const hasBeanDimension = parsed.every((p) => p.bean !== null) && !parsed.some((p) => p.baseKey === '');

  const price = hasBeanDimension
    ? parsed.find((p) => p.baseKey === parsed[0].baseKey && p.bean === BEAN_FLAVORS[0])?.variant.price ?? item.price
    : variants[0].price;
  return Number.isFinite(price) && price > 0 ? price : item.price;
}
