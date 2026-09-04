'use client';

import { useRouter } from 'next/navigation';
import { KioskPrinterPairing } from './KioskPrinterPairing';

const JKT = { fontFamily: 'var(--font-plus-jakarta-sans)' };

interface KioskHeaderProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  /** Called on Enter — pages without a live product list use this to jump to /menu. */
  onSearchSubmit?: (value: string) => void;
  itemCount: number;
  searchPlaceholder?: string;
}

/**
 * Shared top header for the kiosk landscape (lg+) layout — used identically
 * across menu, cart, and checkout so the shopping flow doesn't visually
 * shift between steps.
 */
export function KioskHeader({
  searchValue,
  onSearchChange,
  onSearchSubmit,
  itemCount,
  searchPlaceholder = 'Search your favorite coffee...',
}: KioskHeaderProps) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-50 flex justify-between items-center px-12 py-3 bg-white shadow-sm border-b border-[#f3e0be]/40">
      <button
        onClick={() => router.push('/menu')}
        className="flex items-center gap-3"
      >
        <img src="/rakken-icon.svg" alt="Rakken Coffee" className="h-8 w-8 object-contain" />
        <h1 className="text-[22px] font-extrabold text-[#78000f] tracking-tight" style={JKT}>
          RAKKEN COFFEE
        </h1>
      </button>

      {/* Centre search */}
      <div className="flex-1 max-w-md mx-16">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#998075]" style={{ fontSize: '20px' }}>
            search
          </span>
          <input
            className="w-full bg-[#F5F5F5] border-none rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#78000f]/20 focus:bg-white transition-all"
            style={JKT}
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSearchSubmit?.(searchValue);
            }}
          />
          {searchValue && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#998075] hover:text-[#323131] transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
            </button>
          )}
        </div>
      </div>

      <KioskPrinterPairing />

      {/* Cart */}
      <button
        onClick={() => router.push('/cart')}
        className="relative flex items-center gap-2 px-4 py-2 rounded-xl border border-[#e5e5e5] bg-white hover:bg-[#F5F5F5] transition-colors active:scale-95 text-[#323131] font-[500] text-[14px]"
        style={JKT}
      >
        <svg className="w-5 h-5" style={{ color: '#78000f' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
        </svg>
        Cart
        {itemCount > 0 && (
          <span className="bg-[#78000f] text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full" style={JKT}>
            {itemCount}
          </span>
        )}
      </button>
    </header>
  );
}
