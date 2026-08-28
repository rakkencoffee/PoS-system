import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CartItem, CartState, OrderType } from '@/lib/types';

interface CartStore extends CartState {
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, updatedItem: CartItem) => void;
  updateQuantity: (id: string, quantity: number) => void;
  setCustomerName: (name: string) => void;
  setCustomerPhone: (phone: string) => void;
  setOrderType: (orderType: OrderType) => void;
  clearCart: () => void;
  itemCount: number;
}

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
      orderType: 'TAKEAWAY',
      itemCount: 0,

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
        const { items } = get();
        const newItems = items.filter((item) => item.id !== id);
        set({ items: newItems, ...deriveCartMeta(newItems) });
      },

      updateItem: (id: string, updatedItem: CartItem) => {
        const { items } = get();
        const newItems = items.map((item) =>
          item.id === id ? { ...updatedItem, id } : item
        );
        set({ items: newItems, ...deriveCartMeta(newItems) });
      },

      updateQuantity: (id: string, quantity: number) => {
        const { items } = get();
        if (quantity <= 0) {
          const newItems = items.filter((item) => item.id !== id);
          set({ items: newItems, ...deriveCartMeta(newItems) });
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

      setOrderType: (orderType: OrderType) => {
        set({ orderType });
      },

      clearCart: () => {
        set({ items: [], totalAmount: 0, itemCount: 0, customerName: '', customerPhone: '', orderType: 'TAKEAWAY' });
      },
    }),
    {
      name: 'rakken-cart-storage',
    }
  )
);
