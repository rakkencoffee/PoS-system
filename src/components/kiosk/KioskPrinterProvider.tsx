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

    // Guards resolveApproved against running twice for the same order -- it's now
    // reachable from three independent triggers (watch-start reconcile, the live
    // Pusher push, and the periodic poll below), and a real card being tapped
    // fast enough could plausibly satisfy two of them within the same tick.
    const resolved = new Set<string>();

    const resolveApproved = async (orderId: string) => {
      if (resolved.has(orderId)) return;
      resolved.add(orderId);
      const success = await printPendingReceipt(orderId);
      console.log(`[KioskPrinterProvider] Print ${success ? 'succeeded' : 'failed'} for ${orderId}`);
      setKioskPrintResult(orderId, success ? 'ok' : 'failed');
      removePendingKioskPrint(orderId);
      watching.delete(orderId);
    };

    const watch = async (entry: PendingKioskPrint) => {
      if (watching.has(entry.orderId) || resolved.has(entry.orderId)) return;
      watching.add(entry.orderId);

      // Reconcile against the job's current DB status before subscribing --
      // this watcher can itself remount mid-payment (confirmed live
      // 2026-09-10: this whole effect re-ran, logging a fresh "0 pending
      // order(s)" right after a PROCESSING push had just come in), and a
      // Pusher channel never replays events sent while nobody was
      // subscribed. If the daemon already reached APPROVED during that
      // resubscribe gap, catch it here instead of waiting forever for a
      // push that already happened.
      try {
        const res = await fetch(`/api/edc-jobs/status?orderId=${encodeURIComponent(entry.orderId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'APPROVED') {
            console.log(`[KioskPrinterProvider] Order ${entry.orderId} already APPROVED on watch start, printing immediately...`);
            await resolveApproved(entry.orderId);
            return;
          }
        }
      } catch (err) {
        console.warn(`[KioskPrinterProvider] Failed to reconcile status for ${entry.orderId} on watch start:`, err);
      }

      if (!pusher) {
        const { getPusherClient } = await import('@/lib/pusher');
        pusher = getPusherClient();
      }
      const channel = pusher.subscribe(`edc-job-${entry.orderId}`);
      channels.push(channel);

      console.log(`[KioskPrinterProvider] Watching order ${entry.orderId} for payment approval...`);

      channel.bind('STATUS_UPDATE', async (data: { status: string }) => {
        console.log(`[KioskPrinterProvider] STATUS_UPDATE for ${entry.orderId}:`, data.status);
        // Deliberately does NOT stop watching on REJECTED/FAILED -- the
        // known EDC bug means the daemon's own first attempt almost always
        // reports FAILED even when the transaction genuinely succeeded, and
        // staff manually flip it to APPROVED afterward via ResolveEdcJob.ps1
        // once they've confirmed the physical receipt. An earlier version of
        // this watcher unsubscribed on that first FAILED, so the later
        // manual APPROVED had nobody left listening -- confirmed live
        // 2026-09-08 as the reason nota printing silently stopped working
        // even though KDS (which re-checks fresh on every PATCH, not a
        // long-lived subscription) kept working fine.
        if (data.status === 'APPROVED') {
          console.log(`[KioskPrinterProvider] Printing receipt for ${entry.orderId}...`);
          await resolveApproved(entry.orderId);
          channel.unsubscribe();
        }
      });
    };

    const pending = readPendingKioskPrints();
    console.log(`[KioskPrinterProvider] Print watcher mounted, ${pending.length} pending order(s) from storage.`);
    pending.forEach(watch);

    const onQueued = (e: Event) => {
      const entry = (e as CustomEvent<PendingKioskPrint>).detail;
      console.log(`[KioskPrinterProvider] New order queued for printing: ${entry.orderId}`);
      watch(entry);
    };
    window.addEventListener(PENDING_PRINT_EVENT, onQueued);

    // Backstop for the live Pusher push itself being missed for reasons other
    // than the watch-start remount race above -- confirmed live 2026-09-10:
    // three separate orders came back APPROVED server-side (verified via
    // GET /api/edc-jobs/status) with zero corresponding STATUS_UPDATE ever
    // logged client-side, and no remount happened in between to trigger the
    // watch-start reconcile either. Whatever is dropping the push, this
    // catches it within one polling interval regardless of the cause.
    const reconcileTimer = setInterval(async () => {
      for (const orderId of Array.from(watching)) {
        if (resolved.has(orderId)) continue;
        try {
          const res = await fetch(`/api/edc-jobs/status?orderId=${encodeURIComponent(orderId)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.status === 'APPROVED') {
              console.log(`[KioskPrinterProvider] Reconcile poll found ${orderId} already APPROVED, printing...`);
              await resolveApproved(orderId);
            }
          }
        } catch (err) {
          console.warn(`[KioskPrinterProvider] Reconcile poll failed for ${orderId}:`, err);
        }
      }
    }, 8_000);

    return () => {
      window.removeEventListener(PENDING_PRINT_EVENT, onQueued);
      clearInterval(reconcileTimer);
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
