/**
 * Print Bridge Client — Komunikasi dari web app ke Print Bridge lokal
 * 
 * Print Bridge berjalan di PC yang sama (localhost:3001)
 * atau PC di jaringan lokal (192.168.x.x:3001)
 */

const PRINT_BRIDGE_URL = 
  typeof window !== 'undefined' && process.env.NEXT_PUBLIC_PRINT_BRIDGE_URL
    ? process.env.NEXT_PUBLIC_PRINT_BRIDGE_URL
    : 'http://localhost:3001';

if (typeof window !== 'undefined') {
  console.log('[PrintBridge] Client initialized with URL:', PRINT_BRIDGE_URL);
}

export interface PrintReceiptData {
  orderId: string;
  queueNumber: string | number;
  customerName?: string;
  items: {
    name?: string;
    menuItem?: { name: string };
    quantity: number;
    price?: number;
    subtotal?: number;
    size?: string;
    notes?: string;
    categorySlug?: string;
  }[];
  total: number;
  discount?: number;
  paymentMethod: string;
  edcData?: {
    approvalCode: string;
    cardNo: string;
    refNo: string;
  };
}

/**
 * Check if Print Bridge is online
 */
export async function checkPrintBridge(): Promise<boolean> {
  try {
    const res = await fetch(`${PRINT_BRIDGE_URL}/health`, {
      signal: AbortSignal.timeout(2000), // 2s timeout
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Send receipt to Print Bridge for silent thermal printing.
 * Falls back gracefully if Print Bridge is offline.
 * 
 * @returns { printed: boolean, method: 'bridge' | 'browser' | 'none', error?: string }
 */
export async function printReceipt(
  data: PrintReceiptData
): Promise<{ printed: boolean; method: 'bridge' | 'browser' | 'none'; error?: string }> {
  try {
    // Normalize item names
    const normalizedData = {
      ...data,
      items: data.items.map(item => ({
        ...item,
        name: item.menuItem?.name || item.name || 'Item',
        price: item.price || item.subtotal || 0,
      })),
    };

    console.log(`[PrintBridge] POST ${PRINT_BRIDGE_URL}/print ...`);
    const res = await fetch(`${PRINT_BRIDGE_URL}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalizedData),
      // Use standard timeout if AbortSignal.timeout is not supported
      signal: (AbortSignal as any).timeout ? (AbortSignal as any).timeout(10000) : undefined,
    });

    if (res.ok) {
      console.log('[PrintBridge] ✅ Receipt printed via thermal printer');
      return { printed: true, method: 'bridge' };
    }

    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    console.warn('[PrintBridge] ⚠️ Print failed:', err.error);
    return { printed: false, method: 'none', error: err.error };

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.warn('[PrintBridge] ⚠️ Bridge offline, falling back to browser print:', message);
    
    // Fallback: trigger browser print dialog
    if (typeof window !== 'undefined') {
      window.print();
      return { printed: true, method: 'browser' };
    }

    return { printed: false, method: 'none', error: message };
  }
}

/**
 * Initiate payment via local EDC terminal
 */
export async function payWithEDC(
  amount: number,
  orderId: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch(`${PRINT_BRIDGE_URL}/payment/edc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, orderId }),
      // No standard signal timeout here as EDC payment can take time
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, data };
    }
    return { success: false, error: data.error || 'Payment failed' };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Print Bridge Offline: ${message}` };
  }
}

