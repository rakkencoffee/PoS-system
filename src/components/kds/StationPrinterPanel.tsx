'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { printStationLabel, printTestLabel } from '@/lib/print/station-print';
import { STATION_PRINTER_NAME_PREFIXES } from '@/lib/print/ble-config';

interface StationPrinterPanelProps {
  /** e.g. "/api/kds/sticker" (Barista, drinks) or "/api/kds/food-label" (Kitchen, food) -- jobId is appended. */
  labelEndpointBase: string;
  /** Shown when the endpoint returns 204 (no matching items on that order for this station). */
  emptyMessage: string;
  /** e.g. "/api/kds/sticker-test" -- when set, shows a "Test Print" button
      that prints dummy sample data with no order/PrintJob involved, so
      staff can validate physical layout without a real transaction. Omit
      for stations that don't have a test endpoint (e.g. Kitchen). */
  testEndpoint?: string;
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
  testEndpoint,
  connected,
  deviceName,
  connect,
  disconnect,
  writeBytes,
}: StationPrinterPanelProps) {
  const [lastJobId, setLastJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [offsetMm, setOffsetMm] = useState<string>('');
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

  const handleTestPrint = async () => {
    if (!testEndpoint) return;
    setStatus('Mencetak test...');
    const trimmed = offsetMm.trim();
    const url = trimmed ? `${testEndpoint}?offsetMm=${encodeURIComponent(trimmed)}` : testEndpoint;
    try {
      const { message } = await printTestLabel(url, writeBytesRef.current);
      setStatus(message);
    } catch (err: any) {
      setStatus(`Gagal: ${err.message}`);
    }
  };

  const handleRulerTest = async () => {
    if (!testEndpoint) return;
    setStatus('Mencetak ruler...');
    try {
      const { message } = await printTestLabel(`${testEndpoint}?ruler=1`, writeBytesRef.current);
      setStatus(message);
    } catch (err: any) {
      setStatus(`Gagal: ${err.message}`);
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
        <>
          <button
            onClick={handleConnect}
            className="text-white font-semibold hover:text-[#A8131E] transition-colors"
          >
            Connect Printer
          </button>
          <button
            onClick={handleConnectAnyDevice}
            title="Pakai ini kalau printer-nya nggak muncul di list Connect Printer (ganti unit baru, misalnya)"
            className="text-zinc-500 hover:text-white text-xs transition-colors"
          >
            Cari Semua Device
          </button>
        </>
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
      {testEndpoint && (
        <>
          <input
            type="number"
            step="1"
            inputMode="numeric"
            value={offsetMm}
            onChange={(e) => setOffsetMm(e.target.value)}
            placeholder="Offset mm"
            title="TSPL OFFSET (mm) buat kalibrasi vertikal label -- kosongkan buat pakai kalibrasi printer apa adanya"
            className="ml-2 w-24 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-zinc-200 text-xs placeholder:text-zinc-600"
          />
          <button
            onClick={handleTestPrint}
            disabled={!connected}
            className="ml-1 text-zinc-400 hover:text-white disabled:opacity-40 disabled:hover:text-zinc-400 transition-colors"
            title="Cetak label dummy buat tes layout fisik, tanpa order asli"
          >
            Test Print
          </button>
          <button
            onClick={handleRulerTest}
            disabled={!connected}
            className="ml-1 text-zinc-400 hover:text-white disabled:opacity-40 disabled:hover:text-zinc-400 transition-colors"
            title="Cetak penggaris mm buat baca tinggi fisik label yang sebenarnya (baca angka pas garis sobekan)"
          >
            Ruler Test
          </button>
        </>
      )}
      {status && <span className="text-zinc-500 ml-2">{status}</span>}
    </div>
  );
}
