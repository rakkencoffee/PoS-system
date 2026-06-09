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
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
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
