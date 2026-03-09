// Types for the POS system

export interface CartItem {
  id: string;
  menuItemId: number | string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  size: string;
  sugarLevel: number;
  iceLevel: string;
  extraShot: boolean;
  toppings: { id: number; name: string; price: number }[];
  subtotal: number;
}

export interface CartState {
  items: CartItem[];
  totalAmount: number;
}

export type OrderStatus = 'PENDING' | 'PREPARING' | 'READY' | 'COMPLETED';

export type PaymentMethod = 'QRIS' | 'E-Wallet' | 'Debit/Credit' | 'Cash';

export interface OrderEvent {
  type: 'ORDER_CREATED' | 'ORDER_UPDATED';
  order: {
    id: number;
    queueNumber: number;
    status: string;
    totalAmount: number;
    paymentMethod: string;
    createdAt: string;
    items: {
      id: number;
      menuItem: { name: string };
      quantity: number;
      size: string;
      sugarLevel: number;
      iceLevel: string;
      extraShot: boolean;
      subtotal: number;
      toppings: { topping: { name: string } }[];
    }[];
  };
}
