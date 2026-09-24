'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, Printer } from 'lucide-react';
import { printStationLabel } from '@/lib/print/station-print';
import { STATION_PRINTER_NAME_PREFIXES } from '@/lib/print/ble-config';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface StationPrinterPanelProps {
  /** e.g. "/api/kds/sticker" (Barista, drinks) or "/api/kds/food-label" (Kitchen, food) -- jobId is appended. */
  labelEndpointBase: string;
  /** Shown when the endpoint returns 204 (no matching items on that order for this station). */
  emptyMessage: string;
  /** Shared useBlePrinter() instance, lifted to the page so KdsView's manual
      "Print Label" button and this panel's auto-print use the same BLE
      connection instead of each holding (and fighting over) their own. */
  connected: boolean;
  deviceName: string | null;
  connect: (options?: { namePrefixes?: string[] }) => Promise<void>;
  disconnect: () => void;
  writeBytes: (bytes: Uint8Array) => Promise<void>;
}

/**
 * Self-contained station label printer control -- deliberately separate
 * from KdsView so this pilot can't destabilize the existing KDS board.
 * Subscribes to `print-queue` / NEW_JOB (same event print-bridge polls for)
 * rather than `kitchen` / ORDER_CREATED -- ORDER_CREATED fires as soon as
 * the order is placed, before settlement has created the PrintJob row, so
 * fetching the label off it 404s (confirmed via dev logs 2026-09-01).
 * NEW_JOB fires exactly when the job (and its payload) exists.
 */
export function StationPrinterPanel({
  labelEndpointBase,
  emptyMessage,
  connected,
  deviceName,
  connect,
  disconnect,
  writeBytes,
}: StationPrinterPanelProps) {
  const [lastJobId, setLastJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const connectedRef = useRef(connected);
  connectedRef.current = connected;
  const writeBytesRef = useRef(writeBytes);
  writeBytesRef.current = writeBytes;

  const printLabel = useCallback(async (jobId: string) => {
    setStatus('Mencetak...');
    try {
      const { ok, message } = await printStationLabel(labelEndpointBase, jobId, writeBytesRef.current);
      setStatus(ok && message === 'Tidak ada item untuk station ini.' ? emptyMessage : message);
    } catch (err: any) {
      setStatus(`Gagal: ${err.message}`);
    }
  }, [labelEndpointBase, emptyMessage]);

  useEffect(() => {
    // React Strict Mode (dev) mounts this effect twice; without the
    // `cancelled` guard, an unmount that fires while the async subscribe()
    // below is still pending finds `channel`/`handler` still undefined and
    // skips unbind, leaving two handlers bound to the same shared pusher-js
    // channel object -- confirmed via physical print 2026-09-01, the sticker
    // printed twice for one order.
    let cancelled = false;
    let channel: any;
    let handler: ((data: { jobId: string }) => void) | undefined;

    (async () => {
      const { getPusherClient } = await import('@/lib/pusher');
      const pusher = getPusherClient();
      const ch = pusher.subscribe('print-queue');
      if (cancelled) return;
      channel = ch;

      handler = (data) => {
        if (!data.jobId) return;
        setLastJobId(data.jobId);
        if (connectedRef.current) printLabel(data.jobId);
      };
      channel.bind('NEW_JOB', handler);
    })();

    return () => {
      cancelled = true;
      if (channel && handler) channel.unbind('NEW_JOB', handler);
    };
  }, [printLabel]);

  const handleConnect = async () => {
    setStatus('');
    try {
      await connect({ namePrefixes: STATION_PRINTER_NAME_PREFIXES });
    } catch (err: any) {
      setStatus(`Gagal connect: ${err.message}`);
    }
  };

  // Fallback for a printer that doesn't match STATION_PRINTER_NAME_PREFIXES
  // (e.g. a future replacement unit) -- falls back to the old unfiltered
  // scan, which is heavier but shows every nearby BLE device.
  const handleConnectAnyDevice = async () => {
    setStatus('');
    try {
      await connect();
    } catch (err: any) {
      setStatus(`Gagal connect: ${err.message}`);
    }
  };

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  const isError = status.startsWith('Gagal');
  const summary = status || (connected ? deviceName || 'Terhubung' : 'Belum terhubung');

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex h-11 w-full items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-3 text-left transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400"
      >
        <Printer className="size-5 shrink-0 text-zinc-300" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-xs text-zinc-400">
            <span className={cn('size-1.5 rounded-full', connected ? 'bg-emerald-400' : 'bg-red-400')} aria-hidden />
            Printer
          </span>
          <span className={cn('block truncate text-sm font-medium', isError ? 'text-red-300' : 'text-zinc-100')}>
            {summary}
          </span>
        </span>
        <ChevronDown className={cn('size-4 shrink-0 text-zinc-500 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-white/10 bg-zinc-900 p-3 shadow-[0_12px_32px_rgba(0,0,0,0.5)]">
          {connected ? (
            <p className="px-1 pb-3 text-sm text-zinc-300">
              Terhubung ke <span className="font-semibold text-white">{deviceName}</span>. Label kecetak otomatis tiap ada pesanan baru.
            </p>
          ) : (
            <p className="px-1 pb-3 text-sm text-zinc-300">
              Hubungkan printer supaya label kecetak otomatis tiap ada pesanan baru.
            </p>
          )}
          <div className="flex flex-col gap-2">
            {connected ? (
              <Button variant="surface" size="lg" onClick={disconnect}>
                Putuskan printer
              </Button>
            ) : (
              <>
                <Button variant="brand" size="lg" onClick={handleConnect}>
                  Hubungkan printer
                </Button>
                <Button
                  variant="ghost-dark"
                  size="lg"
                  onClick={handleConnectAnyDevice}
                  title="Pakai ini kalau printer-nya nggak muncul di daftar (misal ganti unit baru)"
                >
                  Cari semua device
                </Button>
              </>
            )}
            {lastJobId && (
              <Button variant="surface" size="lg" onClick={() => printLabel(lastJobId)} disabled={!connected}>
                Cetak ulang label terakhir
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
