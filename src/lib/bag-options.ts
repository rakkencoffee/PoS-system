import { CartItem } from './types';

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

// Same list used in CustomizeModal.tsx to tell food and drink categories apart.
const FOOD_CATEGORIES = ['dessert', 'snack', 'main-course', 'bites'];

function isFoodItem(item: CartItem): boolean {
  return item.categorySlug ? FOOD_CATEGORIES.includes(item.categorySlug) : false;
}

export function countFoodAndDrink(items: CartItem[]): { food: number; drink: number } {
  let food = 0;
  let drink = 0;
  for (const item of items) {
    if (isFoodItem(item)) food += item.quantity;
    else drink += item.quantity;
  }
  return { food, drink };
}

/** How many of a given bag type are needed for this many food/drink items. */
export function calculateBagQuantity(key: BagKey, food: number, drink: number): number {
  switch (key) {
    case 'cupCarrier':
      return drink > 0 ? Math.ceil(drink / 2) : 0;
    case 'paperBag':
      return Math.max(food > 0 ? Math.ceil(food / 2) : 0, drink > 0 ? Math.ceil(drink / 3) : 0);
    case 'insulatedBag':
      return Math.max(food > 0 ? Math.ceil(food / 4) : 0, drink > 0 ? Math.ceil(drink / 4) : 0);
    default:
      return 0;
  }
}

export interface BagOrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

/** Selected bags, as order-item entries ready to send to Olsera alongside the cart's own items. */
export function buildBagOrderItems(items: CartItem[], selectedBags: Record<BagKey, boolean>): BagOrderItem[] {
  const { food, drink } = countFoodAndDrink(items);
  const result: BagOrderItem[] = [];
  for (const opt of BAG_OPTIONS) {
    if (!selectedBags[opt.key]) continue;
    const qty = calculateBagQuantity(opt.key, food, drink);
    if (qty > 0) {
      result.push({ productId: String(opt.olseraProductId), name: opt.label, price: opt.price, quantity: qty });
    }
  }
  return result;
}

export function calculateBagTotal(items: CartItem[], selectedBags: Record<BagKey, boolean>): number {
  return buildBagOrderItems(items, selectedBags).reduce((sum, i) => sum + i.price * i.quantity, 0);
}
