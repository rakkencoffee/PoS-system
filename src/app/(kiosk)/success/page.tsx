'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Receipt } from '@/components/pos/Receipt';

function SuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Handle both our router.push format AND Midtrans redirect format
  const orderId = searchParams.get('orderId') || searchParams.get('order_id');
  const transactionStatus = searchParams.get('transaction_status');
  
  // Extract queue: either from explicit param or from order ID (last 3 digits)
  const isOffline = searchParams.get('offline') === 'true';
  const rawQueue = searchParams.get('queue');
  const queue = rawQueue || (() => {
    if (!orderId) return '123';
    
    const numericId = orderId.replace('OLSERA-', '').replace(/OFFLINE-/, '').replace(/[^0-9]/g, '');
    if (!numericId) return '123';
    
    return numericId.length > 3 ? numericId.slice(-3) : numericId;
  })();
  
  const [countdown, setCountdown] = useState(isOffline ? 30 : 15);
  const [orderData, setOrderData] = useState<any>(null);
  const hasPrinted = useRef(false);

  // Auto-verify payment & Fetch order detail for receipt
  useEffect(() => {
    if (orderId && !isOffline) {
      // 1. Fetch order details for the receipt
      fetch(`/api/orders/${orderId}`)
        .then(res => res.json())
        .then(data => {
          if (!data.error) setOrderData(data);
        })
        .catch(e => console.error('Failed to fetch order for receipt:', e));

      // 2. Settlement logic
      if (process.env.NEXT_PUBLIC_TEST_MODE === 'true') {
        // [TEST MODE EXCLUSIVE] Auto settle the Olsera order since Webhooks can't reach us locally
        fetch('/api/test-settle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId }),
        })
          .then(() => console.log('Test-Mode Auto Settlement triggered!'))
          .catch((e) => console.error('Failed to auto-settle test order:', e));
      } else if (transactionStatus && (transactionStatus === 'capture' || transactionStatus === 'settlement')) {
        // Standard Midtrans redirect verify
        fetch(`/api/payment/verify?orderId=${orderId}`, { method: 'POST' })
          .then(() => console.log('Payment verified after Midtrans redirect'))
          .catch((e) => console.error('Failed to verify payment after redirect:', e));
      }
    }
  }, [orderId, transactionStatus]);

  // Auto-print when order data is ready
  useEffect(() => {
    if (orderData && !hasPrinted.current) {
      hasPrinted.current = true;
      // Small delay to ensure Receipt renders before print dialog opens
      const timer = setTimeout(() => {
        window.print();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [orderData]);

  const handlePrint = () => {
    window.print();
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push('/');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        {/* Success Animation */}
        <div className="mb-8 animate-scale-in">
          <div className="relative inline-block">
            <div className={`w-28 h-28 rounded-full flex items-center justify-center mx-auto shadow-2xl ${
              isOffline 
                ? 'bg-linear-to-r from-amber-500 to-orange-500 shadow-amber-500/30' 
                : 'bg-linear-to-r from-green-500 to-emerald-500 shadow-green-500/30'
            }`}>
              <svg className="w-14 h-14 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isOffline ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                )}
              </svg>
            </div>
            <div className={`absolute -inset-4 rounded-full blur-xl animate-pulse ${
              isOffline ? 'bg-amber-500/20' : 'bg-green-500/20'
            }`} />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-(--text-primary) mb-2 animate-fade-in-up">
          {isOffline ? 'Order Queued Offline' : 'Payment Successful!'}
        </h1>
        <p className="text-(--text-muted) mb-8 animate-fade-in delay-1 text-sm">
          {isOffline 
            ? 'We saved your order locally. It will be sent to the kitchen as soon as internet is restored.' 
            : 'Your order has been placed and sent to the kitchen.'}
        </p>

        {/* Queue Number */}
        <div className="glass-card p-8 mb-8 animate-fade-in-up delay-2" style={{ opacity: 0 }}>
          <p className="text-sm text-(--text-muted) uppercase tracking-wider mb-2">Your Queue Number</p>
          <div className="text-7xl font-black text-gradient mb-4">
            #{queue || '—'}
          </div>
          <div className="flex items-center justify-center gap-2 text-(--text-secondary)">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm">Estimated wait: 5-10 minutes</span>
          </div>
        </div>

        {/* Instructions */}
        <div className="glass-card p-5 mb-8 text-left animate-fade-in delay-3" style={{ opacity: 0 }}>
          <h3 className="font-semibold text-(--text-primary) mb-3 text-center">What&apos;s Next?</h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#A8131E] flex items-center justify-center text-xs text-white mt-0.5 shrink-0">1</span>
              <p className="text-sm text-(--text-secondary)">Wait for your number to be called</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#A8131E] flex items-center justify-center text-xs text-white mt-0.5 shrink-0">2</span>
              <p className="text-sm text-(--text-secondary)">Check the screen for order status</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#A8131E] flex items-center justify-center text-xs text-white mt-0.5 shrink-0">3</span>
              <p className="text-sm text-(--text-secondary)">Pick up your order when it&apos;s ready</p>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="space-y-3 animate-fade-in delay-4" style={{ opacity: 0 }}>
          {!isOffline && (
            <button
              onClick={handlePrint}
              className="w-full py-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center gap-3 transition-all active:scale-95 border border-white/10"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              🧾 Cetak Struk
            </button>
          )}
          
          <button
            onClick={() => !isOffline && router.push(`/status?orderId=${orderId}`)}
            disabled={isOffline}
            className="btn-primary w-full disabled:opacity-50 disabled:grayscale"
          >
            {isOffline ? 'Tracking Unavailable (Offline)' : 'Track My Order'}
          </button>
          <button
            onClick={() => router.push('/')}
            className="btn-ghost w-full"
          >
            Back to Home ({countdown}s)
          </button>
        </div>

        {/* Hidden Receipt — only visible during print */}
        {orderData && (
          <Receipt 
            orderId={orderId || ''}
            queueNumber={queue}
            items={orderData.items || []}
            total={orderData.totalAmount || 0}
            paymentMethod={orderData.paymentMethod || 'E-Wallet'}
          />
        )}
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#A8131E] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
