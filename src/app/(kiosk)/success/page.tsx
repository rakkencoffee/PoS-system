'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Receipt } from '@/components/pos/Receipt';

function SuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const orderId = searchParams.get('orderId');

  // Extract queue: either from explicit param or from order ID (last 3 digits)
  const isOffline = searchParams.get('offline') === 'true';
  const rawQueue = searchParams.get('queue');
  const orderNo = searchParams.get('orderNo') || '';
  const queue = rawQueue || (() => {
    if (!orderId) return '123';
    
    const numericId = orderId.replace('OLSERA-', '').replace(/OFFLINE-/, '').replace(/[^0-9]/g, '');
    if (!numericId) return '123';
    
    return numericId.length > 3 ? numericId.slice(-3) : numericId;
  })();
  
  // Receipt printing happens at checkout time, straight over the kiosk
  // tablet's own paired Bluetooth printer (see checkout/page.tsx
  // printViaBluetooth) — this page only reflects whether that succeeded.
  // No cloud/WiFi print queue fallback anymore (deliberately dropped in
  // favor of BLE-only, see project memory).
  const printedViaBle = searchParams.get('printed') === 'ble';

  const [countdown, setCountdown] = useState(isOffline ? 30 : 15);
  const [orderData, setOrderData] = useState<any>(null);

  // Auto-verify payment & Fetch order detail for receipt
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if (orderId && !isOffline) {
      let retryCount = 0;
      const maxRetries = 8;

      const fetchOrder = async () => {
        try {
          const res = await fetch(`/api/orders/${orderId}?refresh=true`);
          const data = await res.json();

          if (data.id && data.items && data.items.length > 0) {
            setOrderData(data);
          } else if (retryCount < maxRetries) {
            retryCount++;
            timeoutId = setTimeout(fetchOrder, retryCount * 1000);
          } else {
            console.warn('[Success] Order data still incomplete after retries.');
            if (data.id) setOrderData(data);
          }
        } catch (e) {
          console.error('[Success] Fetch failed:', e);
        }
      };

      fetchOrder();
    }

    return () => clearTimeout(timeoutId);
  }, [orderId, isOffline]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (countdown <= 0) {
      router.push('/menu');
    }
  }, [countdown, router]);

  return (
    <div className="h-dvh overflow-hidden flex items-center justify-center p-4">
      <div className="text-center max-w-md w-full flex flex-col gap-3">
        {/* Success Animation */}
        <div className="animate-scale-in">
          <div className="relative inline-block">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto shadow-xl ${
              isOffline
                ? 'bg-linear-to-r from-amber-500 to-orange-500 shadow-amber-500/30'
                : 'bg-linear-to-r from-green-500 to-emerald-500 shadow-green-500/30'
            }`}>
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isOffline ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                )}
              </svg>
            </div>
            <div className={`absolute -inset-2 rounded-full blur-lg animate-pulse ${
              isOffline ? 'bg-amber-500/20' : 'bg-green-500/20'
            }`} />
          </div>
        </div>

        <div>
          <h1 className="text-xl font-bold text-(--text-primary) animate-fade-in-up">
            {isOffline ? 'Pesanan Disimpan Offline' : 'Pesanan Berhasil!'}
          </h1>
          <p className="text-(--text-muted) animate-fade-in delay-1 text-xs mt-1">
            {isOffline
              ? 'Pesanan Anda disimpan sementara dan akan otomatis terkirim ke dapur begitu koneksi internet kembali normal.'
              : 'Mohon tunggu, struk Anda sedang dicetak.'}
          </p>
        </div>

        {/* Queue & Order Number */}
        <div className="glass-card p-4 animate-fade-in-up delay-2" style={{ opacity: 0 }}>
          <p className="text-xs text-(--text-muted) uppercase tracking-wider mb-1">Nomor Antrean</p>
          <div className="text-5xl font-black text-gradient leading-none">
            #{String(queue).padStart(3, '0')}
          </div>
          <div className="text-xs text-(--text-muted) mt-2 mb-2 font-mono">
            ID: {(orderNo || orderData?.orderNo) || orderId}
          </div>
          <div className="flex items-center justify-center gap-2 text-(--text-secondary)">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs">Estimated wait: 5-10 minutes</span>
          </div>
        </div>

        {/* Instructions */}
        <div className="glass-card p-3 text-left animate-fade-in delay-3" style={{ opacity: 0 }}>
          <h3 className="font-semibold text-(--text-primary) text-sm mb-2 text-center">Langkah Selanjutnya</h3>
          <div className="space-y-1.5">
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[#A8131E] flex items-center justify-center text-[11px] text-white mt-0.5 shrink-0">1</span>
              <p className="text-xs text-(--text-secondary)">Ambil struk Anda</p>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-[#A8131E] flex items-center justify-center text-[11px] text-white mt-0.5 shrink-0">2</span>
              <p className="text-xs text-(--text-secondary)">Tunggu nomor antrean Anda dipanggil</p>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="space-y-2 animate-fade-in delay-4" style={{ opacity: 0 }}>
          {!isOffline && (
            <div className="flex items-center justify-center gap-2 text-xs text-(--text-secondary)">
              {printedViaBle ? (
                <>
                  <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Struk tercetak
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  Printer belum terhubung — hubungi kasir
                </>
              )}
            </div>
          )}

          <button
            onClick={() => router.push('/menu')}
            className="btn-primary w-full py-3 text-sm"
          >
            Kembali Ke Menu ({countdown}s)
          </button>
        </div>

        {/* Hidden Receipt — only visible during print */}
        {orderData && (
          <Receipt 
            orderId={(orderNo || orderData?.orderNo) || orderId || ''}
            queueNumber={queue}
            items={orderData.items || []}
            total={orderData.totalAmount || 0}
            discount={orderData.discount || 0}
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
      <div className="min-h-dvh flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#A8131E] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
