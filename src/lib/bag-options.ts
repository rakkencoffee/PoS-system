export type BagKey = 'cupCarrier' | 'paperBag' | 'insulatedBag';

export interface BagOption {
  key: BagKey;
  label: string;
  price: number;
  description: string;
  /** Olsera product ID — created manually in the Olsera dashboard under the "Packaging" category. */
  olseraProductId: number;
}

export const BAG_OPTIONS: BagOption[] = [
  { key: 'cupCarrier', label: 'Cup Carrier', price: 3000, description: 'Khusus minuman, 2 cup per carrier', olseraProductId: 121736115 },
  { key: 'paperBag', label: 'Paper Bag', price: 4000, description: '2 makanan atau 3 minuman per bag', olseraProductId: 121735685 },
  { key: 'insulatedBag', label: 'Insulated Bag', price: 5000, description: '4 makanan atau 4 minuman per bag', olseraProductId: 121735700 },
];

export interface BagOrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

/** Selected bag quantities, as order-item entries ready to send to Olsera alongside the cart's own items. */
export function buildBagOrderItems(bagQuantities: Record<BagKey, number>): BagOrderItem[] {
  const result: BagOrderItem[] = [];
  for (const opt of BAG_OPTIONS) {
    const qty = bagQuantities[opt.key] || 0;
    if (qty > 0) {
      result.push({ productId: String(opt.olseraProductId), name: opt.label, price: opt.price, quantity: qty });
    }
  }
  return result;
}

export function calculateBagTotal(bagQuantities: Record<BagKey, number>): number {
  return buildBagOrderItems(bagQuantities).reduce((sum, i) => sum + i.price * i.quantity, 0);
}
