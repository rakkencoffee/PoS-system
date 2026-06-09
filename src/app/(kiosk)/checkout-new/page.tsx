'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/stores/useCartStore';
import { useCreateOrder, useValidateVoucher, usePaymentConfig } from '@/hooks/useOrders';
import { db, encryptPendingOrder } from '@/lib/dexie';
import { payWithEDC } from '@/lib/print-bridge';
import * as Sentry from "@sentry/nextjs";

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

const isFoodCategory = (categoryName?: string) => {
  if (!categoryName) return false;
  const lower = categoryName.toLowerCase();
  return ['dessert', 'snack', 'main-course', 'bites', 'makanan', 'makanan utama', 'cemilan'].some(c => lower.includes(c));
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function CheckoutNewPage() {
  const router = useRouter();
  const { items, totalAmount, clearCart, itemCount, customerName, updateQuantity, removeItem } = useCartStore();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string>('');
  const [snapLoaded, setSnapLoaded] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'edc'>('online');
  const checkoutInProgress = useRef(false);

  // Voucher states
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<number>(0);
  const [itemDiscounts, setItemDiscounts] = useState<Record<string, number>>({});
  const [voucherMessage, setVoucherMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // TanStack Query Hooks
  const createOrderMutation = useCreateOrder();
  const validateVoucherMutation = useValidateVoucher();
  const { data: paymentConfig } = usePaymentConfig();

  useEffect(() => {
    if (itemCount === 0 && !checkoutInProgress.current) {
      router.push('/menu-new');
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

  const triggerSnapPopup = (token: string, id: string, queueNumber: number, redirectPath?: string) => {
    setPaymentStatus('Opening payment...');
    if (window.snap) {
      window.snap.pay(token, {
        onSuccess: async () => {
          setPaymentStatus('Payment successful!');
          clearCart();
          const queueNum = queueNumber.toString();
          const orderNoParam = (window as any).__lastOrderNo ? `&orderNo=${(window as any).__lastOrderNo}` : '';
          router.push(`/success?orderId=${id}&queue=${queueNum}${orderNoParam}`);
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
        totalAmount: subtotal,
        discountAmount: appliedDiscount,
        customerName: customerName,
        voucherCode: appliedDiscount > 0 ? voucherCode : undefined
      });

      if (data.snapToken) {
        if (data.orderNo) (window as any).__lastOrderNo = data.orderNo;
        triggerSnapPopup(data.snapToken, data.orderId, data.queueNumber || 0, data.redirectUrl);
      } else {
        throw new Error('No payment token received');
      }
    } catch (error: any) {
      handleCheckoutError(error);
    }
  };

  const handleCheckoutEDC = async () => {
    checkoutInProgress.current = true;
    setIsProcessing(true);
    setPaymentStatus('Connecting to EDC...');

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
        totalAmount: subtotal,
        discountAmount: appliedDiscount,
        customerName: customerName,
        voucherCode: appliedDiscount > 0 ? voucherCode : undefined,
        paymentMethod: 'EDC'
      });

      setPaymentStatus('Please tap/swipe card on EDC terminal...');
      const edcResult = await payWithEDC(total, data.orderId);

      if (edcResult.success) {
        setPaymentStatus('Payment Approved!');
        clearCart();
        const queueNum = (data.queueNumber || 0).toString();
        const orderNoParam = data.orderNo ? `&orderNo=${data.orderNo}` : '';
        const edcParams = `&edc=true&approval=${edcResult.data.approvalCode}&card=${edcResult.data.cardNo}`;
        router.push(`/success?orderId=${data.orderId}&queue=${queueNum}${orderNoParam}${edcParams}`);
      } else {
        throw new Error(edcResult.error || 'Payment declined by EDC');
      }

    } catch (error: any) {
      handleCheckoutError(error);
    }
  };

  const handleCheckoutError = async (error: any) => {
    console.error('Checkout error:', error);
    const isNetworkError = error.name === 'TypeError' && 
                           (error.message.includes('fetch') || error.message.includes('NetworkError'));
    
    if (isNetworkError || !navigator.onLine) {
      try {
        const orderPayload = {
          orderId: `OFFLINE-${Date.now()}`,
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
          totalAmount: total,
          createdAt: new Date().toISOString(),
          status: 'pending' as const
        };

        const encryptedPayload = encryptPendingOrder(orderPayload);
        await db.pendingOrders.add(encryptedPayload);
        
        setPaymentStatus('Order saved offline!');
        clearCart();
        
        router.push(`/success?orderId=${orderPayload.orderId}&offline=true`);
        return;
      } catch (dexieError) {
        console.error('Failed to save to Dexie:', dexieError);
        Sentry.captureException(dexieError);
      }
    }

    alert('Checkout failed: ' + error.message);
    setIsProcessing(false);
    checkoutInProgress.current = false;
  };

  const handleApplyVoucher = async () => {
    if (!voucherCode.trim()) return;
    setVoucherMessage(null);
    try {
      const data = await validateVoucherMutation.mutateAsync({ 
        code: voucherCode, 
        totalAmount,
        items: items.map(item => ({
          id: item.id,
          productId: String(item.menuItemId),
          name: item.name,
          price: item.subtotal / item.quantity,
          quantity: item.quantity,
          category: item.category
        }))
      });
      setAppliedDiscount(data.discountAmount);
      setItemDiscounts(data.itemDiscounts || {});
      setVoucherMessage({type: 'success', text: `Voucher applied! Discount: ${formatCurrency(data.discountAmount)}`});
    } catch (error: any) {
      setAppliedDiscount(0);
      setItemDiscounts({});
      setVoucherMessage({type: 'error', text: error.message});
    }
  };

  const subtotal = totalAmount;
  const discount = appliedDiscount;
  const total = Math.max(0, subtotal - discount);

  const handlePayment = () => {
    if (paymentMethod === 'online') {
      handleCheckout();
    } else {
      handleCheckoutEDC();
    }
  };

  return (
    <div className="min-h-screen bg-background font-body-md text-on-background relative">
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse-live {
            0% { transform: scale(0.95); opacity: 0.5; }
            50% { transform: scale(1.05); opacity: 1; }
            100% { transform: scale(0.95); opacity: 0.5; }
        }
        .live-pulse { animation: pulse-live 1.5s infinite; }
        .active-payment {
            border: 2px solid #78000f !important;
            background-color: #F5E6E8 !important;
        }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #998075; border-radius: 10px; }
      `}} />

      {/* ======================================================== */}
      {/* 1. DESKTOP / KIOSK LANDSCAPE LAYOUT (Visible on lg screens) */}
      {/* ======================================================== */}
      <div className="hidden lg:flex flex-col h-screen overflow-hidden">
        {/* TopNavBar */}
        <header className="sticky top-0 z-50 flex justify-between items-center px-page-gutter py-standard w-full max-w-full bg-surface shadow-sm">
          <div className="flex items-center gap-standard">
            <button 
              onClick={() => router.back()} 
              disabled={isProcessing}
              className="p-compact hover:bg-off-white rounded-full transition-colors active:scale-95 duration-150 ease-in-out cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-primary">arrow_back</span>
            </button>
            <img src="/rakken-icon.svg" alt="Rakken Coffee" className="h-8 w-8 object-contain" />
            <h1 className="font-display text-h3 font-extrabold text-primary tracking-tight">RAKKEN COFFEE</h1>
          </div>
          <div className="flex items-center gap-section-item">
            <div className="flex items-center gap-tight">
              <span className="w-2 h-2 rounded-full bg-secondary live-pulse"></span>
              <span className="font-tag text-tag text-secondary uppercase tracking-wider">Station 04 Online</span>
            </div>
            <div className="flex items-center gap-standard">
              <button className="p-compact hover:bg-off-white rounded-full transition-colors active:scale-95">
                <span className="material-symbols-outlined text-primary">shopping_bag</span>
              </button>
              <button className="p-compact hover:bg-off-white rounded-full transition-colors active:scale-95">
                <span className="material-symbols-outlined text-primary">person</span>
              </button>
            </div>
          </div>
        </header>

        <main className="h-[calc(100vh-76px)] flex">
          {/* Left Section: Order Review (55%) */}
          <section className="w-[55%] h-full bg-background p-page-gutter flex flex-col overflow-y-auto">
            <div className="flex flex-col gap-standard mb-section-sep">
              <h2 className="font-h2 text-h2 text-near-black">Review Your Order</h2>
              <p className="font-body-lg text-body-lg text-taupe">Items will be prepared immediately after payment.</p>
            </div>

            {/* Order List */}
            <div className="flex flex-col gap-standard mb-section-sep">
              {items.map((item) => (
                <div key={item.id} className="bg-surface p-card-inner rounded-xl border border-surface-variant flex gap-standard items-center shadow-sm">
                  {item.image && (
                    <img 
                      alt={item.name} 
                      className="w-20 h-20 object-cover rounded-lg" 
                      src={item.image} 
                    />
                  )}
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-h4 text-h4 text-near-black font-semibold">{item.name}</h4>
                        {/* Customization Details */}
                        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-taupe">
                          {item.size && item.size !== '-' && item.size !== '' && (
                            <span>{isFoodCategory(item.category) ? `Option: ${item.size}` : `Size: ${item.size}`}</span>
                          )}
                          {item.sugarLevel && item.sugarLevel !== 'normal' && item.sugarLevel !== '' && (
                            <span>Sugar: {item.sugarLevel}</span>
                          )}
                          {item.iceLevel && item.iceLevel !== 'none' && item.iceLevel !== '' && (
                            <span>Ice: {item.iceLevel}</span>
                          )}
                          {item.extraShot && <span>+ Extra Shot</span>}
                          {item.toppings.length > 0 && (
                            <span>Toppings: {item.toppings.map(t => t.name).join(', ')}</span>
                          )}
                        </div>
                        {item.notes && <p className="text-xs text-[#A8131E] mt-1 italic">"{item.notes}"</p>}
                      </div>
                      <div className="text-right flex flex-col items-end">
                        {itemDiscounts[item.id] > 0 && (
                          <span className="text-xs font-bold text-green-600 mb-0.5">
                            -{formatCurrency(itemDiscounts[item.id])}
                          </span>
                        )}
                        <span className="font-price text-body-lg text-primary">
                          {itemDiscounts[item.id] > 0
                            ? formatCurrency(item.subtotal - itemDiscounts[item.id])
                            : formatCurrency(item.subtotal)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-standard mt-standard">
                      <div className="flex items-center bg-off-white rounded-full px-standard py-tight border border-surface-variant">
                        <button 
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          disabled={isProcessing}
                          className="material-symbols-outlined text-primary text-lg active:scale-95 cursor-pointer disabled:opacity-40"
                        >
                          remove
                        </button>
                        <span className="mx-standard font-h4 text-body-md font-bold">{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          disabled={isProcessing}
                          className="material-symbols-outlined text-primary text-lg active:scale-95 cursor-pointer disabled:opacity-40"
                        >
                          add
                        </button>
                      </div>
                      <button 
                        onClick={() => removeItem(item.id)}
                        disabled={isProcessing}
                        className="text-error font-tag text-tag cursor-pointer hover:underline disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Voucher Section */}
            <div className="mt-auto">
              <label className="font-tag text-tag text-taupe uppercase block mb-compact">Have a voucher?</label>
              <div className="flex gap-standard">
                <input 
                  className="flex-1 bg-surface border-1.5 border-surface-variant rounded-xl px-standard py-compact focus:ring-primary focus:border-primary placeholder-taupe focus:outline-none" 
                  placeholder="Enter code (e.g. COFFEE20)" 
                  type="text"
                  readOnly={appliedDiscount > 0 || isProcessing}
                  value={voucherCode}
                  onChange={(e) => { setVoucherCode(e.target.value.toUpperCase()); setVoucherMessage(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && voucherCode.trim() && appliedDiscount === 0) handleApplyVoucher(); }}
                />
                {appliedDiscount > 0 ? (
                  <button 
                    onClick={() => { setAppliedDiscount(0); setVoucherCode(''); setItemDiscounts({}); setVoucherMessage(null); }}
                    disabled={isProcessing}
                    className="px-section-item py-compact bg-error text-white font-h4 text-body-md rounded-xl transition-transform active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    Clear
                  </button>
                ) : (
                  <button 
                    onClick={handleApplyVoucher}
                    disabled={validateVoucherMutation.isPending || !voucherCode.trim() || isProcessing}
                    className="px-section-item py-compact bg-tertiary text-white font-h4 text-body-md rounded-xl transition-transform active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    {validateVoucherMutation.isPending ? 'Validating...' : 'Apply'}
                  </button>
                )}
              </div>
              {voucherMessage && (
                <div className={`mt-2 text-xs font-semibold ${voucherMessage.type === 'success' ? 'text-green-600' : 'text-error'}`}>
                  {voucherMessage.text}
                </div>
              )}
            </div>
          </section>

          {/* Right Section: Payment Summary (45%) */}
          <section className="w-[45%] h-full bg-surface p-page-gutter flex flex-col justify-center border-l border-surface-variant">
            <div className="max-w-[480px] mx-auto w-full space-y-section-sep">
              
              {/* Customer Name info */}
              <div className="bg-background/40 p-card-inner border border-surface-variant rounded-2xl flex items-center justify-between">
                <div>
                  <span className="font-tag text-tag text-taupe uppercase">Customer Name</span>
                  <h4 className="font-h3 text-h3 text-near-black font-extrabold">{customerName || 'Self Service Guest'}</h4>
                </div>
                <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center text-primary font-bold">
                  {customerName ? customerName.slice(0,2).toUpperCase() : 'G'}
                </div>
              </div>

              {/* Payment Summary Card */}
              <div className="bg-background p-page-gutter rounded-3xl shadow-lg border border-surface-variant">
                <h3 className="font-h3 text-h3 text-near-black mb-standard font-bold">Payment Summary</h3>
                <div className="space-y-standard mb-section-item">
                  <div className="flex justify-between text-body-lg text-taupe font-body-lg">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-body-lg text-green-600 font-body-lg">
                      <span>Voucher Discount</span>
                      <span>-{formatCurrency(discount)}</span>
                    </div>
                  )}
                  <div className="pt-standard border-t border-surface-variant flex justify-between items-center">
                    <span className="font-h2 text-h2 text-near-black font-extrabold">Total</span>
                    <span className="font-display text-h1 text-primary font-extrabold">{formatCurrency(total)}</span>
                  </div>
                </div>

                {/* Payment Methods */}
                <div className="space-y-standard">
                  <label className="font-tag text-tag text-taupe uppercase font-semibold">Select Method</label>
                  
                  {/* Online/QRIS */}
                  <div 
                    onClick={() => { if(!isProcessing) setPaymentMethod('online'); }}
                    className={`payment-card cursor-pointer flex items-center justify-between p-standard bg-white border rounded-2xl transition-all ${
                      paymentMethod === 'online' ? 'active-payment border-2 border-primary shadow-md' : 'border-surface-variant border-1.5 hover:bg-off-white'
                    }`}
                  >
                    <div className="flex items-center gap-standard">
                      <div className="w-12 h-12 bg-primary-fixed rounded-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary">qr_code_2</span>
                      </div>
                      <div>
                        <h4 className="font-h4 text-h4 text-near-black font-semibold">Online / QRIS</h4>
                        <p className="font-caption text-caption text-taupe">GoPay, OVO, ShopeePay</p>
                      </div>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      paymentMethod === 'online' ? 'border-primary' : 'border-surface-variant'
                    }`}>
                      {paymentMethod === 'online' && <div className="w-3 h-3 bg-primary rounded-full"></div>}
                    </div>
                  </div>

                  {/* EDC */}
                  <div 
                    onClick={() => { if(!isProcessing) setPaymentMethod('edc'); }}
                    className={`payment-card cursor-pointer flex items-center justify-between p-standard bg-white border rounded-2xl transition-all ${
                      paymentMethod === 'edc' ? 'active-payment border-2 border-primary shadow-md' : 'border-surface-variant border-1.5 hover:bg-off-white'
                    }`}
                  >
                    <div className="flex items-center gap-standard">
                      <div className="w-12 h-12 bg-surface-variant rounded-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-near-black">contactless</span>
                      </div>
                      <div>
                        <h4 className="font-h4 text-h4 text-near-black font-semibold">Debit / Credit</h4>
                        <p className="font-caption text-caption text-taupe">Insert card in EDC machine</p>
                      </div>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      paymentMethod === 'edc' ? 'border-primary' : 'border-surface-variant'
                    }`}>
                      {paymentMethod === 'edc' && <div className="w-3 h-3 bg-primary rounded-full"></div>}
                    </div>
                  </div>
                </div>

                {/* Pay Button */}
                <button 
                  onClick={handlePayment}
                  disabled={isProcessing || (paymentMethod === 'online' && !snapLoaded) || createOrderMutation.isPending}
                  className="w-full mt-section-sep py-standard bg-primary text-white font-display text-h3 rounded-2xl transition-all active:scale-95 shadow-lg shadow-primary/20 hover:bg-red-dark cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isProcessing || createOrderMutation.isPending ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span className="text-body-lg font-bold">{paymentStatus || 'Processing...'}</span>
                    </>
                  ) : (
                    <span>Pay {formatCurrency(total)}</span>
                  )}
                </button>
                
                <p className="text-center mt-standard font-caption text-caption text-taupe">
                  By paying, you agree to our Terms of Service
                </p>
              </div>

              {/* Assistance / Info */}
              <div className="flex items-center justify-center gap-standard opacity-60">
                <span className="material-symbols-outlined text-taupe">help</span>
                <span className="font-tag text-tag text-taupe">Need help? Ask our Barista</span>
              </div>
            </div>
          </section>
        </main>
      </div>

      {/* ======================================================== */}
      {/* 2. MOBILE VIEW / PORTRAIT (Visible on screens < lg)       */}
      {/* ======================================================== */}
      <div className="flex lg:hidden flex-col min-h-screen">
        {/* TopNavBar */}
        <nav className="sticky top-0 z-50 flex justify-between items-center px-standard py-compact w-full max-w-full bg-surface shadow-sm border-b border-surface-variant/30">
          <div className="flex items-center gap-standard">
            <button 
              onClick={() => router.back()} 
              disabled={isProcessing}
              className="p-tight hover:bg-off-white rounded-full transition-colors active:scale-95 duration-150 ease-in-out cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-primary">arrow_back</span>
            </button>
            <img src="/rakken-icon.svg" alt="Rakken Coffee" className="h-6 w-6 object-contain" />
            <h1 className="font-display text-h4 text-primary font-extrabold tracking-tight">RAKKEN COFFEE</h1>
          </div>
          <div className="flex gap-standard">
            <button className="p-tight text-primary hover:bg-off-white rounded-full transition-colors active:scale-95 duration-150 ease-in-out">
              <span className="material-symbols-outlined">shopping_bag</span>
            </button>
          </div>
        </nav>

        <main className="max-w-md mx-auto pb-[180px] px-standard pt-standard space-y-section-sep w-full">
          {/* Section Header */}
          <header>
            <h2 className="font-h1-mobile text-h1-mobile text-on-surface font-bold">Checkout</h2>
            <p className="font-body-md text-body-md text-taupe mt-tight">Review your order and pick a payment method</p>
          </header>

          {/* Customer Badge */}
          <div className="bg-surface rounded-xl p-card-inner border border-surface-variant shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs text-taupe font-semibold uppercase">Customer Name</span>
              <p className="font-h4 text-near-black font-bold">{customerName || 'Self Service Guest'}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center text-primary text-xs font-bold">
              {customerName ? customerName.slice(0,2).toUpperCase() : 'G'}
            </div>
          </div>

          {/* Summary Cards */}
          <section className="space-y-standard">
            <h3 className="font-h4 text-h4 text-near-black font-semibold">Pesanan Anda</h3>
            <div className="bg-surface rounded-xl p-card-inner border border-surface-variant shadow-sm space-y-standard">
              {items.map((item, idx) => (
                <div key={item.id}>
                  {idx > 0 && <div className="h-[1px] bg-surface-variant w-full my-standard"></div>}
                  <div className="flex gap-standard">
                    {item.image && (
                      <img 
                        alt={item.name} 
                        className="w-20 h-20 rounded-lg object-cover" 
                        src={item.image} 
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-h4 text-h4 text-on-surface font-semibold line-clamp-1">{item.name}</h4>
                          {/* Option description */}
                          <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-taupe">
                            {item.size && item.size !== '-' && item.size !== '' && (
                              <span>{isFoodCategory(item.category) ? `Option: ${item.size}` : `Size: ${item.size}`}</span>
                            )}
                            {item.sugarLevel && item.sugarLevel !== 'normal' && item.sugarLevel !== '' && (
                              <span>Sugar: {item.sugarLevel}</span>
                            )}
                            {item.iceLevel && item.iceLevel !== 'none' && item.iceLevel !== '' && (
                              <span>Ice: {item.iceLevel}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex flex-col items-end shrink-0">
                          {itemDiscounts[item.id] > 0 && (
                            <span className="text-xs font-bold text-green-600 mb-0.5">
                              -{formatCurrency(itemDiscounts[item.id])}
                            </span>
                          )}
                          <span className="font-price text-body-lg text-primary">
                            {itemDiscounts[item.id] > 0
                              ? formatCurrency(item.subtotal - itemDiscounts[item.id])
                              : formatCurrency(item.subtotal)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-standard mt-standard">
                        <div className="flex items-center bg-off-white rounded-full px-standard py-tight border border-surface-variant">
                          <button 
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            disabled={isProcessing}
                            className="material-symbols-outlined text-primary text-base active:scale-95 cursor-pointer disabled:opacity-40"
                          >
                            remove
                          </button>
                          <span className="mx-standard font-h4 text-xs font-bold">{item.quantity}</span>
                          <button 
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            disabled={isProcessing}
                            className="material-symbols-outlined text-primary text-base active:scale-95 cursor-pointer disabled:opacity-40"
                          >
                            add
                          </button>
                        </div>
                        <button 
                          onClick={() => removeItem(item.id)}
                          disabled={isProcessing}
                          className="text-error font-tag text-xs cursor-pointer hover:underline disabled:opacity-40"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Voucher Row */}
          <section className="space-y-standard">
            <h3 className="font-h4 text-h4 text-near-black font-semibold">Voucher &amp; Promo</h3>
            <div className="bg-surface rounded-xl p-card-inner border border-surface-variant shadow-sm space-y-compact">
              <div className="flex gap-standard">
                <input 
                  className="flex-1 bg-surface border border-surface-variant rounded-xl px-4 py-2 text-sm focus:ring-primary focus:border-primary placeholder-taupe focus:outline-none font-mono" 
                  placeholder="Kode Voucher" 
                  type="text"
                  readOnly={appliedDiscount > 0 || isProcessing}
                  value={voucherCode}
                  onChange={(e) => { setVoucherCode(e.target.value.toUpperCase()); setVoucherMessage(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && voucherCode.trim() && appliedDiscount === 0) handleApplyVoucher(); }}
                />
                {appliedDiscount > 0 ? (
                  <button 
                    onClick={() => { setAppliedDiscount(0); setVoucherCode(''); setItemDiscounts({}); setVoucherMessage(null); }}
                    disabled={isProcessing}
                    className="px-4 py-2 bg-error text-white font-semibold text-xs rounded-xl cursor-pointer disabled:opacity-50"
                  >
                    Clear
                  </button>
                ) : (
                  <button 
                    onClick={handleApplyVoucher}
                    disabled={validateVoucherMutation.isPending || !voucherCode.trim() || isProcessing}
                    className="px-4 py-2 bg-tertiary text-white font-semibold text-xs rounded-xl cursor-pointer disabled:opacity-50"
                  >
                    Apply
                  </button>
                )}
              </div>
              {voucherMessage && (
                <div className={`text-xs font-semibold ${voucherMessage.type === 'success' ? 'text-green-600' : 'text-error'}`}>
                  {voucherMessage.text}
                </div>
              )}
            </div>
          </section>

          {/* Payment Method Toggle Cards */}
          <section className="space-y-standard">
            <h3 className="font-h4 text-h4 text-near-black font-semibold">Metode Pembayaran</h3>
            <div className="grid grid-cols-1 gap-standard">
              {/* QRIS Card */}
              <div 
                onClick={() => { if(!isProcessing) setPaymentMethod('online'); }}
                className={`payment-card cursor-pointer bg-surface rounded-xl p-card-inner border shadow-sm transition-all duration-200 ${
                  paymentMethod === 'online' ? 'active-payment border-primary' : 'border-surface-variant'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-standard">
                    <div className="w-10 h-10 flex items-center justify-center bg-off-white rounded-lg">
                      <span className="material-symbols-outlined text-primary">qr_code_2</span>
                    </div>
                    <div>
                      <h4 className="font-h4 text-h4 text-on-surface font-semibold">QRIS / E-Wallet</h4>
                      <p className="font-caption text-caption text-taupe">GoPay, OVO, Dana, LinkAja</p>
                    </div>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    paymentMethod === 'online' ? 'border-primary' : 'border-surface-variant'
                  }`}>
                    {paymentMethod === 'online' && <div className="w-3 h-3 rounded-full bg-primary"></div>}
                  </div>
                </div>
              </div>

              {/* Debit/Credit card */}
              <div 
                onClick={() => { if(!isProcessing) setPaymentMethod('edc'); }}
                className={`payment-card cursor-pointer bg-surface rounded-xl p-card-inner border shadow-sm transition-all duration-200 ${
                  paymentMethod === 'edc' ? 'active-payment border-primary' : 'border-surface-variant'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-standard">
                    <div className="w-10 h-10 flex items-center justify-center bg-off-white rounded-lg">
                      <span className="material-symbols-outlined text-primary">credit_card</span>
                    </div>
                    <div>
                      <h4 className="font-h4 text-h4 text-on-surface font-semibold">Kartu Kredit/Debit</h4>
                      <p className="font-caption text-caption text-taupe">Visa, Mastercard, JCB (EDC)</p>
                    </div>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    paymentMethod === 'edc' ? 'border-primary' : 'border-surface-variant'
                  }`}>
                    {paymentMethod === 'edc' && <div className="w-3 h-3 rounded-full bg-primary"></div>}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Bill Details */}
          <section className="bg-surface-container-low rounded-xl p-card-inner space-y-standard">
            <div className="flex justify-between">
              <span className="font-body-md text-taupe">Subtotal ({itemCount} items)</span>
              <span className="font-body-md text-on-surface">{formatCurrency(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Voucher Discount</span>
                <span>-{formatCurrency(discount)}</span>
              </div>
            )}
            <div className="h-[1px] bg-surface-variant opacity-50"></div>
            <div className="flex justify-between items-center">
              <span className="font-h4 text-h4 text-near-black font-bold">Total Pembayaran</span>
              <span className="font-price text-price text-primary font-bold">{formatCurrency(total)}</span>
            </div>
          </section>
        </main>

        {/* Sticky Bottom Bar */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-surface-variant/30 shadow-[0_-8px_24px_rgba(0,0,0,0.05)] px-page-gutter py-standard max-w-md mx-auto rounded-t-3xl">
          <div className="flex items-center justify-between mb-standard">
            <div>
              <p className="font-caption text-caption text-taupe uppercase tracking-wider">Total Tagihan</p>
              <p className="font-price text-price text-on-surface font-bold">{formatCurrency(total)}</p>
            </div>
            <div className="flex -space-x-2">
              <div className="w-8 h-8 rounded-full bg-primary border-2 border-surface flex items-center justify-center text-[10px] text-white font-bold">Q</div>
              {discount > 0 && (
                <div className="w-8 h-8 rounded-full bg-secondary border-2 border-surface flex items-center justify-center text-[10px] text-white font-bold">V</div>
              )}
            </div>
          </div>
          <button 
            onClick={handlePayment}
            disabled={isProcessing || (paymentMethod === 'online' && !snapLoaded) || createOrderMutation.isPending}
            className="w-full bg-primary text-on-primary py-standard rounded-full font-h3 text-h3 shadow-lg active:scale-95 transition-all duration-200 flex items-center justify-center gap-standard cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            id="pay-button"
          >
            {isProcessing || createOrderMutation.isPending ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{paymentStatus || 'Processing...'}</span>
              </>
            ) : (
              <>
                <span>Bayar Sekarang</span>
                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
