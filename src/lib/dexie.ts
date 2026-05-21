import Dexie, { type Table } from 'dexie';

export interface LocalCategory {
  id: string | number;
  name: string;
  slug: string;
  image: string;
  order: number;
}

export interface LocalMenuItem {
  id: string | number;
  name: string;
  description: string;
  price: number;
  image: string;
  categorySlug: string;
  isBestSeller: boolean;
  isRecommended: boolean;
  type: string; // 'hot', 'iced', 'both'
  available: boolean;
  toppings: any[];
  sizes: any[];
  olseraVariants?: any[];
}

export interface PendingOrder {
  id?: number;
  orderId: string;
  items: any[] | string;
  totalAmount: number;
  customerName: string;
  createdAt: string;
  status: 'pending' | 'syncing' | 'failed';
  isEncrypted?: boolean;
}

export interface SyncStatus {
  id: string; // e.g., 'products', 'categories'
  lastSynced: string; // ISO string
}

export class PosDatabase extends Dexie {
  categories!: Table<LocalCategory>;
  menuItems!: Table<LocalMenuItem>;
  pendingOrders!: Table<PendingOrder>;
  syncStatus!: Table<SyncStatus>;

  constructor() {
    super('PosDatabase');
    this.version(2).stores({
      categories: '++id, slug, name',
      menuItems: '++id, categorySlug, name, isBestSeller, isRecommended',
      pendingOrders: '++id, orderId, status',
      syncStatus: 'id'
    });
  }
}

export const db = new PosDatabase();

const OFFLINE_STORAGE_SECRET = 'rakken-pos-offline-secure-key-2026';

function xorEncrypt(str: string): string {
  if (typeof window === 'undefined') return str;
  const utf8Encoder = new TextEncoder();
  const encoded = utf8Encoder.encode(str);
  
  const resultBytes = new Uint8Array(encoded.length);
  for (let i = 0; i < encoded.length; i++) {
    const keyChar = OFFLINE_STORAGE_SECRET.charCodeAt(i % OFFLINE_STORAGE_SECRET.length);
    resultBytes[i] = encoded[i] ^ keyChar;
  }
  
  let binary = '';
  const len = resultBytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(resultBytes[i]);
  }
  return btoa(binary);
}

function xorDecrypt(base64: string): string {
  if (typeof window === 'undefined') return base64;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    const keyChar = OFFLINE_STORAGE_SECRET.charCodeAt(i % OFFLINE_STORAGE_SECRET.length);
    bytes[i] = binary.charCodeAt(i) ^ keyChar;
  }
  
  const utf8Decoder = new TextDecoder();
  return utf8Decoder.decode(bytes);
}

export function encryptPendingOrder(order: PendingOrder): PendingOrder {
  if (order.isEncrypted) return order;
  
  try {
    return {
      ...order,
      customerName: xorEncrypt(order.customerName),
      items: xorEncrypt(JSON.stringify(order.items)),
      isEncrypted: true
    };
  } catch (err) {
    console.error('Failed to encrypt pending order:', err);
    return order;
  }
}

export function decryptPendingOrder(order: PendingOrder): PendingOrder {
  if (!order.isEncrypted) return order;
  
  try {
    const decryptedItemsStr = xorDecrypt(order.items as string);
    return {
      ...order,
      customerName: xorDecrypt(order.customerName),
      items: JSON.parse(decryptedItemsStr),
      isEncrypted: false
    };
  } catch (err) {
    console.error('Failed to decrypt pending order:', err);
    return order;
  }
}
