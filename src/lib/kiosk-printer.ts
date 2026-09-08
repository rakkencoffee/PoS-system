/**
 * Window-global bridge between the checkout page's submit handler and
 * KioskPrinterProvider's single, session-long useBlePrinter() instance — see
 * KioskPrinterProvider for why this lives outside React's own state/context.
 * Kept in a plain module (not a component file) so both KioskPrinterPairing
 * and KioskPrinterProvider can import from here without a circular import
 * between the two of them.
 */

/** Read from the checkout/success flow, or KioskPrinterProvider's own print queue. */
export function getKioskPrinter(): { writeBytes: (bytes: Uint8Array) => Promise<void> } | null {
  if (typeof window === 'undefined') return null;
  return (window as any).__kioskPrinter ?? null;
}

/**
 * Silent reconnect attempt to call right before printing, in case the GATT
 * connection dropped from being idle (e.g. EDC troubleshooting, or the
 * kiosk's own idle timeout) — see the comment in KioskPrinterProvider.
 * Resolves to whether a device was actually reconnected; never throws.
 */
export async function tryReconnectKioskPrinter(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const reconnect = (window as any).__kioskPrinterReconnect as (() => Promise<boolean>) | undefined;
  if (!reconnect) return false;
  try {
    return await reconnect();
  } catch {
    return false;
  }
}

// --- Server-driven kiosk nota printing, mirroring how KDS printing works ---
//
// Printing used to live entirely inside checkout's own component state
// (printViaBluetooth(), called from finalizeOrder() only once EdcPaymentFlow
// itself sees APPROVED). That meant a customer navigating away, cancelling,
// or the tab reloading while a slow EDC/QRIS approval was still pending
// silently lost the receipt print forever -- confirmed live 2026-09-08 for a
// QRIS payment whose approval took long enough that only the KDS sticker
// came out (server-driven, doesn't care whether any tab is watching), not
// the kiosk nota.
//
// The fix: checkout just queues "this order needs printing" here (persisted
// to localStorage, so it survives reloads/navigation on this tablet), and
// KioskPrinterProvider -- which lives for the whole kiosk session, not just
// the checkout page -- owns actually watching for APPROVED and printing,
// pulling receipt data from the already-created PrintJob row server-side
// instead of live cart state. Same shape as KDS: server truth in, one
// persistent listener, no dependency on a specific page staying mounted.

const PENDING_PRINTS_KEY = 'rakken-kiosk-pending-prints';
export const PENDING_PRINT_EVENT = 'kiosk-pending-print';

export interface PendingKioskPrint {
  orderId: string;
}

export function queueKioskPrint(entry: PendingKioskPrint): void {
  if (typeof window === 'undefined') return;
  try {
    const list = readPendingKioskPrints();
    if (!list.some((p) => p.orderId === entry.orderId)) {
      list.push(entry);
      localStorage.setItem(PENDING_PRINTS_KEY, JSON.stringify(list));
    }
  } catch {
    // ignore — private mode / storage disabled
  }
  window.dispatchEvent(new CustomEvent<PendingKioskPrint>(PENDING_PRINT_EVENT, { detail: entry }));
}

export function readPendingKioskPrints(): PendingKioskPrint[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PENDING_PRINTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function removePendingKioskPrint(orderId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const list = readPendingKioskPrints().filter((p) => p.orderId !== orderId);
    localStorage.setItem(PENDING_PRINTS_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

// Short-lived (this tab/session only) result flag the /success page polls
// briefly to show whether the nota actually printed — printing now happens
// asynchronously in KioskPrinterProvider, so it's no longer known
// synchronously at the moment checkout navigates to /success.
export function setKioskPrintResult(orderId: string, result: 'ok' | 'failed'): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(`rakken-kiosk-print-result-${orderId}`, result);
  } catch {
    // ignore
  }
}

export function readKioskPrintResult(orderId: string): 'ok' | 'failed' | null {
  if (typeof window === 'undefined') return null;
  try {
    return (sessionStorage.getItem(`rakken-kiosk-print-result-${orderId}`) as 'ok' | 'failed' | null) ?? null;
  } catch {
    return null;
  }
}
