'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useBlePrinter } from '@/hooks/useBlePrinter';

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

interface StationPrinterPanelProps {
  /** e.g. "/api/kds/sticker" (Barista, drinks) or "/api/kds/food-label" (Kitchen, food) -- jobId is appended. */
  labelEndpointBase: string;
  /** Shown when the endpoint returns 204 (no matching items on that order for this station). */
  emptyMessage: string;
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
export function StationPrinterPanel({ labelEndpointBase, emptyMessage }: StationPrinterPanelProps) {
  const { connected, deviceName, connect, disconnect, writeBytes } = useBlePrinter();
  const [lastJobId, setLastJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const connectedRef = useRef(connected);
  connectedRef.current = connected;
  const writeBytesRef = useRef(writeBytes);
  writeBytesRef.current = writeBytes;

  const printLabel = useCallback(async (jobId: string) => {
    setStatus('Mencetak...');
    try {
      const res = await fetch(`${labelEndpointBase}/${jobId}`);
      if (res.status === 204) {
        setStatus(emptyMessage);
        return;
      }
      if (!res.ok) throw new Error('Gagal ambil data label.');
      const { bytes } = await res.json();
      await writeBytesRef.current(base64ToBytes(bytes));
      setStatus('Label tercetak.');
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
      await connect();
    } catch (err: any) {
      setStatus(`Gagal connect: ${err.message}`);
    }
  };

  return (
    <div className="flex items-center gap-3 px-5 py-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-sm font-bold">
      <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-zinc-600'}`} />
      {connected ? (
        <>
          <span className="text-zinc-300">Printer: {deviceName}</span>
          <button onClick={disconnect} className="text-zinc-500 hover:text-white transition-colors">
            Putuskan
          </button>
        </>
      ) : (
        <button
          onClick={handleConnect}
          className="text-white font-semibold hover:text-[#A8131E] transition-colors"
        >
          Connect Printer
        </button>
      )}
      {lastJobId && (
        <button
          onClick={() => printLabel(lastJobId)}
          disabled={!connected}
          className="ml-2 text-zinc-400 hover:text-white disabled:opacity-40 disabled:hover:text-zinc-400 transition-colors"
          title="Cetak ulang label order terakhir"
        >
          Print Ulang
        </button>
      )}
      {status && <span className="text-zinc-500 ml-2">{status}</span>}
    </div>
  );
}
