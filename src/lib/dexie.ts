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
  items: any[];
  totalAmount: number;
  customerName: string;
  createdAt: string;
  status: 'pending' | 'syncing' | 'failed';
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
