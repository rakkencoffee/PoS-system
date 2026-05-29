'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/stores/useCartStore';
import { useMenuItems, MenuItem } from '@/hooks/useMenu';
import CustomizeModal from '@/components/kiosk/CustomizeModal';
import { CartItem } from '@/lib/types';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const isFoodCategory = (categoryName?: string) => {
  if (!categoryName) return false;
  const lower = categoryName.toLowerCase();
  return ['dessert', 'snack', 'main-course', 'bites', 'makanan', 'makanan utama', 'cemilan'].some(c => lower.includes(c));
};

export default function CartPage() {
  const router = useRouter();
  const { items, removeItem, updateQuantity, itemCount, totalAmount, setCustomerName, customerName } = useCartStore();
  const { data: allMenuItems = [] } = useMenuItems('all');

  // Edit state
  const [editingCartItem, setEditingCartItem] = useState<CartItem | null>(null);
  const [editingMenuItem, setEditingMenuItem] = useState<MenuItem | null>(null);

  const isNameValid = customerName.trim().length >= 2;

  const handleEditItem = (cartItem: CartItem) => {
    // Find the full menu item data (with sizes, variants, category, etc.)
    const menuItem = allMenuItems.find(
      (m) => String(m.id) === String(cartItem.menuItemId)
    );

    if (menuItem) {
      setEditingMenuItem(menuItem);
      setEditingCartItem(cartItem);
    }
  };

  if (itemCount === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="glass sticky top-0 z-50 px-6 py-4">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <button onClick={() => router.push('/menu')} className="btn-ghost flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <h1 className="text-xl font-bold text-gradient">Your Cart</h1>
            <div className="w-16" />
          </div>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <span className="text-7xl mb-6 animate-float">🛒</span>
          <h2 className="text-2xl font-bold text-(--text-primary) mb-2">Your cart is empty</h2>
          <p className="text-(--text-muted) mb-8">Add some delicious items to get started!</p>
          <button onClick={() => router.push('/menu')} className="btn-primary px-8">
            Browse Menu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="glass sticky top-0 z-50 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <button onClick={() => router.push('/menu')} className="btn-ghost flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-xl font-bold text-gradient">Your Cart</h1>
          <span className="text-sm text-(--text-muted)">{itemCount} items</span>
        </div>
      </header>

      <div className="flex-1 px-6 py-6 max-w-3xl mx-auto w-full space-y-4">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="glass-card p-4 animate-fade-in"
            style={{ animationDelay: `${index * 0.05}s`, opacity: 0 }}
          >
            <div className="flex gap-4">
              {/* Icon */}
              <div className="w-16 h-16 rounded-xl bg-linear-to-br from-white/10 to-white/5 flex items-center justify-center shrink-0">
                {item.image ? (
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover rounded-xl" />
                ) : (
                  <span className="text-2xl">☕</span>
                )}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-(--text-primary) truncate pr-2">{item.name}</h3>
                  <div className="flex items-center gap-2 shrink-0 -mt-1">
                    <span className="font-semibold text-(--text-secondary) text-sm">
                      {formatCurrency(item.price)}
                    </span>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-(--text-muted) hover:text-red-400 transition-colors p-1"
                      title="Remove item"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Customizations */}
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {item.size && item.size !== '-' && item.size !== '' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-(--bg-secondary) text-(--text-secondary) font-medium">
                      {isFoodCategory(item.category) ? `Option: ${item.size}` : `Size ${item.size}`}
                    </span>
                  )}
                  {item.sugarLevel && item.sugarLevel !== 'normal' && item.sugarLevel !== '' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-(--bg-secondary) text-(--text-secondary) font-medium">
                      Sugar {item.sugarLevel}
                    </span>
                  )}
                  {item.iceLevel && item.iceLevel !== 'none' && item.iceLevel !== '' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-(--bg-secondary) text-(--text-secondary) font-medium">
                      Ice: {item.iceLevel}
                    </span>
                  )}
                  {item.extraShot && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--brand-100)] text-[var(--brand-700)] font-bold">
                      +Shot
                    </span>
                  )}
                </div>

                {/* Price additions (Toppings & Premium Customizations) */}
                {item.toppings && item.toppings.length > 0 && (
                  <div className="mt-2.5 space-y-1 pl-1 border-t border-(--border-subtle)/20 pt-2">
                    {item.toppings.map((t) => (
                      <div key={t.id} className="flex justify-between text-xs text-(--text-secondary)">
                        <span>• {t.name}</span>
                        <span className="font-semibold text-(--brand-500)">
                          +{formatCurrency(t.price)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Price, Edit & Quantity */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-4 pt-3 border-t border-(--border-subtle)/20 gap-3">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-(--brand-500) text-base">{formatCurrency(item.subtotal)}</span>
                    <button
                      onClick={() => handleEditItem(item)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--brand-100)] hover:bg-[var(--brand-200)] text-[var(--brand-700)] font-bold text-xs active:scale-95 transition-all shadow-xs"
                      title="Edit Customization"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      Edit Customization
                    </button>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    <span className="text-xs text-(--text-muted) sm:hidden">Quantity</span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="w-8 h-8 rounded-full bg-(--bg-card) border border-(--border-subtle) flex items-center justify-center text-(--text-primary) active:scale-90 transition-transform"
                      >
                        −
                      </button>
                      <span className="font-semibold text-(--text-primary) w-6 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="w-8 h-8 rounded-full bg-[var(--brand-500)] flex items-center justify-center text-white active:scale-90 transition-transform"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Customer Name Input */}
        <div className="glass-card p-4 mt-8">
          <label htmlFor="customerName" className="block text-sm font-medium text-(--text-secondary) mb-2">
            Customer Name <span className="text-red-500">*</span>
          </label>
          <input
            id="customerName"
            type="text"
            placeholder="Enter your name to proceed..."
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="w-full bg-(--bg-card) border border-(--border-subtle) rounded-xl px-4 py-3 text-(--text-primary) placeholder-(--text-muted) focus:outline-none focus:border-[#A8131E] transition-colors"
            required
            minLength={2}
          />
          <p className="text-[10px] text-(--text-muted) mt-2">
            * Required for calling your order when it's ready.
          </p>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="sticky bottom-0 glass p-6 border-t border-(--border-subtle)">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-(--text-secondary)">Total</span>
            <span className="text-2xl font-bold text-gradient">{formatCurrency(totalAmount)}</span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/menu')}
              className="btn-secondary flex-1"
            >
              + Add More
            </button>
            <button
              onClick={() => router.push('/checkout')}
              disabled={!isNameValid}
              className={`btn-primary flex-2 ${!isNameValid ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
            >
              {isNameValid ? 'Checkout' : 'Enter Name to Checkout'}
            </button>
          </div>
        </div>
      </div>

      {/* Edit Item Modal */}
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
