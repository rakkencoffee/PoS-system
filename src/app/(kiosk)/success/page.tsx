'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function SuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Handle both our router.push format AND Midtrans redirect format
  const orderId = searchParams.get('orderId') || searchParams.get('order_id');
  const transactionStatus = searchParams.get('transaction_status');
  
  // Extract queue: either from explicit param or from order ID (last 3 digits)
  const rawQueue = searchParams.get('queue');
  const queue = rawQueue || (() => {
    if (!orderId) return null;
    const numericId = orderId.replace('OLSERA-', '');
    return numericId.slice(-3);
  })();
  
  const [countdown, setCountdown] = useState(15);

  // If coming from Midtrans redirect (CC payment), verify payment
  useEffect(() => {
    if (orderId && transactionStatus && (transactionStatus === 'capture' || transactionStatus === 'settlement')) {
      fetch(`/api/payment/verify?orderId=${orderId}`, { method: 'POST' })
        .then(() => console.log('Payment verified after Midtrans redirect'))
        .catch((e) => console.error('Failed to verify payment after redirect:', e));
    }
  }, [orderId, transactionStatus]);

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
            <div className="w-28 h-28 rounded-full bg-linear-to-r from-green-500 to-emerald-500 flex items-center justify-center mx-auto shadow-2xl shadow-green-500/30">
              <svg className="w-14 h-14 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="absolute -inset-4 rounded-full bg-green-500/20 blur-xl animate-pulse" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-(--text-primary) mb-2 animate-fade-in-up">
          Payment Successful!
        </h1>
        <p className="text-(--text-muted) mb-8 animate-fade-in delay-1">
          Your order has been placed
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
          <button
            onClick={() => router.push(`/status?orderId=${orderId}`)}
            className="btn-primary w-full"
          >
            Track My Order
          </button>
          <button
            onClick={() => router.push('/')}
            className="btn-ghost w-full"
          >
            Back to Home ({countdown}s)
          </button>
        </div>
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
