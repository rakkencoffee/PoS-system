'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/stores/useCartStore';
import { useDebouncedCallback } from 'use-debounce';
import { useCategories, useMenuItems, Category, MenuItem } from '@/hooks/useMenu';
import CategoryBar from '@/components/kiosk/CategoryBar';
import MenuCard from '@/components/kiosk/MenuCard';
import CustomizeModal from '@/components/kiosk/CustomizeModal';
import CartSummary from '@/components/kiosk/CartSummary';

// (Interfaces remain same)

export default function MenuPage() {
  const router = useRouter();
  const { itemCount } = useCartStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);

  // Use TanStack Query hooks instead of manual fetch
  const { data: categories = [] } = useCategories();
  const { data: allItems = [], isLoading: loading } = useMenuItems(selectedCategory);

  // Best practice: useDebouncedCallback from 'use-debounce'
  const handleSearch = useDebouncedCallback((term: string) => {
    setDebouncedSearch(term);
  }, 500);

  // Client-side filtering using useMemo
  const menuItems = useMemo(() => {
    if (!debouncedSearch) return allItems;
    const q = debouncedSearch.toLowerCase();
    return allItems.filter(
      (item: MenuItem) =>
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
    );
  }, [debouncedSearch, allItems]);

  const filters = [
    { key: 'all', label: 'All', icon: '🍽️' },
    { key: 'best-seller', label: 'Best Seller', icon: '🔥' },
    { key: 'recommended', label: 'Recommended', icon: '⭐' },
    { key: 'hot', label: 'Hot', icon: '🔴' },
    { key: 'iced', label: 'Iced', icon: '🧊' },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="glass sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={() => {
              if (selectedCategory !== 'all' || searchQuery !== '') {
                setSelectedCategory('all');
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

      {/* Search & Filters */}
      <div className="px-6 py-4 max-w-7xl mx-auto w-full">
        {/* Search bar */}
        <div className="relative mb-4">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

        {/* Filter chips (Temporarily Disabled) */}
        {/*
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {filters.map((filter) => (
            <button
              key={filter.key}
              onClick={() => setActiveFilter(filter.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                activeFilter === filter.key
                  ? 'bg-linear-to-r from-[#c41525] to-[#A8131E] text-white shadow-md'
                  : 'bg-(--bg-card) text-(--text-secondary) border border-(--border-subtle) hover:border-(--border-default)'
              }`}
            >
              <span>{filter.icon}</span>
              {filter.label}
            </button>
          ))}
        </div>
        */}
      </div>

      {selectedCategory === 'all' && !searchQuery ? (
        /* Category Selection View */
        <div className="flex-1 px-6 pb-32 max-w-7xl mx-auto w-full">
          <h2 className="text-xl font-bold text-(--text-primary) mb-4">Select Category</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categories.map((category: Category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.slug)}
                className="flex items-center p-4 rounded-2xl glass-card border border-(--border-subtle) hover:border-[#A8131E] transition-all shadow-sm group text-left"
                style={{ background: 'var(--bg-secondary)' }}
              >
                <div className="w-16 h-16 rounded-xl bg-white/5 flex items-center justify-center text-4xl group-hover:scale-110 transition-transform">
                  {category.icon || '📦'}
                </div>
                <div className="ml-4 flex-1">
                  <h3 className="text-lg font-bold text-(--text-primary)">{category.name}</h3>
                  <p className="text-sm text-(--text-muted) capitalize">{category.slug.replace('-', ' ')}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-(--text-secondary) group-hover:bg-[#A8131E] group-hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Menu Items View */
        <>
          {/* Category Title */}
          <div className="pt-2 pb-0 px-6 max-w-7xl mx-auto w-full">
            <h2 className="text-2xl font-bold text-(--text-primary) capitalize">
              {searchQuery ? `Search Results: "${searchQuery}"` : selectedCategory.replace('-', ' ')}
            </h2>
          </div>

          {/* Menu Grid */}
          <div className="flex-1 px-6 pb-32 max-w-7xl mx-auto w-full mt-4">
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
            ) : menuItems.length === 0 ? (
              <div className="text-center py-20">
                <span className="text-6xl mb-4 block">🔍</span>
                <p className="text-white/60 text-lg">No items found</p>
                <p className="text-white/40 text-sm mt-1">Try adjusting your search</p>
                <button 
                  onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}
                  className="mt-6 px-6 py-2 rounded-full border border-(--border-subtle) hover:bg-white/5 transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {menuItems.map((item, index) => (
                  <MenuCard
                    key={item.id}
                    item={item}
                    index={index}
                    onSelect={() => setSelectedItem(item)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Cart Summary Bar */}
      {itemCount > 0 && <CartSummary />}

      {/* Customize Modal */}
      {selectedItem && (
        <CustomizeModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}
