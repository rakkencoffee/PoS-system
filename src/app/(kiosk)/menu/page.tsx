'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import CategoryBar from '@/components/kiosk/CategoryBar';
import MenuCard from '@/components/kiosk/MenuCard';
import CustomizeModal from '@/components/kiosk/CustomizeModal';
import CartSummary from '@/components/kiosk/CartSummary';

interface Category {
  id: number | string;
  name: string;
  slug: string;
  icon: string;
}

interface MenuItemSize {
  id?: number;
  size: string;
  priceAdjustment: number;
}

interface MenuItem {
  id: number | string;
  name: string;
  description: string;
  price: number;
  image: string;
  categoryId?: number | string;
  categoryName?: string;
  categorySlug?: string;
  isBestSeller: boolean;
  isRecommended: boolean;
  type: string;
  category?: Category;
  sizes: MenuItemSize[];
}

export default function MenuPage() {
  const router = useRouter();
  const { itemCount } = useCart();
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/categories')
      .then((res) => res.json())
      .then(setCategories)
      .catch(console.error);
  }, []);

  const fetchMenu = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedCategory !== 'all') params.set('category', selectedCategory);
    if (searchQuery) params.set('search', searchQuery);
    if (activeFilter === 'best-seller') params.set('filter', 'best-seller');
    if (activeFilter === 'recommended') params.set('filter', 'recommended');
    if (activeFilter === 'hot' || activeFilter === 'iced') params.set('type', activeFilter);

    try {
      const res = await fetch(`/api/menu?${params.toString()}`);
      const data = await res.json();
      setMenuItems(data);
    } catch (error) {
      console.error('Error fetching menu:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, searchQuery, activeFilter]);

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

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
            onClick={() => router.push('/')}
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
            onChange={(e) => setSearchQuery(e.target.value)}
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

      {/* Category Bar */}
      <CategoryBar
        categories={categories}
        selected={selectedCategory}
        onSelect={setSelectedCategory}
      />

      {/* Menu Grid */}
      <div className="flex-1 px-6 pb-32 max-w-7xl mx-auto w-full">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
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
            <p className="text-white/40 text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
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
