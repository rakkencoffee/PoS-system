'use client';

import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function CartPage() {
  const router = useRouter();
  const { cart, removeItem, updateQuantity, itemCount } = useCart();

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
        {cart.items.map((item, index) => (
          <div
            key={item.id}
            className="glass-card p-4 animate-fade-in"
            style={{ animationDelay: `${index * 0.05}s`, opacity: 0 }}
          >
            <div className="flex gap-4">
              {/* Icon */}
              <div className="w-16 h-16 rounded-xl bg-linear-to-br from-coffee-700/50 to-coffee-900/50 flex items-center justify-center shrink-0">
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
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-(--text-muted) hover:text-red-400 transition-colors p-1 -mt-1"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                {/* Customizations */}
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-coffee-800/50 text-coffee-300">
                    Size {item.size}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-coffee-800/50 text-coffee-300">
                    Sugar {item.sugarLevel}%
                  </span>
                  {item.iceLevel !== 'none' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-coffee-800/50 text-coffee-300">
                      Ice: {item.iceLevel}
                    </span>
                  )}
                  {item.extraShot && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-900/50 text-amber-300">
                      +Shot
                    </span>
                  )}
                  {item.toppings.map((t) => (
                    <span key={t.id} className="text-xs px-2 py-0.5 rounded-full bg-coffee-800/50 text-coffee-300">
                      {t.name}
                    </span>
                  ))}
                </div>

                {/* Price & Quantity */}
                <div className="flex items-center justify-between mt-3">
                  <span className="font-bold text-coffee-300">{formatCurrency(item.subtotal)}</span>
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
                      className="w-8 h-8 rounded-full bg-linear-to-r from-coffee-500 to-amber-600 flex items-center justify-center text-white active:scale-90 transition-transform"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div className="sticky bottom-0 glass p-6 border-t border-(--border-subtle)">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-(--text-secondary)">Total</span>
            <span className="text-2xl font-bold text-gradient">{formatCurrency(cart.totalAmount)}</span>
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
              className="btn-primary flex-2"
            >
              Checkout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
