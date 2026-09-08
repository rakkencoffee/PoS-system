'use client';

import { useKioskPrinterContext } from './KioskPrinterProvider';

/**
 * Small, low-key tap target for pairing the kiosk's own receipt printer over
 * Web Bluetooth — a muted dot next to the cart button, not a fully invisible
 * hitbox (that made it impossible for staff to find/tap reliably on a real
 * touchscreen during setup). Still easy to overlook for customers who aren't
 * looking for it.
 *
 * This component itself remounts on every page (menu/cart/checkout each
 * render their own KioskHeader), so it must NOT own the BLE connection —
 * the actual useBlePrinter() instance lives once in KioskPrinterProvider
 * (mounted in (kiosk)/layout.tsx, which survives navigation), and this is
 * just a presentational consumer of that shared, persistent connection.
 */
export function KioskPrinterPairing() {
  const { connected, connect } = useKioskPrinterContext();

  const handleClick = () => {
    if (connected) return; // already paired — nothing for staff to do here
    connect().catch((err) => console.warn('[KioskPrinterPairing] Pairing failed/cancelled:', err));
  };

  return (
    <button
      onClick={handleClick}
      className="w-10 h-10 flex items-center justify-center shrink-0"
      title={connected ? 'Printer terhubung' : 'Hubungkan printer struk'}
    >
      <span
        className={`material-symbols-outlined text-[18px] ${connected ? 'text-green-500' : 'text-[#e5e5e5]'}`}
      >
        bluetooth
      </span>
    </button>
  );
}

// getKioskPrinter, tryReconnectKioskPrinter, and the print-queue helpers
// moved to @/lib/kiosk-printer -- a plain module both this component and
// KioskPrinterProvider can import from without a circular import between
// the two of them.
