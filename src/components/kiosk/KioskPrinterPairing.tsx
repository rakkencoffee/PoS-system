'use client';

import { useEffect } from 'react';
import { useBlePrinter } from '@/hooks/useBlePrinter';

/**
 * Invisible tap target for pairing the kiosk's own receipt printer over
 * Web Bluetooth — deliberately has no visible label/icon so customers never
 * notice it; staff know it sits here (next to the cart button) for initial
 * setup. Auto-reconnects silently on every page load once paired once, so
 * this only needs a real tap the first time or after a printer power-cycle.
 *
 * The BLE connection itself is owned here and exposed via a tiny global so
 * the checkout/success flow (a different route/component tree) can print
 * through the SAME live GATT connection without re-pairing or lifting this
 * state into a page-level provider.
 */
export function KioskPrinterPairing() {
  const { connected, connect, tryAutoReconnect, writeBytes } = useBlePrinter();

  useEffect(() => {
    tryAutoReconnect().catch((err) => console.warn('[KioskPrinterPairing] Auto-reconnect failed:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Read via getKioskPrinter() from the checkout page's own submit handler,
  // BEFORE navigating to /success — this component only lives on pages that
  // render KioskHeader, so the print attempt must happen while still here.
  useEffect(() => {
    (window as any).__kioskPrinter = connected ? { writeBytes } : null;
  }, [connected, writeBytes]);

  const handleClick = () => {
    if (connected) return; // already paired — nothing for staff to do here
    connect().catch((err) => console.warn('[KioskPrinterPairing] Pairing failed/cancelled:', err));
  };

  return (
    <button
      onClick={handleClick}
      aria-hidden="true"
      tabIndex={-1}
      className="w-10 h-10 opacity-0 cursor-default"
      title=""
    />
  );
}

/** Read from the checkout/success flow — see KioskPrinterPairing for why this is a window global. */
export function getKioskPrinter(): { writeBytes: (bytes: Uint8Array) => Promise<void> } | null {
  if (typeof window === 'undefined') return null;
  return (window as any).__kioskPrinter ?? null;
}
