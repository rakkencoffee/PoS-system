/**
 * Olsera POS Open API Service
 *
 * Handles authentication and API calls to Olsera POS system.
 * Docs: https://docs-api-open.olsera.co.id/documentation/introduction
 *
 * Flow:
 * 1. Get access_token via POST /api/open-api/v1/id/token
 * 2. Use token in Authorization header for all subsequent calls
 * 3. Endpoints use store alias in URL path: /{storeAlias}/api/open-api/v1/en/...
 */

const OLSERA_API_BASE = process.env.OLSERA_API_BASE || 'https://api-open.olsera.co.id';
const OLSERA_APP_ID = process.env.OLSERA_APP_ID || '';
const OLSERA_SECRET_KEY = process.env.OLSERA_SECRET_KEY || '';
const OLSERA_STORE_ID = process.env.OLSERA_STORE_ID || '';

// Token cache
let cachedToken: { token: string; expiresAt: number } | null = null;
let cachedStoreAlias: string | null = null;

/**
 * Get access token from Olsera API
 */
async function getAccessToken(): Promise<string> {
  // Return cached token if not expired (with 5 min buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 300_000) {
    return cachedToken.token;
  }

  const formData = new URLSearchParams();
  formData.append('app_id', OLSERA_APP_ID);
  formData.append('secret_key', OLSERA_SECRET_KEY);
  formData.append('grant_type', 'secret_key');

  const res = await fetch(`${OLSERA_API_BASE}/api/open-api/v1/id/token`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Olsera auth failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token || data.data?.access_token,
    expiresAt: Date.now() + 3600_000, // assume 1 hour validity
  };

  return cachedToken.token;
}

/**
 * Make authenticated API call to Olsera
 */
async function olseraFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();

  // Add a timestamp parameter to aggressively bypass any Next.js disk caching
  const separator = path.includes('?') ? '&' : '?';
  const url = `${OLSERA_API_BASE}/api/open-api/v1/en${path}${separator}_t=${Date.now()}`;

  console.log(`[Olsera API] Fetching: ${url}`);

  return fetch(url, {
    cache: 'no-store', // Prevent Next.js from caching
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

// ──────────────────────────────
// Public API
// ──────────────────────────────

export interface OlseraProduct {
  id: number;
  product_id?: number;
  name: string;
  description: string;
  price: number;
  sell_price?: number;
  photo?: string;
  photo_md?: string;
  image?: string;
  is_active: boolean | number;
  product_group_id?: number;
  product_group_name?: string;
  group_name?: string;
  variants?: OlseraVariant[];
  [key: string]: unknown;
}

export interface OlseraVariant {
  id: number;
  variant_id?: number;
  name: string;
  price: number;
  sell_price?: number;
  [key: string]: unknown;
}

export interface OlseraProductGroup {
  id: number;
  name: string;
  description?: string;
  photo?: string;
  [key: string]: unknown;
}

/**
 * Fetch all products from Olsera
 */
export async function getProducts(): Promise<OlseraProduct[]> {
  const res = await olseraFetch('/product');
  if (!res.ok) {
    const text = await res.text();
    console.error('Olsera getProducts error:', text);
    throw new Error(`Failed to fetch products: ${res.status}`);
  }

  const data = await res.json();
  return data.data || data;
}

/**
 * Fetch product groups (categories) from Olsera
 */
export async function getProductGroups(): Promise<OlseraProductGroup[]> {
  const res = await olseraFetch('/productgroup');
  if (!res.ok) {
    const text = await res.text();
    console.error('Olsera getProductGroups error:', text);
    throw new Error(`Failed to fetch product groups: ${res.status}`);
  }

  const data = await res.json();
  return data.data || data;
}

/**
 * Create an open order in Olsera
 */
export async function createOrder(
  items: { productId: string; variantId?: string; quantity: number; price?: number; note?: string }[] = [],
  currencyId: string | number = 'IDR'
): Promise<{ id: number; order_id?: number; [key: string]: unknown }> {
  const formData = new URLSearchParams();
  formData.append('order_date', new Date().toISOString().split('T')[0]);
  formData.append('currency_id', String(currencyId));

  items.forEach((item, index) => {
    formData.append(`items[${index}][product_id]`, item.productId);
    formData.append(`items[${index}][qty]`, String(item.quantity));
    if (item.price) formData.append(`items[${index}][price]`, String(item.price));
    if (item.variantId) {
      formData.append(`items[${index}][variant_id]`, item.variantId);
    }
  });

  const token = await getAccessToken();

  const res = await fetch(
    `${OLSERA_API_BASE}/api/open-api/v1/en/order/openorder`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      body: formData,
    }
  );

  if (!res.ok) {
    const text = await res.text();
    console.error('Olsera createOrder error:', text);
    throw new Error(`Failed to create order: ${res.status}`);
  }

  const data = await res.json();
  return data.data || data;
}

/**
 * Add item to an open order
 */
export async function addItemToOrder(
  orderId: number,
  productId: number,
  variantId: number | null,
  quantity: number = 1,
  note: string = ''
): Promise<unknown> {
  const formData = new URLSearchParams();
  formData.append('order_id', String(orderId));
  // Olsera uses "product_id|variant_id" format
  formData.append('product_id', variantId ? `${productId}|${variantId}` : String(productId));
  formData.append('qty', String(quantity));
  if (note) formData.append('note', note);

  const token = await getAccessToken();

  const res = await fetch(
    `${OLSERA_API_BASE}/api/open-api/v1/en/order/openorder/additem`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      body: formData,
    }
  );

  if (!res.ok) {
    const text = await res.text();
    console.error('Olsera addItemToOrder error:', text);
    throw new Error(`Failed to add item to order: ${res.status}`);
  }

  const data = await res.json();
  return data.data || data;
}

/**
 * Update order payment status in Olsera
 */
export async function updateOrderStatus(
  orderId: number,
  status: string = 'paid'
): Promise<unknown> {
  const formData = new URLSearchParams();
  formData.append('order_id', String(orderId));
  formData.append('status', status);

  const token = await getAccessToken();

  const res = await fetch(
    `${OLSERA_API_BASE}/api/open-api/v1/en/order/openorder/status`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      body: formData,
    }
  );

  if (!res.ok) {
    const text = await res.text();
    console.error('Olsera updateOrderStatus error:', text);
    throw new Error(`Failed to update order status: ${res.status}`);
  }

  const data = await res.json();
  return data.data || data;
}
