// Types for the POS system

export interface CartItem {
  id: string;
  menuItemId: number | string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  size: string;
  olseraVariantId?: number; // Olsera variant ID for the selected size
  sugarLevel: string;
  iceLevel: string;
  extraShot: boolean;
  toppings: { id: number; name: string; price: number }[];
  subtotal: number;
  notes?: string;
}

export interface CartState {
  items: CartItem[];
  totalAmount: number;
  customerName: string;
}

export type OrderStatus = 'PENDING' | 'PREPARING' | 'READY' | 'COMPLETED';

export type PaymentMethod = 'QRIS' | 'E-Wallet' | 'Debit/Credit' | 'Cash';

export interface OrderData {
  id: number | string;
  queueNumber: number;
  status: string;
  totalAmount: number;
  paymentMethod?: string;
  createdAt: string;
  isCoffeeOrder?: boolean;
  items: {
    id: number | string;
    menuItem: { name: string };
    quantity: number;
    size: string;
    sugarLevel?: string;
    iceLevel?: string;
    extraShot?: boolean;
    subtotal?: number;
    notes?: string;
    toppings?: { topping: { name: string } }[];
    categoryName?: string;
  }[];
}

export interface OrderEvent {
  type: 'ORDER_CREATED' | 'ORDER_UPDATED';
  order: OrderData;
}
