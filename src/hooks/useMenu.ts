import { useQuery } from '@tanstack/react-query';

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
      const res = await fetch('/api/categories');
      if (!res.ok) throw new Error('Failed to fetch categories');
      return res.json();
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
      const res = await fetch(`/api/menu?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch menu');
      return res.json();
    },
  });
}
