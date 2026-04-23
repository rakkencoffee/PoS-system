import { useQuery } from '@tanstack/react-query';

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await fetch('/api/categories');
      if (!res.ok) throw new Error('Failed to fetch categories');
      return res.json();
    },
  });
}

export function useMenuItems(categorySlug?: string) {
  return useQuery({
    queryKey: ['menu', categorySlug || 'all'],
    queryFn: async () => {
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
