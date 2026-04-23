import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CartItem, CartState } from '@/lib/types';

interface CartStore extends CartState {
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  setCustomerName: (name: string) => void;
  clearCart: () => void;
  itemCount: number;
}

function calculateTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.subtotal, 0);
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      totalAmount: 0,
      customerName: '',
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

        const totalAmount = calculateTotal(newItems);
        const itemCount = newItems.reduce((sum, item) => sum + item.quantity, 0);
        set({ items: newItems, totalAmount, itemCount });
      },

      removeItem: (id: string) => {
        const { items } = get();
        const newItems = items.filter((item) => item.id !== id);
        const totalAmount = calculateTotal(newItems);
        const itemCount = newItems.reduce((sum, item) => sum + item.quantity, 0);
        set({ items: newItems, totalAmount, itemCount });
      },

      updateQuantity: (id: string, quantity: number) => {
        const { items } = get();
        if (quantity <= 0) {
          const newItems = items.filter((item) => item.id !== id);
          const totalAmount = calculateTotal(newItems);
          const itemCount = newItems.reduce((sum, item) => sum + item.quantity, 0);
          set({ items: newItems, totalAmount, itemCount });
          return;
        }

        const newItems = items.map((item) => {
          if (item.id === id) {
            const unitPrice = item.subtotal / item.quantity;
            return {
              ...item,
              quantity,
              subtotal: unitPrice * quantity,
            };
          }
          return item;
        });

        const totalAmount = calculateTotal(newItems);
        const itemCount = newItems.reduce((sum, item) => sum + item.quantity, 0);
        set({ items: newItems, totalAmount, itemCount });
      },

      setCustomerName: (name: string) => {
        set({ customerName: name });
      },

      clearCart: () => {
        set({ items: [], totalAmount: 0, itemCount: 0, customerName: '' });
      },
    }),
    {
      name: 'rakken-cart-storage',
    }
  )
);
