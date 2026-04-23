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
  toppings: any[];
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
        
        // Sync to Dexie in background
        db.categories.clear().then(() => {
          db.categories.bulkPut(data.map((c: any) => ({
            ...c,
            order: c.order || 0
          })));
        });
        
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

        // Sync to Dexie
        // We only clear and bulkPut all items if it's the 'all' fetch to avoid partial sync issues
        if (!categorySlug || categorySlug === 'all') {
          db.menuItems.clear().then(() => {
            db.menuItems.bulkPut(data);
          });
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
