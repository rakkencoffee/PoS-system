'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useBaristaPrinter } from '@/hooks/useBaristaPrinter';

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Self-contained barista sticker printer control -- deliberately separate
 * from KdsView so this pilot can't destabilize the existing KDS board.
 * Independently subscribes to the same `kitchen` / ORDER_CREATED event
 * KdsView already listens to (safe: pusher-js shares one channel object per
 * name, and this component only ever binds/unbinds its own handler, never
 * unsubscribes the shared channel).
 */
export function BaristaPrinterPanel() {
  const { connected, deviceName, connect, disconnect, writeBytes } = useBaristaPrinter();
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const connectedRef = useRef(connected);
  connectedRef.current = connected;
  const writeBytesRef = useRef(writeBytes);
  writeBytesRef.current = writeBytes;

  const printSticker = useCallback(async (orderId: string) => {
    setStatus('Mencetak...');
    try {
      const res = await fetch(`/api/kds/sticker/${orderId}`);
      if (res.status === 204) {
        setStatus('Tidak ada minuman di order ini.');
        return;
      }
      if (!res.ok) throw new Error('Gagal ambil data stiker.');
      const { bytes } = await res.json();
      await writeBytesRef.current(base64ToBytes(bytes));
      setStatus('Stiker tercetak.');
    } catch (err: any) {
      setStatus(`Gagal: ${err.message}`);
    }
  }, []);

  useEffect(() => {
    let channel: any;
    let handler: ((data: { order: { id: string } }) => void) | undefined;

    (async () => {
      const { getPusherClient } = await import('@/lib/pusher');
      const pusher = getPusherClient();
      channel = pusher.subscribe('kitchen');

      handler = (data) => {
        if (!data.order?.id) return;
        setLastOrderId(data.order.id);
        if (connectedRef.current) printSticker(data.order.id);
      };
      channel.bind('ORDER_CREATED', handler);
    })();

    return () => {
      if (channel && handler) channel.unbind('ORDER_CREATED', handler);
    };
  }, [printSticker]);

  const handleConnect = async () => {
    setStatus('');
    try {
      await connect();
    } catch (err: any) {
      setStatus(`Gagal connect: ${err.message}`);
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm">
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
      {lastOrderId && (
        <button
          onClick={() => printSticker(lastOrderId)}
          disabled={!connected}
          className="ml-2 text-zinc-400 hover:text-white disabled:opacity-40 disabled:hover:text-zinc-400 transition-colors"
          title="Cetak ulang stiker order terakhir"
        >
          Print Ulang
        </button>
      )}
      {status && <span className="text-zinc-500 ml-2">{status}</span>}
    </div>
  );
}
