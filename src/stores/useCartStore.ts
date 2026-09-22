import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CartItem, CartState } from '@/lib/types';
import { BagKey } from '@/lib/bag-options';

interface CartStore extends CartState {
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, updatedItem: CartItem) => void;
  updateQuantity: (id: string, quantity: number) => void;
  setCustomerName: (name: string) => void;
  setCustomerPhone: (phone: string) => void;
  setBagQuantity: (key: BagKey, quantity: number) => void;
  clearCart: () => void;
  itemCount: number;
  bagQuantities: Record<BagKey, number>;
  // Tracks which cart item (if any) is the customer's pick from the "buy 1
  // drink, get a Refreshment free" picker on the cart page -- lets that
  // picker show/let them swap their current choice instead of just adding
  // duplicates, and lets the cart card badge it as free. Purely a client-side
  // UI hint: the actual discount is still computed server-side by category,
  // not by this id (see order-pricing.ts's computeAutoPromoDiscount).
  freeRefreshmentCartItemId: string | null;
  setFreeRefreshmentCartItemId: (id: string | null) => void;
}

const emptyBagQuantities: Record<BagKey, number> = {
  cupCarrier: 0,
  paperBag: 0,
  insulatedBag: 0,
};

function calculateTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.subtotal, 0);
}

function deriveCartMeta(items: CartItem[]) {
  return {
    totalAmount: calculateTotal(items),
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
  };
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      totalAmount: 0,
      customerName: '',
      customerPhone: '',
      itemCount: 0,
      bagQuantities: emptyBagQuantities,
      freeRefreshmentCartItemId: null,

      addItem: (newItem: CartItem) => {
        const { items } = get();
        const existingIndex = items.findIndex(
          (item) =>
            item.menuItemId === newItem.menuItemId &&
            item.size === newItem.size &&
            item.sugarLevel === newItem.sugarLevel &&
            item.iceLevel === newItem.iceLevel &&
            item.extraShot === newItem.extraShot &&
            JSON.stringify(item.toppings.map(t => t.id).sort()) ===
              JSON.stringify(newItem.toppings.map(t => t.id).sort())
        );

        let newItems: CartItem[];
        if (existingIndex >= 0) {
          newItems = items.map((item, index) => {
            if (index === existingIndex) {
              const newQuantity = item.quantity + newItem.quantity;
              return {
                ...item,
                quantity: newQuantity,
                subtotal: (item.subtotal / item.quantity) * newQuantity,
              };
            }
            return item;
          });
        } else {
          newItems = [...items, newItem];
        }

        set({ items: newItems, ...deriveCartMeta(newItems) });
      },

      removeItem: (id: string) => {
        const { items, freeRefreshmentCartItemId } = get();
        const newItems = items.filter((item) => item.id !== id);
        set({
          items: newItems,
          ...deriveCartMeta(newItems),
          freeRefreshmentCartItemId: freeRefreshmentCartItemId === id ? null : freeRefreshmentCartItemId,
        });
      },

      updateItem: (id: string, updatedItem: CartItem) => {
        const { items } = get();
        const newItems = items.map((item) =>
          item.id === id ? { ...updatedItem, id } : item
        );
        set({ items: newItems, ...deriveCartMeta(newItems) });
      },

      updateQuantity: (id: string, quantity: number) => {
        const { items, freeRefreshmentCartItemId } = get();
        if (quantity <= 0) {
          const newItems = items.filter((item) => item.id !== id);
          set({
            items: newItems,
            ...deriveCartMeta(newItems),
            freeRefreshmentCartItemId: freeRefreshmentCartItemId === id ? null : freeRefreshmentCartItemId,
          });
          return;
        }

        const newItems = items.map((item) => {
          if (item.id === id) {
            const unitPrice = item.subtotal / item.quantity;
            return { ...item, quantity, subtotal: unitPrice * quantity };
          }
          return item;
        });

        set({ items: newItems, ...deriveCartMeta(newItems) });
      },

      setCustomerName: (name: string) => {
        set({ customerName: name });
      },

      setCustomerPhone: (phone: string) => {
        set({ customerPhone: phone });
      },

      setBagQuantity: (key: BagKey, quantity: number) => {
        const { bagQuantities } = get();
        set({ bagQuantities: { ...bagQuantities, [key]: Math.max(0, quantity) } });
      },

      setFreeRefreshmentCartItemId: (id: string | null) => {
        set({ freeRefreshmentCartItemId: id });
      },

      clearCart: () => {
        set({
          items: [],
          totalAmount: 0,
          itemCount: 0,
          customerName: '',
          customerPhone: '',
          bagQuantities: emptyBagQuantities,
          freeRefreshmentCartItemId: null,
        });
      },
    }),
    {
      name: 'rakken-cart-storage',
    }
  )
);
