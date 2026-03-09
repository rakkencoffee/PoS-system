'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';

declare global {
  interface Window {
    snap?: {
      pay: (
        token: string,
        options: {
          onSuccess?: (result: Record<string, unknown>) => void;
          onPending?: (result: Record<string, unknown>) => void;
          onError?: (result: Record<string, unknown>) => void;
          onClose?: () => void;
        }
      ) => void;
    };
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, clearCart, itemCount } = useCart();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string>('');
  const [snapLoaded, setSnapLoaded] = useState(false);
  const checkoutInProgress = useRef(false);

  useEffect(() => {
    if (itemCount === 0 && !checkoutInProgress.current) {
      router.push('/menu');
    }
  }, [itemCount, router]);

  // Load Midtrans Snap.js dynamically
  const loadSnapScript = useCallback(async () => {
    if (window.snap) {
      setSnapLoaded(true);
      return;
    }

    try {
      const res = await fetch('/api/payment/config');
      const config = await res.json();

      const script = document.createElement('script');
      script.src = config.snapUrl;
      script.setAttribute('data-client-key', config.clientKey);
      script.onload = () => setSnapLoaded(true);
      script.onerror = () => console.error('Failed to load Midtrans Snap');
      document.head.appendChild(script);
    } catch (error) {
      console.error('Error loading payment config:', error);
    }
  }, []);

  useEffect(() => {
    loadSnapScript();
  }, [loadSnapScript]);

  const handleCheckout = async () => {
    checkoutInProgress.current = true;
    setIsProcessing(true);
    setPaymentStatus('Creating payment...');

    try {
      // 1. Create payment (order in POS + Midtrans Snap token)
      const res = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.items.map((item) => ({
            productId: String(item.menuItemId),
            name: item.name,
            price: item.subtotal / item.quantity,
            quantity: item.quantity,
            variantId: item.size,
            note: [
              item.sugarLevel && `Sugar: ${item.sugarLevel}`,
              item.iceLevel && `Ice: ${item.iceLevel}`,
              item.extraShot && 'Extra Shot',
              item.toppings.length && `Toppings: ${item.toppings.map((t) => t.name).join(', ')}`,
            ]
              .filter(Boolean)
              .join('; '),
          })),
          totalAmount: cart.totalAmount,
        }),
      });

      if (!res.ok) throw new Error('Failed to create payment');

      const { snapToken, orderId } = await res.json();

      setPaymentStatus('Opening payment...');

      // 2. Open Midtrans Snap popup
      if (window.snap) {
        window.snap.pay(snapToken, {
          onSuccess: () => {
            setPaymentStatus('Payment successful!');
            clearCart();
            router.push(`/success?orderId=${orderId}`);
          },
          onPending: () => {
            setPaymentStatus('Waiting for payment...');
            clearCart();
            router.push(`/status?orderId=${orderId}&status=pending`);
          },
          onError: () => {
            setPaymentStatus('');
            setIsProcessing(false);
            checkoutInProgress.current = false;
            alert('Payment failed. Please try again.');
          },
          onClose: () => {
            setPaymentStatus('');
            setIsProcessing(false);
            checkoutInProgress.current = false;
          },
        });
      } else {
        // Fallback: redirect to Midtrans payment page
        const { redirectUrl } = await res.json();
        window.location.href = redirectUrl;
      }
    } catch (error) {
      console.error('Checkout error:', error);
      setIsProcessing(false);
      setPaymentStatus('');
      checkoutInProgress.current = false;
      alert('Failed to create payment. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="glass sticky top-0 z-50 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <button onClick={() => router.push('/cart')} className="btn-ghost flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Cart
          </button>
          <h1 className="text-xl font-bold text-gradient">Checkout</h1>
          <div className="w-16" />
        </div>
      </header>

      <div className="flex-1 px-6 py-6 max-w-3xl mx-auto w-full space-y-6">
        {/* Order Summary */}
        <div className="glass-card p-5 animate-fade-in">
          <h2 className="text-lg font-semibold text-(--text-primary) mb-4">Order Summary</h2>
          <div className="space-y-3">
            {cart.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-(--text-muted)">{item.quantity}x</span>
                  <span className="text-sm text-(--text-primary)">{item.name}</span>
                  <span className="text-xs text-(--text-muted)">({item.size})</span>
                </div>
                <span className="text-sm text-(--text-secondary)">{formatCurrency(item.subtotal)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-(--border-subtle) mt-4 pt-4 flex items-center justify-between">
            <span className="font-semibold text-(--text-primary)">Total</span>
            <span className="text-xl font-bold text-gradient">{formatCurrency(cart.totalAmount)}</span>
          </div>
        </div>

        {/* Payment Info */}
        <div className="glass-card p-5 animate-fade-in">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🔒</span>
            <div>
              <h2 className="text-lg font-semibold text-(--text-primary)">Secure Payment</h2>
              <p className="text-sm text-(--text-muted)">Powered by Midtrans</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {['QRIS', 'GoPay', 'ShopeePay', 'DANA', 'OVO', 'Virtual Account'].map((method) => (
              <span
                key={method}
                className="px-3 py-1.5 rounded-xl bg-(--bg-card) text-xs text-(--text-secondary) border border-(--border-subtle)"
              >
                {method}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Pay Button */}
      <div className="sticky bottom-0 glass p-6 border-t border-(--border-subtle)">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={handleCheckout}
            disabled={isProcessing || !snapLoaded}
            className="btn-primary w-full py-5 text-lg rounded-2xl flex items-center justify-center gap-3"
          >
            {isProcessing ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {paymentStatus || 'Processing...'}
              </>
            ) : !snapLoaded ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Loading payment...
              </>
            ) : (
              <>Pay {formatCurrency(cart.totalAmount)}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
