'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/stores/useCartStore';
import { useDebouncedCallback } from 'use-debounce';
import { useCategories, useMenuItems, Category, MenuItem } from '@/hooks/useMenu';
import CategoryBar from '@/components/kiosk/CategoryBar';
import MenuCard from '@/components/kiosk/MenuCard';
import CustomizeModal from '@/components/kiosk/CustomizeModal';
import CartSummary from '@/components/kiosk/CartSummary';

export default function MenuPage() {
  const router = useRouter();
  const { itemCount } = useCartStore();
  
  // State
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);

  // Fetch data
  const { data: categories = [] } = useCategories();
  const { data: allItems = [], isLoading: loading } = useMenuItems('all');

  // Search logic
  const handleSearch = useDebouncedCallback((term: string) => {
    setDebouncedSearch(term);
  }, 500);

  const filteredItems = useMemo(() => {
    if (!debouncedSearch) return allItems;
    const q = debouncedSearch.toLowerCase();
    return allItems.filter(
      (item: MenuItem) =>
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
    );
  }, [debouncedSearch, allItems]);

  // Group items by category (only when not searching)
  const groupedItems = useMemo(() => {
    if (debouncedSearch) return null; // Don't group if searching
    
    const groups: Record<string, { category: Category; items: MenuItem[] }> = {};
    
    categories.forEach((cat: Category) => {
      let items = filteredItems.filter(i => i.categorySlug === cat.slug);
      
      // Reverse order specifically for Dessert and Bites
      if (cat.slug === 'dessert' || cat.slug === 'bites') {
        items = [...items].reverse();
      }

      if (items.length > 0) {
        groups[cat.slug] = { category: cat, items };
      }
    });
    
    return groups;
  }, [filteredItems, categories, debouncedSearch]);

  // Handle Scroll to Category
  const handleScrollToCategory = (slug: string) => {
    setSelectedCategory(slug);
    const element = document.getElementById(`category-${slug}`);
    if (element) {
      // Offset for Header + CategoryBar + padding
      const yOffset = -150; 
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  // Optional: Auto-update selected category based on scroll position
  useEffect(() => {
    if (debouncedSearch || categories.length === 0) return;

    const handleScroll = () => {
      const offsets = categories.map(cat => {
        const el = document.getElementById(`category-${cat.slug}`);
        if (!el) return { slug: cat.slug, offset: Infinity };
        // Check distance from top of viewport
        const rect = el.getBoundingClientRect();
        return { slug: cat.slug, offset: rect.top };
      });

      // Find the category closest to the top of the viewport (with a small buffer)
      const current = offsets.filter(o => o.offset <= 200).pop();
      if (current && current.slug !== selectedCategory) {
        setSelectedCategory(current.slug);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [categories, selectedCategory, debouncedSearch]);

  // Set initial selected category
  useEffect(() => {
    if (categories.length > 0 && !selectedCategory) {
      setSelectedCategory(categories[0].slug);
    }
  }, [categories, selectedCategory]);

  return (
    <div className="min-h-screen flex flex-col relative pb-32">
      {/* Header (Sticky) */}
      <header className="glass sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={() => {
              if (searchQuery !== '') {
                setSearchQuery('');
              } else {
                router.push('/');
              }
            }}
            className="btn-ghost flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          <h1 className="text-xl font-bold text-gradient">Our Menu</h1>

          <button
            onClick={() => router.push('/cart')}
            className="btn-secondary flex items-center gap-2 relative"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
            </svg>
            Cart
            {itemCount > 0 && (
              <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[#A8131E] text-white text-xs font-bold flex items-center justify-center animate-scale-in">
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Sticky Category Bar & Search */}
      <div className="sticky top-[72px] z-40 bg-(--bg-body)/95 backdrop-blur-md pt-4 pb-2 border-b border-white/5">
        <div className="px-6 max-w-7xl mx-auto w-full mb-4">
          {/* Search bar */}
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-(--text-muted)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search menu..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                handleSearch(e.target.value);
              }}
              className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-(--bg-card) border border-(--border-subtle) text-(--text-primary) placeholder-(--text-muted) focus:outline-none focus:border-[#A8131E] transition-colors"
            />
          </div>
        </div>

        {/* Category Anchor Bar (Hides when searching) */}
        {!debouncedSearch && categories.length > 0 && (
          <CategoryBar 
            categories={categories} 
            selected={selectedCategory} 
            onSelect={handleScrollToCategory} 
          />
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 px-6 max-w-7xl mx-auto w-full mt-6">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="glass-card h-64 animate-pulse">
                <div className="h-32 bg-white/5 rounded-t-2xl" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-white/5 rounded w-3/4" />
                  <div className="h-3 bg-white/5 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : debouncedSearch ? (
          /* Search Results View (Flat List) */
          <div>
            <h2 className="text-2xl font-bold text-(--text-primary) mb-6">
              Search Results: "{debouncedSearch}"
            </h2>
            {filteredItems.length === 0 ? (
              <div className="text-center py-20">
                <span className="text-6xl mb-4 block">🔍</span>
                <p className="text-(--text-primary) text-lg font-semibold">No items found</p>
                <p className="text-(--text-muted) text-sm mt-1">Try adjusting your search</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredItems.map((item, index) => (
                  <MenuCard key={item.id} item={item} index={index} onSelect={() => setSelectedItem(item)} />
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Grouped Categories View */
          <div className="space-y-12">
            {categories.map((cat: Category) => {
              const group = groupedItems?.[cat.slug];
              if (!group) return null; // Hide category if no items
              
              return (
                <div key={cat.slug} id={`category-${cat.slug}`} className="scroll-mt-40">
                  {/* Category Separator/Header */}
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-(--bg-secondary) border border-(--border-subtle) flex items-center justify-center text-2xl shadow-sm">
                      {cat.icon || '📦'}
                    </div>
                    <h2 className="text-2xl font-bold text-(--text-primary)">{cat.name}</h2>
                    <div className="h-px bg-linear-to-r from-(--border-default) to-transparent flex-1 ml-4" />
                  </div>
                  
                  {/* Item Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {group.items.map((item, index) => (
                      <MenuCard key={item.id} item={item} index={index} onSelect={() => setSelectedItem(item)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cart Summary Bar */}
      {itemCount > 0 && <CartSummary />}

      {/* Customize Modal */}
      {selectedItem && (
        <CustomizeModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}
