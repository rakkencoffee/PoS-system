'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/stores/useCartStore';
import { useMenuItems, MenuItem } from '@/hooks/useMenu';
import dynamic from 'next/dynamic';
const CustomizeModal = dynamic(() => import('@/components/kiosk/CustomizeModal'), {
  ssr: false,
});
import { CartItem } from '@/lib/types';
import { KioskHeader } from '@/components/kiosk/KioskHeader';

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

const JKT = { fontFamily: 'var(--font-plus-jakarta-sans), sans-serif' } as const;

function buildCustomText(item: CartItem): string {
  const parts: string[] = [];
  if (item.size && item.size !== '-' && item.size !== '') parts.push(item.size);
  if (item.sugarLevel && item.sugarLevel !== 'normal' && item.sugarLevel !== '') parts.push(`Sugar ${item.sugarLevel}`);
  if (item.iceLevel && item.iceLevel !== 'none' && item.iceLevel !== '') parts.push(`Ice ${item.iceLevel}`);
  if (item.extraShot) parts.push('Extra Shot');
  item.toppings?.forEach((t) => parts.push(t.name));
  return parts.join(' • ') || 'Standard';
}

/* ─────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────── */

function QuantityStepper({
  qty,
  onDec,
  onInc,
  size = 'md',
}: {
  qty: number;
  onDec: () => void;
  onInc: () => void;
  size?: 'sm' | 'md';
}) {
  const btnSize = size === 'sm' ? 'w-8 h-8' : 'w-9 h-9';
  const textSize = size === 'sm' ? 'text-[15px]' : 'text-[17px]';
  return (
    <div className="flex items-center bg-[#F5F5F5] rounded-full px-1 py-1 gap-3 border border-[#f3e0be] shadow-inner">
      <button
        onClick={onDec}
        className={`${btnSize} flex items-center justify-center rounded-full bg-white text-[#323131] shadow-sm active:scale-90 transition-transform`}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>remove</span>
      </button>
      <span className={`${textSize} font-bold text-[#323131] w-5 text-center`} style={JKT}>
        {qty}
      </span>
      <button
        onClick={onInc}
        className={`${btnSize} flex items-center justify-center rounded-full bg-[#78000f] text-white shadow-sm active:scale-90 transition-transform`}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
      </button>
    </div>
  );
}

function KioskCartItemCard({
  item,
  onRemove,
  onDec,
  onInc,
  onEdit,
}: {
  item: CartItem;
  onRemove: () => void;
  onDec: () => void;
  onInc: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="bg-white border border-[#f3e0be] rounded-xl p-4 flex gap-3 items-center shadow-sm hover:shadow-md transition-shadow group">
      {/* Image */}
      <div className="w-24 h-24 rounded-lg overflow-hidden bg-[#F5F5F5] shrink-0">
        {item.image ? (
          <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl opacity-30">☕</div>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start">
          <div className="flex-1 min-w-0 pr-2">
            <h3 className="text-[18px] font-[600] text-[#323131] truncate" style={JKT}>{item.name}</h3>
            <p className="text-[12px] text-[#998075] mt-0.5 line-clamp-1" style={JKT}>{buildCustomText(item)}</p>
            {item.toppings && item.toppings.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {item.toppings.map((t) => (
                  <span key={t.id} className="text-[11px] bg-[#fff2de] text-[#78000f] px-2 py-0.5 rounded-full font-[500]" style={JKT}>
                    +{t.name} {formatCurrency(t.price)}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onEdit}
              className="p-1.5 text-[#998075] hover:text-[#78000f] hover:bg-[#F5E6E8] rounded-lg transition-colors active:scale-95"
              title="Edit"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
            </button>
            <button
              onClick={onRemove}
              className="p-1.5 text-[#998075] hover:text-[#ba1a1a] hover:bg-[#ffdad6] rounded-lg transition-colors active:scale-95"
              title="Hapus"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
            </button>
          </div>
        </div>
        <div className="flex justify-between items-center mt-3">
          <span className="text-[20px] font-bold text-[#78000f]" style={JKT}>{formatCurrency(item.subtotal)}</span>
          <QuantityStepper qty={item.quantity} onDec={onDec} onInc={onInc} />
        </div>
      </div>
    </div>
  );
}

function MobileCartItemCard({
  item,
  onRemove,
  onDec,
  onInc,
  onEdit,
}: {
  item: CartItem;
  onRemove: () => void;
  onDec: () => void;
  onInc: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="bg-white border border-[#f3e0be] rounded-[20px] p-4 shadow-sm flex items-center gap-3">
      {/* Image */}
      <div className="w-20 h-20 rounded-xl overflow-hidden bg-[#F5F5F5] shrink-0">
        {item.image ? (
          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl opacity-30">☕</div>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start">
          <h3 className="text-[15px] font-[600] text-[#231a05] pr-1 line-clamp-1" style={JKT}>{item.name}</h3>
          <div className="flex items-center gap-0.5 shrink-0">
            <button onClick={onEdit} className="text-[#998075] active:text-[#78000f] p-1 transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
            </button>
            <button onClick={onRemove} className="text-[#998075] active:text-[#ba1a1a] p-1 transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
            </button>
          </div>
        </div>
        <p className="text-[11px] text-[#998075] mb-2 line-clamp-1" style={JKT}>{buildCustomText(item)}</p>
        <div className="flex justify-between items-center">
          <span className="text-[15px] font-bold text-[#78000f]" style={JKT}>{formatCurrency(item.subtotal)}</span>
          <QuantityStepper qty={item.quantity} onDec={onDec} onInc={onInc} size="sm" />
        </div>
      </div>
    </div>
  );
}

function EmptyCart({ onBrowse, isMobile }: { onBrowse: () => void; isMobile: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${isMobile ? 'py-20 px-6' : 'py-24'}`}>
      <div className="w-24 h-24 rounded-full bg-[#fff2de] flex items-center justify-center mb-6">
        <span className="material-symbols-outlined text-[#78000f]" style={{ fontSize: '48px' }}>shopping_cart</span>
      </div>
      <h2 className={`font-bold text-[#323131] mb-2 ${isMobile ? 'text-[20px]' : 'text-[24px]'}`} style={JKT}>
        Keranjang Kosong
      </h2>
      <p className="text-[14px] text-[#998075] mb-6 max-w-xs" style={JKT}>
        Belum ada item di keranjangmu. Yuk pilih menu favoritmu!
      </p>
      <button
        onClick={onBrowse}
        className="bg-[#78000f] text-white px-8 py-3 rounded-full text-[15px] font-[600] hover:bg-[#7D0F18] transition-colors active:scale-95 flex items-center gap-2"
        style={JKT}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>coffee</span>
        Lihat Menu
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main Page
───────────────────────────────────────────── */
export default function CartNewPage() {
  const router = useRouter();
  const {
    items,
    removeItem,
    updateQuantity,
    itemCount,
    totalAmount,
    setCustomerName,
    customerName,
    setCustomerPhone,
    customerPhone,
  } = useCartStore();

  const { data: allMenuItems = [] } = useMenuItems('all');

  const [editingCartItem, setEditingCartItem] = useState<CartItem | null>(null);
  const [editingMenuItem, setEditingMenuItem] = useState<MenuItem | null>(null);
  const [returningName, setReturningName] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const goSearch = (value: string) => router.push(`/menu?search=${encodeURIComponent(value)}`);

  const isNameValid = customerName.trim().length >= 2;

  // CRM (F5): when a (valid) phone is entered, greet returning customers.
  // Debounced + non-blocking; failures are silently ignored.
  useEffect(() => {
    const digits = customerPhone.replace(/\D/g, '');
    if (digits.length < 8) {
      setReturningName(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/customers/lookup?phone=${encodeURIComponent(digits)}`);
        const data = await res.json();
        if (data?.found && data.name) {
          setReturningName(data.name);
          // Pre-fill the name for the customer if they haven't typed one.
          if (!customerName.trim()) setCustomerName(data.name);
        } else {
          setReturningName(null);
        }
      } catch {
        setReturningName(null);
      }
    }, 600);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerPhone]);

  const handleEdit = (cartItem: CartItem) => {
    const menuItem = allMenuItems.find(
      (m) => String(m.id) === String(cartItem.menuItemId)
    );
    if (menuItem) {
      setEditingMenuItem(menuItem);
      setEditingCartItem(cartItem);
    }
  };

  const handleCheckout = () => {
    if (isNameValid) router.push('/checkout');
  };

  return (
    <div className="min-h-dvh bg-[#fff8f2]" style={JKT}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes live-pulse {
          0%,100% { opacity:1; transform:scale(1); }
          50% { opacity:0.7; transform:scale(1.1); }
        }
        .live-pulse { animation: live-pulse 1.5s infinite ease-in-out; }
      `}} />

      {/* ══════════════════════════════════════════════════ */}
      {/* KIOSK LAYOUT  —  lg+                              */}
      {/* ══════════════════════════════════════════════════ */}
      <div className="hidden lg:block">

        <KioskHeader
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          onSearchSubmit={goSearch}
          itemCount={itemCount}
        />

        {/* Main Content */}
        <main className="max-w-[1440px] mx-auto px-12 py-8 pb-24">
          {/* Page Header */}
          <header className="mb-8">
            <h2 className="text-[28px] font-bold text-[#231a05]" style={JKT}>Keranjang Belanja</h2>
            <p className="text-[14px] text-[#998075] mt-1" style={JKT}>
              Periksa kembali pesanan anda sebelum melanjutkan ke pembayaran.
            </p>
          </header>

          {itemCount === 0 ? (
            <EmptyCart onBrowse={() => router.push('/menu')} isMobile={false} />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-10 gap-8 items-start">

              {/* ── LEFT: Item List (6/10) ── */}
              <div className="lg:col-span-6 space-y-3">
                {items.map((item) => (
                  <KioskCartItemCard
                    key={item.id}
                    item={item}
                    onRemove={() => removeItem(item.id)}
                    onDec={() => updateQuantity(item.id, item.quantity - 1)}
                    onInc={() => updateQuantity(item.id, item.quantity + 1)}
                    onEdit={() => handleEdit(item)}
                  />
                ))}

                {/* Add more bento */}
                <button
                  onClick={() => router.push('/menu')}
                  className="w-full bg-[#fff2de] border border-[#f3e0be] border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center gap-2 opacity-80 hover:opacity-100 transition-opacity cursor-pointer active:scale-[0.99]"
                >
                  <span className="material-symbols-outlined text-[#78000f]" style={{ fontSize: '32px' }}>add_circle</span>
                  <p className="text-[17px] font-[600] text-[#5a403f]" style={JKT}>Ingin tambah minuman lagi?</p>
                  <p className="text-[13px] text-[#998075]" style={JKT}>Lihat menu rekomendasi kami untuk kamu.</p>
                </button>
              </div>

              {/* ── RIGHT: Summary Panel (4/10) ── */}
              <aside className="lg:col-span-4 sticky top-24 space-y-3">
                <div className="bg-white border border-[#f3e0be] rounded-xl p-6 shadow-lg">
                  <h3 className="text-[22px] font-[600] text-[#323131] mb-4" style={JKT}>Detail Pesanan</h3>

                  {/* Customer Name */}
                  <div className="mb-6">
                    <label className="block text-[13px] font-[500] text-[#998075] mb-1 uppercase tracking-widest" style={JKT}>
                      Nama Kamu
                    </label>
                    <input
                      className={`w-full bg-[#F5F5F5] rounded-lg px-4 py-3 text-[14px] text-[#231a05] outline-none transition-all focus:ring-2 focus:bg-white border ${
                        isNameValid
                          ? 'border-[#f3e0be] focus:ring-[#78000f]/20 focus:border-[#78000f]'
                          : 'border-[#ffdad6] focus:ring-[#ba1a1a]/20 focus:border-[#ba1a1a]'
                      }`}
                      style={JKT}
                      placeholder="Masukkan nama untuk pesanan..."
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                    />
                    {!isNameValid && customerName.length > 0 && (
                      <p className="text-[11px] text-[#ba1a1a] mt-1" style={JKT}>Nama minimal 2 karakter</p>
                    )}
                  </div>

                  {/* Phone (optional, CRM) */}
                  <div className="mb-6">
                    <label className="block text-[13px] font-[500] text-[#998075] mb-1 uppercase tracking-widest" style={JKT}>
                      No. HP <span className="normal-case tracking-normal text-[#bbab93]">(opsional)</span>
                    </label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      className="w-full bg-[#F5F5F5] rounded-lg px-4 py-3 text-[14px] text-[#231a05] outline-none transition-all focus:ring-2 focus:bg-white border border-[#f3e0be] focus:ring-[#78000f]/20 focus:border-[#78000f]"
                      style={JKT}
                      placeholder="Untuk kumpulkan poin / member"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value.replace(/[^\d+]/g, ''))}
                    />
                    {returningName && (
                      <p className="text-[12px] text-[#0f7d3b] mt-1.5 flex items-center gap-1" style={JKT}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>waving_hand</span>
                        Selamat datang kembali, {returningName}!
                      </p>
                    )}
                  </div>

                  {/* Price Breakdown */}
                  <div className="space-y-2 border-t border-[#f3e0be] pt-4 mb-6">
                    <div className="flex justify-between items-center">
                      <span className="text-[14px] text-[#998075]" style={JKT}>Subtotal ({itemCount} item)</span>
                      <span className="text-[15px] font-[600] text-[#323131]" style={JKT}>{formatCurrency(totalAmount)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-[#f3e0be] mt-2">
                      <span className="text-[17px] font-[600] text-[#323131]" style={JKT}>Total</span>
                      <span className="text-[22px] font-bold text-[#78000f]" style={JKT}>{formatCurrency(totalAmount)}</span>
                    </div>
                  </div>

                  {/* CTA */}
                  <button
                    onClick={handleCheckout}
                    disabled={!isNameValid}
                    className={`w-full py-3 rounded-full text-[17px] font-[600] flex items-center justify-center gap-2 shadow-md active:scale-[0.97] transition-all ${
                      isNameValid
                        ? 'bg-[#78000f] text-white hover:bg-[#7D0F18]'
                        : 'bg-[#f3e0be] text-[#998075] cursor-not-allowed'
                    }`}
                    style={JKT}
                  >
                    {isNameValid ? 'Lanjut ke Checkout' : 'Masukkan Nama Dahulu'}
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>arrow_forward</span>
                  </button>

                  <div className="mt-3 flex items-center justify-center gap-1.5 text-[#998075]">
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>verified_user</span>
                    <span className="text-[12px]" style={JKT}>Pembayaran Aman &amp; Terenkripsi</span>
                  </div>
                </div>

                {/* Promo card */}
                <div className="bg-[#78000f] text-white p-4 rounded-xl flex items-center justify-between overflow-hidden relative">
                  <div className="z-10">
                    <p className="text-[11px] font-[500] opacity-80 uppercase tracking-widest mb-0.5" style={JKT}>Penawaran Terbatas</p>
                    <h4 className="text-[16px] font-bold" style={JKT}>Promo Bundle Sarapan!</h4>
                    <p className="text-[12px] opacity-70 mt-0.5" style={JKT}>Hemat Rp 15rb untuk Croissant.</p>
                  </div>
                  <span className="material-symbols-outlined absolute -right-3 -bottom-1 opacity-20" style={{ fontSize: '80px' }}>celebration</span>
                </div>
              </aside>
            </div>
          )}
        </main>
      </div>

      {/* ══════════════════════════════════════════════════ */}
      {/* MOBILE LAYOUT  —  <lg                             */}
      {/* ══════════════════════════════════════════════════ */}
      <div className="lg:hidden flex flex-col min-h-dvh">

        {/* Header */}
        <header className="sticky top-0 z-50 flex justify-between items-center px-4 py-3 bg-white shadow-sm border-b border-[#f3e0be]/30">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/menu')}
              className="w-10 h-10 flex items-center justify-center rounded-full active:scale-95 transition-transform hover:bg-[#F5F5F5]"
            >
              <span className="material-symbols-outlined text-[#78000f]">arrow_back</span>
            </button>
            <img src="/rakken-icon.svg" alt="Rakken Coffee" className="h-6 w-6 object-contain" />
            <h1 className="text-[17px] font-extrabold text-[#78000f] tracking-tight" style={JKT}>RAKKEN COFFEE</h1>
          </div>
          <div className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[#78000f] p-2">shopping_bag</span>
            <span className="material-symbols-outlined text-[#78000f] p-2">person</span>
          </div>
        </header>

        {itemCount === 0 ? (
          <div className="flex-1">
            <EmptyCart onBrowse={() => router.push('/menu')} isMobile />
          </div>
        ) : (
          <main className="flex-1 px-4 py-5 pb-[200px] space-y-5">
            {/* Name Input */}
            <section>
              <label className="block text-[12px] font-[500] text-[#998075] mb-2 uppercase tracking-widest" style={JKT}>
                Order For
              </label>
              <div className="relative">
                <input
                  className={`w-full bg-white border-[1.5px] rounded-xl px-4 py-3 text-[15px] text-[#231a05] focus:outline-none transition-all ${
                    isNameValid
                      ? 'border-[#f3e0be] focus:border-[#78000f] focus:ring-1 focus:ring-[#78000f]'
                      : 'border-[#ffdad6] focus:border-[#ba1a1a] focus:ring-1 focus:ring-[#ba1a1a]'
                  }`}
                  style={JKT}
                  placeholder="Masukkan namamu"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[#998075]" style={{ fontSize: '20px' }}>edit</span>
              </div>
            </section>

            {/* Phone (optional, CRM) */}
            <section>
              <label className="block text-[12px] font-[500] text-[#998075] mb-2 uppercase tracking-widest" style={JKT}>
                No. HP <span className="normal-case tracking-normal text-[#bbab93]">(opsional)</span>
              </label>
              <input
                type="tel"
                inputMode="numeric"
                className="w-full bg-white border-[1.5px] border-[#f3e0be] rounded-xl px-4 py-3 text-[15px] text-[#231a05] focus:outline-none focus:border-[#78000f] focus:ring-1 focus:ring-[#78000f] transition-all"
                style={JKT}
                placeholder="Untuk kumpulkan poin / member"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value.replace(/[^\d+]/g, ''))}
              />
              {returningName && (
                <p className="text-[12px] text-[#0f7d3b] mt-1.5 flex items-center gap-1" style={JKT}>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>waving_hand</span>
                  Selamat datang kembali, {returningName}!
                </p>
              )}
            </section>

            {/* Item List */}
            <section>
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-[22px] font-bold text-[#231a05]" style={JKT}>Your Order</h2>
                <span
                  className="text-[12px] font-[500] text-[#78000f] bg-[#F5E6E8] px-3 py-1 rounded-full live-pulse"
                  style={JKT}
                >
                  {itemCount} ITEM
                </span>
              </div>

              <div className="space-y-3">
                {items.map((item) => (
                  <MobileCartItemCard
                    key={item.id}
                    item={item}
                    onRemove={() => removeItem(item.id)}
                    onDec={() => updateQuantity(item.id, item.quantity - 1)}
                    onInc={() => updateQuantity(item.id, item.quantity + 1)}
                    onEdit={() => handleEdit(item)}
                  />
                ))}
              </div>
            </section>

            {/* Add more suggestion */}
            <div className="bg-[#fff2de] rounded-[24px] p-5 border border-[#f3e0be] border-dashed">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-[16px] font-[600] text-[#231a05]" style={JKT}>Tambah lagi?</h4>
                  <p className="text-[13px] text-[#998075]" style={JKT}>Lihat menu lainnya</p>
                </div>
                <span className="material-symbols-outlined text-[#78000f]" style={{ fontSize: '28px' }}>auto_awesome</span>
              </div>
              <button
                onClick={() => router.push('/menu')}
                className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-xl border border-[#f3e0be] shadow-sm active:scale-95 transition-transform"
              >
                <span className="material-symbols-outlined text-[#78000f]" style={{ fontSize: '18px' }}>add_circle</span>
                <span className="text-[13px] font-[500] text-[#323131]" style={JKT}>Tambah dari Menu</span>
              </button>
            </div>
          </main>
        )}

        {/* Fixed Bottom Panel */}
        {itemCount > 0 && (
          <footer className="fixed bottom-0 left-0 w-full z-50 bg-white shadow-[0_-8px_24px_rgba(0,0,0,0.08)] rounded-t-[28px] overflow-hidden">
            <div className="px-6 pt-5 pb-5">
              {/* Price Summary */}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-[14px] text-[#998075]" style={JKT}>Subtotal ({itemCount} item)</span>
                  <span className="text-[15px] font-[600] text-[#323131]" style={JKT}>{formatCurrency(totalAmount)}</span>
                </div>
                <div className="h-px bg-[#f3e0be] my-1" />
                <div className="flex justify-between items-center">
                  <span className="text-[20px] font-bold text-[#231a05]" style={JKT}>Total</span>
                  <span className="text-[22px] font-bold text-[#78000f]" style={JKT}>{formatCurrency(totalAmount)}</span>
                </div>
              </div>

              {/* Checkout Button */}
              <button
                onClick={handleCheckout}
                disabled={!isNameValid}
                className={`w-full py-5 rounded-full text-[18px] font-bold flex items-center justify-center gap-2 shadow-lg active:scale-[0.97] transition-all ${
                  isNameValid
                    ? 'bg-[#78000f] text-white'
                    : 'bg-[#f3e0be] text-[#998075] cursor-not-allowed'
                }`}
                style={JKT}
              >
                <span>{isNameValid ? 'Lanjut ke Checkout' : 'Masukkan Namamu Dulu'}</span>
                <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>arrow_forward</span>
              </button>
            </div>
          </footer>
        )}
      </div>

      {/* Edit Modal — shared */}
      {editingMenuItem && editingCartItem && (
        <CustomizeModal
          item={editingMenuItem}
          editingCartItem={editingCartItem}
          onClose={() => {
            setEditingMenuItem(null);
            setEditingCartItem(null);
          }}
        />
      )}
    </div>
  );
}
