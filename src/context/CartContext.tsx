'use client';

import React, { createContext, useContext, useReducer, ReactNode, useCallback } from 'react';
import { CartItem, CartState } from '@/lib/types';

type CartAction =
  | { type: 'ADD_ITEM'; payload: CartItem }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'UPDATE_QUANTITY'; payload: { id: string; quantity: number } }
  | { type: 'SET_CUSTOMER_NAME'; payload: string }
  | { type: 'CLEAR_CART' };

const initialState: CartState = {
  items: [],
  totalAmount: 0,
  customerName: '',
};

function calculateTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.subtotal, 0);
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existingIndex = state.items.findIndex(
        (item) =>
          item.menuItemId === action.payload.menuItemId &&
          item.size === action.payload.size &&
          item.sugarLevel === action.payload.sugarLevel &&
          item.iceLevel === action.payload.iceLevel &&
          item.extraShot === action.payload.extraShot &&
          JSON.stringify(item.toppings.map(t => t.id).sort()) ===
            JSON.stringify(action.payload.toppings.map(t => t.id).sort())
      );

      let newItems: CartItem[];
      if (existingIndex >= 0) {
        newItems = state.items.map((item, index) => {
          if (index === existingIndex) {
            const newQuantity = item.quantity + action.payload.quantity;
            return {
              ...item,
              quantity: newQuantity,
              subtotal: (item.subtotal / item.quantity) * newQuantity,
            };
          }
          return item;
        });
      } else {
        newItems = [...state.items, action.payload];
      }

      return { ...state, items: newItems, totalAmount: calculateTotal(newItems) };
    }
    case 'REMOVE_ITEM': {
      const newItems = state.items.filter((item) => item.id !== action.payload);
      return { ...state, items: newItems, totalAmount: calculateTotal(newItems) };
    }
    case 'UPDATE_QUANTITY': {
      if (action.payload.quantity <= 0) {
        const newItems = state.items.filter((item) => item.id !== action.payload.id);
        return { ...state, items: newItems, totalAmount: calculateTotal(newItems) };
      }
      const newItems = state.items.map((item) => {
        if (item.id === action.payload.id) {
          const unitPrice = item.subtotal / item.quantity;
          return {
            ...item,
            quantity: action.payload.quantity,
            subtotal: unitPrice * action.payload.quantity,
          };
        }
        return item;
      });
      return { ...state, items: newItems, totalAmount: calculateTotal(newItems) };
    }
    case 'SET_CUSTOMER_NAME': {
      return { ...state, customerName: action.payload };
    }
    case 'CLEAR_CART':
      return initialState;
    default:
      return state;
  }
}

interface CartContextType {
  cart: CartState;
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  setCustomerName: (name: string) => void;
  clearCart: () => void;
  itemCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, dispatch] = useReducer(cartReducer, initialState);

  const addItem = useCallback((item: CartItem) => {
    dispatch({ type: 'ADD_ITEM', payload: item });
  }, []);

  const removeItem = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_ITEM', payload: id });
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { id, quantity } });
  }, []);
  
  const setCustomerName = useCallback((name: string) => {
    dispatch({ type: 'SET_CUSTOMER_NAME', payload: name });
  }, []);

  const clearCart = useCallback(() => {
    dispatch({ type: 'CLEAR_CART' });
  }, []);

  const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{ cart, addItem, removeItem, updateQuantity, setCustomerName, clearCart, itemCount }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
