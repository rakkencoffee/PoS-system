'use client';

import { useEffect, useRef, useState } from 'react';
import EdcPaymentAnimation from './EdcPaymentAnimation';

type EdcJobStatus = 'PENDING' | 'PROCESSING' | 'APPROVED' | 'REJECTED' | 'FAILED';

interface EdcJobStatusResponse {
  status: EdcJobStatus | 'NOT_FOUND';
  errorMessage?: string | null;
}

interface EdcPaymentFlowProps {
  orderId: string;
  amount: number;
  onApproved: () => void;
  onCancel: () => void;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_TIME_MS = 3 * 60 * 1000; // 3 minutes — EDC waits for card tap/insert/swipe

export function EdcPaymentFlow({ orderId, amount, onApproved, onCancel }: EdcPaymentFlowProps) {
  const [phase, setPhase] = useState<'waiting' | 'failed' | 'timeout'>('waiting');
  const [isRetrying, setIsRetrying] = useState(false);
  const stopPollingRef = useRef(false);

  const poll = async () => {
    stopPollingRef.current = false;
    setPhase('waiting');

    const startTime = Date.now();
    while (!stopPollingRef.current && Date.now() - startTime < MAX_POLL_TIME_MS) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      if (stopPollingRef.current) return;

      try {
        const res = await fetch(`/api/edc-jobs/status?orderId=${orderId}`);
        if (!res.ok) continue;
        const data: EdcJobStatusResponse = await res.json();

        if (data.status === 'APPROVED') {
          onApproved();
          return;
        }
        if (data.status === 'REJECTED' || data.status === 'FAILED') {
          // Raw EDC/DLL error stays in the console for staff — customers only see the
          // generic message below, not internal codes like "COMStatus failed (ret=-1)".
          console.warn(`[EdcPaymentFlow] Job ${data.status.toLowerCase()}:`, data.errorMessage);
          setPhase('failed');
          return;
        }
        // PENDING / PROCESSING / NOT_FOUND — keep polling
      } catch {
        // transient network hiccup — keep polling
      }
    }

    if (!stopPollingRef.current) setPhase('timeout');
  };

  useEffect(() => {
    poll();
    return () => {
      stopPollingRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      const res = await fetch('/api/edc-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, amount }),
      });
      if (!res.ok) throw new Error('Gagal membuat ulang job EDC');
      await poll();
    } catch (err) {
      console.warn('[EdcPaymentFlow] Retry failed:', err);
      setPhase('failed');
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-standard">
      <div className="bg-background rounded-3xl shadow-2xl max-w-sm w-full p-page-gutter flex flex-col items-center gap-standard">
        {phase === 'waiting' && (
          <>
            <h2 className="font-tag text-tag text-taupe uppercase tracking-wide text-center">Card Payment</h2>
            <span className="font-display text-h1 text-primary font-extrabold text-center">
              {formatCurrency(amount)}
            </span>

            <EdcPaymentAnimation className="py-section-item" />

            <p className="text-near-black text-center font-body-lg font-semibold">
              Tap kartu atau masukan kartu
            </p>
            <button
              onClick={onCancel}
              className="mt-section-item text-taupe font-body-md underline cursor-pointer"
            >
              Batalkan
            </button>
          </>
        )}

        {(phase === 'failed' || phase === 'timeout') && (
          <>
            <span className="material-symbols-outlined text-error text-[40px]">error</span>
            <h2 className="font-h3 text-h3 text-near-black font-bold text-center">
              {phase === 'timeout' ? 'Waktu Habis' : 'Pembayaran Gagal'}
            </h2>
            <p className="text-taupe text-center font-body-md">
              {phase === 'timeout'
                ? 'Tidak ada respon dari EDC dalam 3 menit. Silakan coba lagi.'
                : 'Transaksi tidak dapat diproses. Silakan coba lagi atau hubungi kasir.'}
            </p>
            <div className="flex gap-standard w-full mt-standard">
              <button
                onClick={onCancel}
                disabled={isRetrying}
                className="flex-1 py-standard rounded-xl border border-surface-variant text-near-black font-h4 cursor-pointer disabled:opacity-50"
              >
                Batalkan
              </button>
              <button
                onClick={handleRetry}
                disabled={isRetrying}
                className="flex-1 py-standard rounded-xl bg-primary text-white font-h4 cursor-pointer disabled:opacity-50"
              >
                {isRetrying ? 'Mencoba...' : 'Coba Lagi'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
