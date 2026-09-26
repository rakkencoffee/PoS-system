import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/dexie';

export interface Category {
  id: number;
  name: string;
  slug: string;
  image?: string;
  icon?: string;
}

export interface MenuItem {
  id: number | string;
  name: string;
  description: string;
  price: number;
  image: string;
  category?: { name: string; slug: string };
  categorySlug?: string;
  available: boolean;
  isOutOfStock?: boolean;
  isBestSeller: boolean;
  isRecommended: boolean;
  type: string;
  toppings: { id: number; name: string; price: number }[];
  sizes: {
    id?: number;
    size: string;
    priceAdjustment: number;
  }[];
  olseraVariants?: { id: number; name: string; price: number }[];
  addOns?: { id: number; name: string; price: number }[];
}

// Kept in the cache for a full kiosk shift even after the last component
// using it unmounts (e.g. idle-timeout back to "/") -- default gcTime (5min)
// meant a customer arriving more than 5min after the last one saw the full
// loading skeleton again instead of an instant, possibly-stale-by-a-minute
// menu. React Query still silently revalidates in the background per
// QueryProvider's global staleTime (5min), so this only affects how long
// data stays visible while that happens, not correctness.
const KIOSK_GC_TIME_MS = 60 * 60 * 1000; // 1 hour

// Menu (and so stock) is re-pulled every 20s even while the kiosk sits idle,
// so an item that runs out in Olsera greys out as "Habis" within ~20-40s
// (this + the server's 20s catalog cache in pos.adapter).
const MENU_REFRESH_MS = 20_000;

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    gcTime: KIOSK_GC_TIME_MS,
    queryFn: async (): Promise<Category[]> => {
      try {
        const res = await fetch('/api/categories');
        if (!res.ok) throw new Error('Failed to fetch categories');
        const data = await res.json();
        
        // Sync to Dexie atomically — clear+bulkPut in one transaction to avoid empty cache on partial failure
        db.transaction('rw', db.categories, async () => {
          await db.categories.clear();
          await db.categories.bulkPut(data.map((c: any) => ({ ...c, order: c.order || 0 })));
        }).catch(() => {});
        
        return data;
      } catch (error) {
        console.warn('Offline mode: fetching categories from Dexie');
        const localData = await db.categories.toArray();
        if (localData.length > 0) return localData as unknown as Category[];
        throw error;
      }
    },
  });
}

export function useMenuItems(categorySlug?: string) {
  return useQuery({
    queryKey: ['menu', categorySlug || 'all'],
    gcTime: KIOSK_GC_TIME_MS,
    staleTime: MENU_REFRESH_MS,
    refetchInterval: MENU_REFRESH_MS,
    queryFn: async (): Promise<MenuItem[]> => {
      const params = new URLSearchParams();
      if (categorySlug && categorySlug !== 'all') {
        params.set('category', categorySlug);
      }
      
      try {
        const res = await fetch(`/api/menu?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch menu');
        const data = await res.json();

        if (!categorySlug || categorySlug === 'all') {
          db.transaction('rw', db.menuItems, async () => {
            await db.menuItems.clear();
            await db.menuItems.bulkPut(data);
          }).catch(() => {});
        }

        return data;
      } catch (error) {
        console.warn('Offline mode: fetching menu from Dexie');
        if (categorySlug && categorySlug !== 'all') {
          return await db.menuItems.where('categorySlug').equals(categorySlug).toArray() as unknown as MenuItem[];
        }
        return await db.menuItems.toArray() as unknown as MenuItem[];
      }
    },
  });
}
