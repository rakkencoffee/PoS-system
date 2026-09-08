'use client';

import { createContext, useContext, useEffect, useRef } from 'react';
import { useBlePrinter } from '@/hooks/useBlePrinter';

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
