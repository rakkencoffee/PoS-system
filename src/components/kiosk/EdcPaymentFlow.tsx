'use client';

import { useEffect, useRef, useState } from 'react';
import EdcPaymentAnimation from './EdcPaymentAnimation';
import { getKioskDeviceId } from '@/lib/kiosk-device';

type EdcJobStatus = 'PENDING' | 'PROCESSING' | 'APPROVED' | 'REJECTED' | 'FAILED';

interface EdcJobStatusResponse {
  status: EdcJobStatus | 'NOT_FOUND';
  errorMessage?: string | null;
}

interface EdcPaymentFlowProps {
  orderId: string;
  amount: number;
  method?: 'CARD' | 'QRIS';
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

type FailurePhase = 'rejected' | 'failed' | 'timeout';

// REJECTED = daemon completed the full cycle and the bank gave a real decline
// (card problem). FAILED = the cycle broke before a valid response came back
// — e.g. the daemon's own message reached the EDC fine but COMStatus() never
// got an ACK (see project_edc_mandiri_axium_integration memory) — an EDC/
// connection problem, not the customer's card. These read very differently
// to a customer, so they must not share a message.
const FAILURE_COPY: Record<FailurePhase, { icon: string; title: string; message: string }> = {
  rejected: {
    icon: 'credit_card_off',
    title: 'Kartu Ditolak',
    message: 'Kartu tidak dapat diproses oleh bank. Coba kartu lain atau hubungi bank penerbit kartu Anda.',
  },
  failed: {
    icon: 'wifi_off',
    title: 'Gangguan Mesin EDC',
    message: 'Mesin EDC tidak merespons. Ini biasanya sementara — silakan coba lagi.',
  },
  timeout: {
    icon: 'schedule',
    title: 'Waktu Habis',
    message: 'Tidak ada respon dari EDC dalam 3 menit. Silakan coba lagi.',
  },
};

export function EdcPaymentFlow({ orderId, amount, method = 'CARD', onApproved, onCancel }: EdcPaymentFlowProps) {
  const [phase, setPhase] = useState<'waiting' | FailurePhase>('waiting');
  const [isRetrying, setIsRetrying] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [recheckMessage, setRecheckMessage] = useState<string | null>(null);
  const stopPollingRef = useRef(false);
  const hasApprovedRef = useRef(false);

  const handleApproved = () => {
    if (hasApprovedRef.current) return; // poll() and the Pusher push can both fire
    hasApprovedRef.current = true;
    onApproved();
  };

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
          handleApproved();
          return;
        }
        if (data.status === 'REJECTED' || data.status === 'FAILED') {
          // Raw EDC/DLL error stays in the console for staff — customers only see the
          // classified message below, not internal codes like "COMStatus failed (ret=-1)".
          console.warn(`[EdcPaymentFlow] Job ${data.status.toLowerCase()}:`, data.errorMessage);
          setPhase(data.status === 'REJECTED' ? 'rejected' : 'failed');
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

  // Independent of poll() -- which exits permanently on the first
  // FAILED/REJECTED read (see FAILURE_COPY comment above) -- so staff
  // flipping a job to APPROVED afterward via ResolveEdcJob.ps1 (once
  // they've confirmed the physical EDC receipt) still reaches this tab
  // instantly, without needing the "Cek Status Lagi" fallback button.
  useEffect(() => {
    let channel: ReturnType<import('pusher-js').default['subscribe']> | null = null;
    let pusher: import('pusher-js').default | null = null;

    (async () => {
      const { getPusherClient } = await import('@/lib/pusher');
      pusher = getPusherClient();
      channel = pusher.subscribe(`edc-job-${orderId}`);
      channel.bind('STATUS_UPDATE', (data: { status: EdcJobStatus }) => {
        if (data.status === 'APPROVED') handleApproved();
      });
    })();

    return () => {
      channel?.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  // One-shot re-check of the SAME job's status -- unlike handleRetry, this never
  // creates a new EdcJob (no re-charge risk). For staff to use after manually
  // resolving a job via ResolveEdcJob.ps1 once they've confirmed the physical
  // EDC receipt: poll() already exited permanently on the first FAILED/REJECTED
  // read (see the effect below), so nothing else in this component will ever
  // notice the backend flipping to APPROVED without this.
  const handleRecheckStatus = async () => {
    setIsChecking(true);
    setRecheckMessage(null);
    try {
      const res = await fetch(`/api/edc-jobs/status?orderId=${orderId}`);
      if (res.ok) {
        const data: EdcJobStatusResponse = await res.json();
        if (data.status === 'APPROVED') {
          handleApproved();
          return;
        }
      }
      setRecheckMessage('Status belum berubah — masih belum dikonfirmasi.');
    } catch {
      setRecheckMessage('Gagal cek status, coba lagi.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      const res = await fetch('/api/edc-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, amount, deviceId: getKioskDeviceId(), method }),
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
            <h2 className="font-tag text-tag text-taupe uppercase tracking-wide text-center">
              {method === 'QRIS' ? 'QRIS Payment' : 'Card Payment'}
            </h2>
            <span className="font-display text-h1 text-primary font-extrabold text-center">
              {formatCurrency(amount)}
            </span>

            <EdcPaymentAnimation className="py-section-item" />

            <p className="text-near-black text-center font-body-lg font-semibold">
              {method === 'QRIS' ? 'Scan QR di layar mesin EDC' : 'Tap kartu atau masukan kartu'}
            </p>
            <button
              onClick={onCancel}
              className="mt-section-item text-taupe font-body-md underline cursor-pointer"
            >
              Batalkan
            </button>
          </>
        )}

        {phase !== 'waiting' && (
          <>
            <span className="material-symbols-outlined text-error text-[40px]">{FAILURE_COPY[phase].icon}</span>
            <h2 className="font-h3 text-h3 text-near-black font-bold text-center">
              {FAILURE_COPY[phase].title}
            </h2>
            <p className="text-taupe text-center font-body-md">
              {FAILURE_COPY[phase].message}
            </p>
            <div className="flex gap-standard w-full mt-standard">
              <button
                onClick={onCancel}
                disabled={isRetrying || isChecking}
                className="flex-1 py-standard rounded-xl border border-surface-variant text-near-black font-h4 cursor-pointer disabled:opacity-50"
              >
                Batalkan
              </button>
              <button
                onClick={handleRetry}
                disabled={isRetrying || isChecking}
                className="flex-1 py-standard rounded-xl bg-primary text-white font-h4 cursor-pointer disabled:opacity-50"
              >
                {isRetrying ? 'Mencoba...' : 'Coba Lagi'}
              </button>
            </div>
            {(phase === 'failed' || phase === 'timeout') && (
              <>
                <button
                  onClick={handleRecheckStatus}
                  disabled={isRetrying || isChecking}
                  className="text-taupe font-body-md underline cursor-pointer disabled:opacity-50"
                >
                  {isChecking ? 'Mengecek...' : 'Cek Status Lagi'}
                </button>
                {recheckMessage && (
                  <p className="text-taupe text-center font-body-sm">{recheckMessage}</p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
