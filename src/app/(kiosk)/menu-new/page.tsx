'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/stores/useCartStore';
import { useDebouncedCallback } from 'use-debounce';
import { useCategories, useMenuItems, Category, MenuItem } from '@/hooks/useMenu';
import CustomizeModal from '@/components/kiosk/CustomizeModal';

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const JKT = { fontFamily: 'Plus Jakarta Sans, sans-serif' } as const;

/* ─────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────── */

function KioskProductCard({ item, onSelect }: { item: MenuItem; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className="bg-white rounded-xl border border-[#f3e0be] shadow-sm overflow-hidden flex flex-col group product-card-hover text-left w-full"
    >
      <div className="relative aspect-square overflow-hidden bg-[#F5F5F5] m-2 rounded-lg">
        {item.image ? (
          <img
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            src={item.image}
            alt={item.name}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl opacity-30">☕</div>
        )}
        {item.isBestSeller && (
          <span
            className="absolute top-2 left-2 bg-[#5a632f] text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full"
            style={JKT}
          >
            Best Seller
          </span>
        )}
        {item.isRecommended && !item.isBestSeller && (
          <span
            className="absolute top-2 left-2 bg-[#78000f] text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full"
            style={JKT}
          >
            Recommended
          </span>
        )}
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <h3 className="text-[20px] font-[600] text-[#323131] mb-1 line-clamp-1" style={JKT}>
          {item.name}
        </h3>
        <p className="text-[12px] text-[#998075] mb-3 line-clamp-2 min-h-[32px]" style={JKT}>
          {item.description?.replace(/\\n/g, ' ')}
        </p>
        <div className="mt-auto flex flex-col gap-2">
          <span className="text-[22px] font-bold text-[#78000f]" style={JKT}>
            {formatCurrency(item.price)}
          </span>
          <div
            className="w-full bg-[#78000f] text-white text-[16px] font-[600] py-3 rounded-lg hover:bg-[#7D0F18] transition-colors flex items-center justify-center active:scale-95"
            style={JKT}
          >
            Pilih
          </div>
        </div>
      </div>
    </button>
  );
}

function MobileProductCard({ item, onSelect }: { item: MenuItem; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className="bg-white rounded-xl p-2 shadow-sm border border-[#f3e0be] flex flex-col group active:scale-95 transition-all duration-200 text-left w-full"
    >
      <div className="aspect-square w-full rounded-lg overflow-hidden mb-2 relative bg-[#F5F5F5]">
        {item.image ? (
          <img
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            src={item.image}
            alt={item.name}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl opacity-30">☕</div>
        )}
        {item.isBestSeller && (
          <span
            className="absolute top-1.5 left-1.5 bg-[#5a632f] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full"
            style={JKT}
          >
            Best
          </span>
        )}
      </div>
      <div className="px-1 pb-1 flex flex-col flex-grow">
        <span className="text-[11px] font-[500] text-[#998075] mb-0.5 truncate" style={JKT}>
          {(item as any).category?.name || item.categorySlug || ''}
        </span>
        <h3 className="text-[14px] font-[600] text-[#231a05] mb-1 leading-tight line-clamp-2" style={JKT}>
          {item.name}
        </h3>
        <div className="mt-auto flex justify-between items-center">
          <span className="text-[14px] font-bold text-[#78000f]" style={JKT}>
            {formatCurrency(item.price)}
          </span>
          <div className="w-7 h-7 rounded-full bg-[#F5F5F5] flex items-center justify-center text-[#78000f] group-hover:bg-[#78000f] group-hover:text-white transition-colors shrink-0">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
          </div>
        </div>
      </div>
    </button>
  );
}

function KioskSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-6">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-[#f3e0be] overflow-hidden animate-pulse">
          <div className="aspect-square bg-[#F5F5F5] m-2 rounded-lg" />
          <div className="p-4 space-y-2">
            <div className="h-5 bg-[#F5F5F5] rounded w-3/4" />
            <div className="h-3 bg-[#F5F5F5] rounded w-1/2" />
            <div className="h-9 bg-[#F5F5F5] rounded w-full mt-3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function MobileSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="bg-white rounded-xl p-2 border border-[#f3e0be] animate-pulse">
          <div className="aspect-square w-full rounded-lg bg-[#F5F5F5] mb-2" />
          <div className="px-1 pb-1 space-y-1.5">
            <div className="h-3 bg-[#F5F5F5] rounded w-1/2" />
            <div className="h-4 bg-[#F5F5F5] rounded w-full" />
            <div className="h-4 bg-[#F5F5F5] rounded w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SearchEmpty({ query, isMobile }: { query: string; isMobile: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <span
        className="material-symbols-outlined text-[#D9C7A6]"
        style={{ fontSize: isMobile ? '64px' : '80px' }}
      >
        search_off
      </span>
      <p className={`font-bold text-[#323131] mt-4 ${isMobile ? 'text-[18px]' : 'text-[22px]'}`} style={JKT}>
        Menu tidak ditemukan
      </p>
      <p className="text-[13px] text-[#998075] mt-1" style={JKT}>
        Tidak ada hasil untuk "{query}"
      </p>
    </div>
  );
}

interface CategoryPillsProps {
  categories: Category[];
  selected: string;
  onSelect: (slug: string) => void;
  compact?: boolean;
}
function CategoryPills({ categories, selected, onSelect, compact = false }: CategoryPillsProps) {
  const base = compact
    ? 'px-4 py-1.5 text-[12px]'
    : 'px-6 py-2 text-[13px]';
  const active = 'bg-[#78000f] text-white active-pill';
  const inactive = 'bg-white border border-[#f3e0be] text-[#998075] hover:border-[#78000f]';

  return (
    <div className={`flex gap-3 overflow-x-auto hide-scrollbar ${compact ? 'px-4 py-2' : 'px-12 pb-1'}`}>
      <button
        onClick={() => onSelect('')}
        className={`whitespace-nowrap ${base} rounded-full font-[500] transition-all active:scale-95 ${!selected ? active : inactive}`}
        style={JKT}
      >
        {compact ? 'Semua' : 'All Menu'}
      </button>
      {categories.map((cat) => (
        <button
          key={cat.slug}
          onClick={() => onSelect(cat.slug)}
          className={`whitespace-nowrap ${base} rounded-full font-[500] transition-all active:scale-95 ${selected === cat.slug ? active : inactive}`}
          style={JKT}
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main Page
───────────────────────────────────────────── */
export default function MenuNewPage() {
  const router = useRouter();
  const { itemCount, totalAmount } = useCartStore();

  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);

  const { data: categories = [] } = useCategories();
  const { data: allItems = [], isLoading: loading } = useMenuItems('all');

  const handleSearch = useDebouncedCallback((term: string) => {
    setDebouncedSearch(term);
  }, 500);

  const onSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    handleSearch(e.target.value);
  };

  const filteredItems = useMemo(() => {
    if (!debouncedSearch) return allItems;
    const q = debouncedSearch.toLowerCase();
    return allItems.filter(
      (item: MenuItem) =>
        item.name.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q)
    );
  }, [debouncedSearch, allItems]);

  const groupedItems = useMemo(() => {
    if (debouncedSearch) return null;
    const groups: Record<string, { category: Category; items: MenuItem[] }> = {};
    categories.forEach((cat: Category) => {
      let items = allItems.filter((i: MenuItem) => i.categorySlug === cat.slug);
      if (cat.slug === 'dessert' || cat.slug === 'bites') items = [...items].reverse();
      if (items.length > 0) groups[cat.slug] = { category: cat, items };
    });
    return groups;
  }, [allItems, categories, debouncedSearch]);

  const handleScrollToCategory = (slug: string) => {
    setSelectedCategory(slug);
    if (!slug) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const el = document.getElementById(`mnew-${slug}`);
    if (el) {
      window.scrollTo({
        top: el.getBoundingClientRect().top + window.pageYOffset - 160,
        behavior: 'smooth',
      });
    }
  };

  // Auto-highlight active category on scroll
  useEffect(() => {
    if (debouncedSearch || !categories.length) return;
    const onScroll = () => {
      const visible = categories
        .map((c: Category) => {
          const el = document.getElementById(`mnew-${c.slug}`);
          return el ? { slug: c.slug, top: el.getBoundingClientRect().top } : null;
        })
        .filter((o): o is { slug: string; top: number } => !!o && o.top <= 200);
      const current = visible[visible.length - 1];
      if (current && current.slug !== selectedCategory) setSelectedCategory(current.slug);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [categories, selectedCategory, debouncedSearch]);

  useEffect(() => {
    if (categories.length > 0 && !selectedCategory) {
      setSelectedCategory(categories[0].slug);
    }
  }, [categories, selectedCategory]);

  return (
    <div className="min-h-screen bg-[#fff8f2] relative" style={JKT}>
      {/* ── Fonts & Critical CSS ── */}
      <link
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@800&family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        rel="stylesheet"
      />
      <style dangerouslySetInnerHTML={{ __html: `
        .material-symbols-outlined {
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
          display: inline-block; line-height: 1; text-transform: none;
          letter-spacing: normal; word-wrap: normal; white-space: nowrap; direction: ltr;
        }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .product-card-hover:active { transform: scale(0.97); transition: transform 0.15s ease-in-out; }
        @keyframes pulse-live {
          0%   { transform: scale(0.95); opacity: 0.8; }
          50%  { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0.8; }
        }
        .pulse-live { animation: pulse-live 1.5s infinite ease-in-out; }
        .active-pill { box-shadow: 0 4px 12px rgba(120, 0, 15, 0.15); }
      `}} />

      {/* ══════════════════════════════════════════════════ */}
      {/* KIOSK LAYOUT  —  lg+                              */}
      {/* ══════════════════════════════════════════════════ */}
      <div className="hidden lg:block">

        {/* Header */}
        <header className="sticky top-0 z-50 flex justify-between items-center px-12 py-3 bg-white shadow-sm border-b border-[#f3e0be]/40">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="p-2 hover:bg-[#F5F5F5] rounded-full transition-colors active:scale-95"
            >
              <span className="material-symbols-outlined text-[#78000f]">arrow_back</span>
            </button>
            <h1 className="text-[22px] font-extrabold text-[#78000f] tracking-tight" style={JKT}>
              RAKKEN COFFEE
            </h1>
          </div>

          {/* Centre search */}
          <div className="flex-1 max-w-md mx-16">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#998075]" style={{ fontSize: '20px' }}>
                search
              </span>
              <input
                className="w-full bg-[#F5F5F5] border-none rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#78000f]/20 focus:bg-white transition-all"
                style={JKT}
                placeholder="Search your favorite coffee..."
                value={searchQuery}
                onChange={onSearchChange}
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); setDebouncedSearch(''); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#998075] hover:text-[#323131] transition-colors"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                </button>
              )}
            </div>
          </div>

          {/* Right icons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/cart-new')}
              className="relative p-2 hover:bg-[#F5F5F5] rounded-full transition-colors active:scale-95"
            >
              <span className="material-symbols-outlined text-[#78000f]">shopping_bag</span>
              {itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-[#78000f] text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full" style={JKT}>
                  {itemCount}
                </span>
              )}
            </button>
            <button className="p-2 hover:bg-[#F5F5F5] rounded-full transition-colors">
              <span className="material-symbols-outlined text-[#78000f]">person</span>
            </button>
          </div>
        </header>

        {/* Category Pills */}
        <div className="sticky top-[72px] z-40 py-3 bg-[#fff8f2]/95 backdrop-blur-sm border-b border-[#f3e0be]/40">
          <CategoryPills
            categories={categories}
            selected={selectedCategory}
            onSelect={handleScrollToCategory}
          />
        </div>

        {/* Main Content */}
        <main className="px-12 pb-40 pt-6">
          {loading ? (
            <KioskSkeleton />
          ) : debouncedSearch ? (
            <div>
              <h2 className="text-[26px] font-bold text-[#323131] mb-6" style={JKT}>
                Hasil: "{debouncedSearch}"
              </h2>
              {filteredItems.length === 0 ? (
                <SearchEmpty query={debouncedSearch} isMobile={false} />
              ) : (
                <div className="grid grid-cols-3 gap-6">
                  {filteredItems.map((item: MenuItem) => (
                    <KioskProductCard key={item.id} item={item} onSelect={() => setSelectedItem(item)} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-12">
              {categories.map((cat: Category) => {
                const group = groupedItems?.[cat.slug];
                if (!group) return null;
                return (
                  <div key={cat.slug} id={`mnew-${cat.slug}`} className="scroll-mt-40">
                    <div className="flex items-center gap-3 mb-6">
                      <h2 className="text-[20px] font-bold text-[#323131] whitespace-nowrap" style={JKT}>
                        {cat.name}
                      </h2>
                      <div className="h-px bg-[#f3e0be] flex-1 ml-2" />
                    </div>
                    <div className="grid grid-cols-3 gap-6">
                      {group.items.map((item: MenuItem) => (
                        <KioskProductCard key={item.id} item={item} onSelect={() => setSelectedItem(item)} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>

        {/* Floating Cart Bar */}
        <div
          className={`fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ease-out ${
            itemCount > 0 ? 'translate-y-0' : 'translate-y-full'
          }`}
        >
          <div className="mx-12 mb-4 bg-[#78000f] text-white rounded-2xl shadow-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>shopping_bag</span>
                <span
                  className="absolute -top-1 -right-1 bg-white text-[#78000f] text-[10px] font-bold h-5 w-5 flex items-center justify-center rounded-full"
                  style={JKT}
                >
                  {itemCount}
                </span>
              </div>
              <div>
                <p className="text-[11px] font-[500] opacity-80 uppercase tracking-widest" style={JKT}>
                  Total Pesanan
                </p>
                <p className="text-[18px] font-[600]" style={JKT}>{formatCurrency(totalAmount)}</p>
              </div>
            </div>
            <button
              onClick={() => router.push('/cart-new')}
              className="bg-white text-[#78000f] px-8 py-2.5 rounded-xl text-[16px] font-[600] hover:bg-[#F5F5F5] transition-colors active:scale-95"
              style={JKT}
            >
              Lihat Keranjang →
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════ */}
      {/* MOBILE LAYOUT  —  <lg                             */}
      {/* ══════════════════════════════════════════════════ */}
      <div className="lg:hidden">

        {/* Header */}
        <header className="sticky top-0 z-50 flex justify-between items-center px-4 py-3 bg-white shadow-sm border-b border-[#f3e0be]/30">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/')}
              className="p-1.5 hover:bg-[#F5F5F5] rounded-full transition-colors active:scale-95"
            >
              <span className="material-symbols-outlined text-[#78000f]" style={{ fontSize: '20px' }}>arrow_back</span>
            </button>
            <span className="text-[17px] font-extrabold text-[#78000f] tracking-tight" style={JKT}>
              RAKKEN COFFEE
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/cart-new')}
              className="relative p-1.5 hover:bg-[#F5F5F5] rounded-full transition-colors active:scale-95"
            >
              <span className="material-symbols-outlined text-[#78000f]" style={{ fontSize: '22px' }}>shopping_bag</span>
              {itemCount > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 bg-[#78000f] text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full"
                  style={JKT}
                >
                  {itemCount}
                </span>
              )}
            </button>
            <button className="p-1.5 hover:bg-[#F5F5F5] rounded-full transition-colors">
              <span className="material-symbols-outlined text-[#78000f]" style={{ fontSize: '22px' }}>person</span>
            </button>
          </div>
        </header>

        {/* Search Bar */}
        <div className="px-4 pt-3 pb-2 bg-[#fff8f2]">
          <div className="relative w-full">
            <input
              className="w-full bg-white border border-[#f3e0be] rounded-xl px-4 py-3 text-[14px] focus:border-[#78000f] focus:ring-2 focus:ring-[#78000f]/10 outline-none transition-all"
              style={JKT}
              placeholder="Find your perfect brew..."
              value={searchQuery}
              onChange={onSearchChange}
            />
            {searchQuery ? (
              <button
                onClick={() => { setSearchQuery(''); setDebouncedSearch(''); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#998075]"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
              </button>
            ) : (
              <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-[#998075]" style={{ fontSize: '20px' }}>
                search
              </span>
            )}
          </div>
        </div>

        {/* Category Scroll */}
        <div className="bg-[#fff8f2] border-b border-[#f3e0be]/30">
          <CategoryPills
            categories={categories}
            selected={selectedCategory}
            onSelect={handleScrollToCategory}
            compact
          />
        </div>

        {/* Main Content */}
        <main className="pb-28 px-4 pt-4">
          {loading ? (
            <MobileSkeleton />
          ) : debouncedSearch ? (
            <div>
              <h2 className="text-[18px] font-bold text-[#323131] mb-4" style={JKT}>
                Hasil: "{debouncedSearch}"
              </h2>
              {filteredItems.length === 0 ? (
                <SearchEmpty query={debouncedSearch} isMobile />
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {filteredItems.map((item: MenuItem) => (
                    <MobileProductCard key={item.id} item={item} onSelect={() => setSelectedItem(item)} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-[20px] font-bold text-[#231a05]" style={JKT}>Menu Kami</h2>
                <div className="flex items-center gap-1.5 text-[#78000f]">
                  <span className="w-2 h-2 rounded-full bg-[#78000f] pulse-live inline-block" />
                  <span className="text-[12px] font-[500]" style={JKT}>Live</span>
                </div>
              </div>
              <div className="space-y-8">
                {categories.map((cat: Category) => {
                  const group = groupedItems?.[cat.slug];
                  if (!group) return null;
                  return (
                    <div key={cat.slug} id={`mnew-${cat.slug}`} className="scroll-mt-52">
                      <h3 className="text-[15px] font-[600] text-[#323131] mb-3" style={JKT}>
                        {cat.name}
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        {group.items.map((item: MenuItem) => (
                          <MobileProductCard key={item.id} item={item} onSelect={() => setSelectedItem(item)} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>

        {/* Cart FAB */}
        {itemCount > 0 && (
          <button
            onClick={() => router.push('/cart-new')}
            className="fixed bottom-24 right-5 z-50 bg-[#78000f] text-white w-14 h-14 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-all overflow-hidden"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '26px' }}>shopping_cart</span>
            <div
              className="absolute -top-1 -right-1 bg-white text-[#78000f] w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] border-2 border-[#78000f]"
              style={JKT}
            >
              {itemCount}
            </div>
          </button>
        )}

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 w-full z-50 flex justify-around items-center px-4 py-2 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.08)] rounded-t-xl">
          <button className="flex flex-col items-center gap-0.5 bg-[#78000f] text-white rounded-full px-4 py-1.5 active:scale-95 transition-transform">
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>coffee</span>
            <span className="text-[10px] font-[500]" style={JKT}>Menu</span>
          </button>
          <button
            onClick={() => router.push('/cart-new')}
            className="flex flex-col items-center gap-0.5 text-[#998075] hover:text-[#78000f] active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>shopping_cart</span>
            <span className="text-[10px] font-[500]" style={JKT}>Keranjang</span>
          </button>
          <button className="flex flex-col items-center gap-0.5 text-[#998075] hover:text-[#78000f] active:scale-95 transition-all">
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>receipt_long</span>
            <span className="text-[10px] font-[500]" style={JKT}>Riwayat</span>
          </button>
        </nav>
      </div>

      {/* ── CustomizeModal — shared between both layouts ── */}
      {selectedItem && (
        <CustomizeModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}
