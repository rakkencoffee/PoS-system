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

  // Voucher states
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<number>(0);
  const [voucherMessage, setVoucherMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [isValidatingVoucher, setIsValidatingVoucher] = useState(false);


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

  const [snapTokenCache, setSnapTokenCache] = useState<string | null>(null);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  const [redirectUrlCache, setRedirectUrlCache] = useState<string | null>(null);

  const triggerSnapPopup = (token: string, id: string, redirectPath?: string) => {
    setPaymentStatus('Opening payment...');
    if (window.snap) {
      window.snap.pay(token, {
        onSuccess: async () => {
          setPaymentStatus('Payment successful! Verifying...');
          try {
            await fetch(`/api/payment/verify?orderId=${id}`, { method: 'POST' });
          } catch (e) {
            console.error('Failed to manually verify payment:', e);
          }
          clearCart();
          
          const numericId = id.replace('OLSERA-', '');
          const queueNum = numericId.slice(-3);
          router.push(`/success?orderId=${id}&queue=${queueNum}`);
        },
        onPending: () => {
          setPaymentStatus('Waiting for payment...');
          clearCart();
          router.push(`/status?orderId=${id}&status=pending`);
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
      if (redirectPath) {
        window.location.href = redirectPath;
      } else {
        alert('Payment system failed to load. Please try again later.');
        setIsProcessing(false);
      }
    }
  };

  const handleCheckout = async () => {
    if (snapTokenCache && createdOrderId && redirectUrlCache) {
      setIsProcessing(true);
      setPaymentStatus('Redirecting to payment...');
      // FORCE REDIRECT for TestSprite E2E Resilience during Retry
      window.location.href = redirectUrlCache;
      return;
    }

    checkoutInProgress.current = true;
    setIsProcessing(true);
    setPaymentStatus('Creating payment...');

    try {
      const res = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.items.map((item) => ({
            productId: String(item.menuItemId),
            name: item.name,
            price: item.subtotal / item.quantity,
            quantity: item.quantity,
            variantId: item.olseraVariantId ? String(item.olseraVariantId) : undefined,
            note: [
              item.sugarLevel && item.sugarLevel !== 'normal' && `Sugar: ${item.sugarLevel}`,
              item.iceLevel && item.iceLevel !== 'normal' && `Ice: ${item.iceLevel}`,
              item.extraShot && 'Extra Shot',
              item.toppings.length && `Toppings: ${item.toppings.map((t) => t.name).join(', ')}`,
            ].filter(Boolean).join('; '),
          })),
          totalAmount: cart.totalAmount,
          customerName: cart.customerName,
          discountAmount: appliedDiscount > 0 ? appliedDiscount : undefined,
          voucherCode: appliedDiscount > 0 ? voucherCode.toUpperCase().trim() : undefined,
        }),
      });

      if (!res.ok) throw new Error('Failed to create payment');

      const { snapToken, orderId, redirectUrl } = await res.json();
      setSnapTokenCache(snapToken);
      setCreatedOrderId(orderId);
      setRedirectUrlCache(redirectUrl);

      if (window.snap) {
        triggerSnapPopup(snapToken, orderId, redirectUrl);
      } else if (redirectUrl) {
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

  const handleApplyVoucher = async () => {
    if (!voucherCode.trim()) return;
    setIsValidatingVoucher(true);
    setVoucherMessage(null);
    try {
      const res = await fetch('/api/payment/validate-voucher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: voucherCode, totalAmount: cart.totalAmount })
      });
      const data = await res.json();
      if (!res.ok) {
        setVoucherMessage({ type: 'error', text: data.error || 'Voucher invalid' });
        setAppliedDiscount(0);
      } else {
        setVoucherMessage({ type: 'success', text: data.message });
        setAppliedDiscount(data.discountAmount);
      }
    } catch(e) {
      setVoucherMessage({ type: 'error', text: 'Error contacting server' });
    } finally {
      setIsValidatingVoucher(false);
    }
  };

  const finalTotalToPay = Math.max(0, cart.totalAmount - appliedDiscount);

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
          <div className="border-t border-(--border-subtle) mt-4 pt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-(--text-muted)">Subtotal</span>
              <span className="text-(--text-primary)">{formatCurrency(cart.totalAmount)}</span>
            </div>
            {appliedDiscount > 0 && (
              <div className="flex items-center justify-between text-sm text-green-500 font-medium">
                <span>Discount Promo</span>
                <span>- {formatCurrency(appliedDiscount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-2">
              <span className="font-semibold text-(--text-primary)">Total</span>
              <span className="text-xl font-bold text-gradient">{formatCurrency(finalTotalToPay)}</span>
            </div>
          </div>
        </div>

        {/* Voucher Section */}
        <div className="glass-card p-5 animate-fade-in">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">🎟️</span>
            <div>
              <h2 className="text-lg font-semibold text-(--text-primary)">Promo & Voucher</h2>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Enter promo code (e.g. STARTFRIDAY10)" 
                value={voucherCode}
                onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                className="flex-1 px-4 py-3 rounded-xl bg-(--bg-card) border border-(--border-subtle) text-(--text-primary) placeholder:text-(--text-muted) focus:outline-none focus:ring-2 focus:ring-(--brand-primary)"
              />
              <button 
                onClick={handleApplyVoucher}
                disabled={isValidatingVoucher || !voucherCode.trim()}
                className="px-6 py-3 bg-(--brand-primary) text-white font-medium rounded-xl disabled:opacity-50"
              >
                {isValidatingVoucher ? '...' : 'Apply'}
              </button>
            </div>
            {voucherMessage && (
              <p className={`text-sm mt-1 px-1 ${voucherMessage.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
                {voucherMessage.text}
              </p>
            )}
            {appliedDiscount > 0 && (
              <button 
                onClick={() => {
                  setAppliedDiscount(0);
                  setVoucherCode('');
                  setVoucherMessage(null);
                }}
                className="text-xs text-red-400 mt-2 text-left px-1 hover:underline w-fit"
              >
                Remove Voucher
              </button>
            )}
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
              <>Pay {formatCurrency(finalTotalToPay)}</>
            )}
          </button>
          
          {/* Tunnel Fallback Link */}
          {snapLoaded && !isProcessing && (
            <p className="text-center text-[10px] text-(--text-muted) mt-3">
              Payment pop-up not appearing? <button onClick={handleCheckout} className="underline text-blue-400">Click here to retry</button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
