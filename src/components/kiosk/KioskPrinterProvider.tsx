'use client';

import { createContext, useContext, useEffect, useRef } from 'react';
import { useBlePrinter } from '@/hooks/useBlePrinter';
import {
  getKioskPrinter,
  PENDING_PRINT_EVENT,
  readPendingKioskPrints,
  removePendingKioskPrint,
  setKioskPrintResult,
  type PendingKioskPrint,
} from '@/lib/kiosk-printer';

interface KioskPrinterContextValue {
  connected: boolean;
  connect: () => Promise<void>;
}

const KioskPrinterContext = createContext<KioskPrinterContextValue | null>(null);

/**
 * Owns the single, session-long useBlePrinter() instance for the whole kiosk
 * flow. Mounted once in (kiosk)/layout.tsx, which Next.js never remounts
 * while navigating between /menu, /cart and /checkout -- unlike those pages'
 * own KioskHeader, which is a fresh component tree on every route. Before
 * this lived here, each page's own KioskPrinterPairing instance started from
 * connected=false and had to win a race against tryAutoReconnect() before
 * printing worked again, so a slow/failed reconnect right after navigating
 * to /checkout silently broke the receipt print for that order.
 */
export function KioskPrinterProvider({ children }: { children: React.ReactNode }) {
  const { connected, connect, tryAutoReconnect, writeBytes } = useBlePrinter();
  const didAutoReconnect = useRef(false);

  useEffect(() => {
    if (didAutoReconnect.current) return;
    didAutoReconnect.current = true;
    tryAutoReconnect().catch((err) => console.warn('[KioskPrinterProvider] Auto-reconnect failed:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Background self-heal: a BLE printer left idle (e.g. the 2-minute
  // idle-timeout that returns the kiosk to the welcome screen, see
  // (kiosk)/layout.tsx) commonly disconnects on its own -- confirmed live
  // 2026-09-08, header icon goes grey. Without this, `connected` just stays
  // false until the next checkout's printViaBluetooth() retries it right
  // before printing (still there as a fallback) -- this instead keeps
  // retrying every 30s in the background so the printer is very likely
  // already reconnected well before the next customer reaches checkout.
  useEffect(() => {
    if (connected) return;
    const interval = setInterval(() => {
      tryAutoReconnect().catch((err) => console.warn('[KioskPrinterProvider] Background reconnect failed:', err));
    }, 10_000);
    return () => clearInterval(interval);
  }, [connected, tryAutoReconnect]);

  // Read via getKioskPrinter() from the checkout page's own submit handler,
  // before navigating to /success.
  useEffect(() => {
    (window as any).__kioskPrinter = connected ? { writeBytes } : null;
  }, [connected, writeBytes]);

  // Exposed so checkout's printViaBluetooth() can attempt one silent
  // reconnect right before printing, not just at initial page load. A BLE
  // GATT connection left idle for several minutes (e.g. an EDC transaction
  // that needed manual troubleshooting) can disconnect on its own --
  // confirmed live 2026-09-08: the printer showed "paired" in the header,
  // but writeBytes() failed because `connected` had already flipped to
  // false via the gattserverdisconnected listener in useBlePrinter, and
  // this component's own auto-reconnect only ever runs once (didAutoReconnect
  // guard above), so nothing brought the connection back before that print.
  useEffect(() => {
    (window as any).__kioskPrinterReconnect = tryAutoReconnect;
  }, [tryAutoReconnect]);

  // Server-driven nota printing -- mirrors how KDS printing works instead of
  // depending on checkout's own component staying mounted until APPROVED
  // arrives (see @/lib/kiosk-printer for the full story). Watches every
  // order queued via queueKioskPrint(), including ones already pending from
  // before a page reload (read from localStorage on mount), plus any queued
  // later in this session (via the PENDING_PRINT_EVENT window event, since
  // this provider and the checkout page are separate component trees).
  useEffect(() => {
    const watching = new Set<string>();
    const channels: ReturnType<import('pusher-js').default['subscribe']>[] = [];
    let pusher: import('pusher-js').default | null = null;

    const printPendingReceipt = async (orderId: string): Promise<boolean> => {
      let printer = getKioskPrinter();
      for (let attempt = 0; !printer && attempt < 3; attempt++) {
        await tryAutoReconnect().catch(() => false);
        printer = getKioskPrinter();
        if (!printer) await new Promise((r) => setTimeout(r, 1500));
      }
      if (!printer) return false;

      try {
        const res = await fetch(`/api/kiosk/receipt/${encodeURIComponent(orderId)}`);
        if (!res.ok) return false;
        const { bytes } = await res.json();
        const binary = atob(bytes);
        const raw = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) raw[i] = binary.charCodeAt(i);
        await printer.writeBytes(raw);
        return true;
      } catch (err) {
        console.warn(`[KioskPrinterProvider] Failed to print receipt for ${orderId}:`, err);
        return false;
      }
    };

    const watch = async (entry: PendingKioskPrint) => {
      if (watching.has(entry.orderId)) return;
      watching.add(entry.orderId);

      if (!pusher) {
        const { getPusherClient } = await import('@/lib/pusher');
        pusher = getPusherClient();
      }
      const channel = pusher.subscribe(`edc-job-${entry.orderId}`);
      channels.push(channel);

      channel.bind('STATUS_UPDATE', async (data: { status: string }) => {
        if (data.status === 'APPROVED') {
          const success = await printPendingReceipt(entry.orderId);
          setKioskPrintResult(entry.orderId, success ? 'ok' : 'failed');
          removePendingKioskPrint(entry.orderId);
          channel.unsubscribe();
          watching.delete(entry.orderId);
        } else if (data.status === 'REJECTED' || data.status === 'FAILED') {
          removePendingKioskPrint(entry.orderId);
          channel.unsubscribe();
          watching.delete(entry.orderId);
        }
      });
    };

    readPendingKioskPrints().forEach(watch);

    const onQueued = (e: Event) => watch((e as CustomEvent<PendingKioskPrint>).detail);
    window.addEventListener(PENDING_PRINT_EVENT, onQueued);

    return () => {
      window.removeEventListener(PENDING_PRINT_EVENT, onQueued);
      channels.forEach((c) => c.unsubscribe());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <KioskPrinterContext.Provider value={{ connected, connect }}>
      {children}
    </KioskPrinterContext.Provider>
  );
}

export function useKioskPrinterContext(): KioskPrinterContextValue {
  const ctx = useContext(KioskPrinterContext);
  if (!ctx) throw new Error('useKioskPrinterContext must be used within KioskPrinterProvider');
  return ctx;
}
