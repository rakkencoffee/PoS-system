'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/stores/useCartStore';
import { useCreateOrder, useValidateVoucher, usePaymentConfig } from '@/hooks/useOrders';

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
  const { items, totalAmount, clearCart, itemCount, customerName } = useCartStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string>('');
  const [snapLoaded, setSnapLoaded] = useState(false);
  const checkoutInProgress = useRef(false);

  // Voucher states
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<number>(0);
  const [voucherMessage, setVoucherMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // TanStack Query Hooks
  const createOrderMutation = useCreateOrder();
  const validateVoucherMutation = useValidateVoucher();
  const { data: paymentConfig } = usePaymentConfig();

  useEffect(() => {
    if (itemCount === 0 && !checkoutInProgress.current) {
      router.push('/menu');
    }
  }, [itemCount, router]);

  // Load Midtrans Snap.js dynamically
  const loadSnapScript = useCallback(() => {
    if (window.snap || !paymentConfig) {
      if (window.snap) setSnapLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = paymentConfig.snapUrl;
    script.setAttribute('data-client-key', paymentConfig.clientKey);
    script.onload = () => setSnapLoaded(true);
    script.onerror = () => console.error('Failed to load Midtrans Snap');
    document.head.appendChild(script);
  }, [paymentConfig]);

  useEffect(() => {
    loadSnapScript();
  }, [loadSnapScript]);

  const triggerSnapPopup = (token: string, id: string, redirectPath?: string) => {
    setPaymentStatus('Opening payment...');
    if (window.snap) {
      window.snap.pay(token, {
        onSuccess: async () => {
          setPaymentStatus('Payment successful!');
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
    } else if (redirectPath) {
      window.location.href = redirectPath;
    }
  };

  const handleCheckout = async () => {
    checkoutInProgress.current = true;
    setIsProcessing(true);
    setPaymentStatus('Creating payment...');

    try {
      const data = await createOrderMutation.mutateAsync({
        items: items.map((item) => ({
          productId: String(item.menuItemId),
          name: item.name,
          price: item.subtotal / item.quantity,
          quantity: item.quantity,
          variantId: item.olseraVariantId ? String(item.olseraVariantId) : undefined,
          notes: item.notes,
          options: {
            size: item.size,
            sugarLevel: item.sugarLevel,
            iceLevel: item.iceLevel,
            extraShot: item.extraShot,
            toppings: item.toppings.map(t => t.id)
          }
        })),
        customerName: customerName,
        voucherCode: appliedDiscount > 0 ? voucherCode : undefined
      });

      if (data.token) {
        triggerSnapPopup(data.token, data.orderId, data.redirectUrl);
      } else {
        throw new Error('No payment token received');
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      alert('Failed to process checkout: ' + error.message);
      setIsProcessing(false);
      checkoutInProgress.current = false;
    }
  };

  const handleApplyVoucher = async () => {
    if (!voucherCode.trim()) return;
    
    setVoucherMessage(null);
    try {
      const data = await validateVoucherMutation.mutateAsync(voucherCode);
      setAppliedDiscount(data.discountAmount);
      setVoucherMessage({type: 'success', text: `Voucher applied! Discount: ${formatCurrency(data.discountAmount)}`});
    } catch (error: any) {
      setAppliedDiscount(0);
      setVoucherMessage({type: 'error', text: error.message});
    }
  };

  const subtotal = totalAmount;
  const discount = appliedDiscount;
  const total = Math.max(0, subtotal - discount);

  return (
    <div className="min-h-screen pb-32">
      {/* Header */}
      <header className="glass sticky top-0 z-50 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <button onClick={() => router.back()} className="btn-ghost flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-xl font-bold text-gradient">Checkout</h1>
          <div className="w-20"></div>
        </div>
      </header>

      <main className="px-6 py-8 max-w-3xl mx-auto">
        {/* Order Summary */}
        <section className="glass-card p-6 mb-6">
          <h2 className="text-lg font-bold text-(--text-primary) mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-[#A8131E]/20 text-[#A8131E] flex items-center justify-center">📋</span>
            Order Summary
          </h2>
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between items-start gap-4 pb-4 border-b border-(--border-subtle) last:border-0 last:pb-0">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#A8131E]">{item.quantity}x</span>
                    <h3 className="font-medium text-(--text-primary)">{item.name}</h3>
                  </div>
                  {/* Item customization details */}
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    <span className="text-xs text-(--text-muted)">Size: {item.size}</span>
                    {item.sugarLevel && <span className="text-xs text-(--text-muted)">Sugar: {item.sugarLevel}</span>}
                    {item.iceLevel && <span className="text-xs text-(--text-muted)">Ice: {item.iceLevel}</span>}
                    {item.extraShot && <span className="text-xs text-(--text-muted)">+ Extra Shot</span>}
                    {item.toppings.length > 0 && (
                      <span className="text-xs text-(--text-muted)">
                        Toppings: {item.toppings.map(t => t.name).join(', ')}
                      </span>
                    )}
                  </div>
                  {item.notes && <p className="text-xs text-[#A8131E] mt-1 italic">"{item.notes}"</p>}
                </div>
                <span className="font-medium text-(--text-primary)">{formatCurrency(item.subtotal)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Customer & Voucher */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <section className="glass-card p-6">
            <h2 className="text-lg font-bold text-(--text-primary) mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-[#A8131E]/20 text-[#A8131E] flex items-center justify-center">👤</span>
              Customer
            </h2>
            <div className="space-y-1">
              <p className="text-sm text-(--text-muted)">Order for:</p>
              <p className="text-lg font-bold text-(--text-primary)">{customerName}</p>
            </div>
          </section>

          <section className="glass-card p-6">
            <h2 className="text-lg font-bold text-(--text-primary) mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-[#A8131E]/20 text-[#A8131E] flex items-center justify-center">🏷️</span>
              Voucher
            </h2>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Voucher code"
                readOnly={appliedDiscount > 0}
                value={voucherCode}
                onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                className="flex-1 px-4 py-2 rounded-xl bg-white/5 border border-(--border-subtle) text-(--text-primary) focus:outline-none focus:border-[#A8131E] transition-colors"
              />
              {appliedDiscount > 0 ? (
                <button 
                  onClick={() => { setAppliedDiscount(0); setVoucherCode(''); setVoucherMessage(null); }}
                  className="px-4 py-2 rounded-xl bg-[#A8131E]/20 text-[#A8131E] font-medium"
                >
                  Remove
                </button>
              ) : (
                <button 
                  onClick={handleApplyVoucher}
                  disabled={validateVoucherMutation.isPending || !voucherCode.trim()}
                  className="px-4 py-2 rounded-xl bg-(--bg-card) border border-(--border-subtle) hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                  {validateVoucherMutation.isPending ? '...' : 'Apply'}
                </button>
              )}
            </div>
            {voucherMessage && (
              <p className={`text-xs mt-2 ${voucherMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                {voucherMessage.text}
              </p>
            )}
          </section>
        </div>

        {/* Payment Details */}
        <section className="glass-card p-6 mb-24">
          <h2 className="text-lg font-bold text-(--text-primary) mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-[#A8131E]/20 text-[#A8131E] flex items-center justify-center">💳</span>
            Payment Details
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between text-(--text-secondary)">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-green-400">
                <span>Voucher Discount</span>
                <span>-{formatCurrency(discount)}</span>
              </div>
            )}
            <div className="h-px bg-(--border-subtle) my-2" />
            <div className="flex justify-between text-xl font-bold text-(--text-primary)">
              <span>Total Amount</span>
              <span className="text-gradient">{formatCurrency(total)}</span>
            </div>
          </div>
        </section>
      </main>

      {/* Fixed Bottom Action */}
      <footer className="fixed bottom-0 left-0 right-0 p-6 glass border-t border-(--border-subtle) z-40">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={handleCheckout}
            disabled={isProcessing || !snapLoaded || createOrderMutation.isPending}
            className="btn-primary w-full py-4 text-lg font-bold shadow-2xl relative overflow-hidden flex items-center justify-center gap-3 disabled:opacity-70"
          >
            {isProcessing || createOrderMutation.isPending ? (
              <>
                <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{paymentStatus || 'Processing...'}</span>
              </>
            ) : (
              <>
                <span>Pay Now</span>
                <div className="w-1.5 h-1.5 rounded-full bg-white/40" />
                <span>{formatCurrency(total)}</span>
              </>
            )}
          </button>
          <p className="text-center text-[10px] text-(--text-muted) mt-3 uppercase tracking-widest font-bold">
            Payments secured by Midtrans
          </p>
        </div>
      </footer>
    </div>
  );
}
