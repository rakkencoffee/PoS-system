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
export async function olseraFetch(path: string, options: RequestInit = {}, retryCount = 0): Promise<Response> {
  const token = await getAccessToken();

  // Add a timestamp parameter to aggressively bypass any Next.js disk caching
  const separator = path.includes('?') ? '&' : '?';
  const url = `${OLSERA_API_BASE}/api/open-api/v1/en${path}${separator}_t=${Date.now()}`;

  console.log(`[Olsera API] Fetching: ${url}`);

  const res = await fetch(url, {
    cache: 'no-store', // Prevent Next.js from caching
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  // If unauthorized, clear cached token and retry exactly once
  if (res.status === 401 && retryCount === 0) {
    console.warn('[Olsera API] Token expired or invalid. Refreshing token and retrying...');
    cachedToken = null; 
    return olseraFetch(path, options, 1);
  }

  return res;
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
 * Fetch all products from Olsera (with pagination)
 */
export async function getProducts(): Promise<OlseraProduct[]> {
  const allProducts: OlseraProduct[] = [];
  let page = 1;
  const perPage = 50; // Request more items per page to reduce API calls

  while (true) {
    const res = await olseraFetch(`/product?page=${page}&per_page=${perPage}`);
    if (!res.ok) {
      const text = await res.text();
      console.error('Olsera getProducts error:', text);
      throw new Error(`Failed to fetch products: ${res.status}`);
    }

    const data = await res.json();
    const products: OlseraProduct[] = data.data || data;

    if (!products || products.length === 0) {
      break; // No more pages
    }

    allProducts.push(...products);
    console.log(`[Olsera API] Fetched page ${page}: ${products.length} products (total: ${allProducts.length})`);

    // If we got fewer items than per_page, we've reached the last page
    if (products.length < perPage) {
      break;
    }

    page++;
  }

  console.log(`[Olsera API] Total products fetched: ${allProducts.length}`);
  return allProducts;
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
 * Fetch open order detail from Olsera
 * GET /order/openorder/detail?order_id=xxx
 */
export async function getOrderDetail(orderId: number): Promise<any> {
  const res = await olseraFetch(`/order/openorder?per_page=50`);
  if (!res.ok) {
    const text = await res.text();
    console.error('Olsera getOrderDetail error (fetch list):', text);
    throw new Error(`Failed to fetch open orders for detail: ${res.status}`);
  }

  const data = await res.json();
  const rawOrders = data.data || data || [];
  const order = rawOrders.find((o: any) => o.id === orderId || o.order_id === orderId);
  
  if (!order) {
    throw new Error(`Order ${orderId} not found in open orders`);
  }

  return order;
}

/**
 * Update Olsera order status
 * Mapping KDS to Olsera: PENDING->P, PREPARING->A, READY->S, COMPLETED->Z
 */
export async function updateOrderStatus(orderId: number, status: 'P' | 'A' | 'S' | 'Z' | 'X'): Promise<any> {
  const formData = new URLSearchParams();
  formData.append('order_id', String(orderId));
  formData.append('status', status);

  // Olsera requires shipping_date when marking order as Shipped (S) or Completed (Z/T)
  if (status === 'S' || status === 'Z') {
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    formData.append('shipping_date', formattedDate);
  }

  const res = await olseraFetch('/order/openorder/updatestatus', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Olsera updateOrderStatus error for ${orderId}:`, text);
    throw new Error(`Failed to update order status: ${res.status}`);
  }

  return await res.json();
}

/**
 * Create an open order in Olsera
 */
export async function createOrder(
  items: { productId: string; variantId?: string; quantity: number; price?: number; note?: string }[] = [],
  options: { currencyId?: string | number; customer_name?: string } = {}
): Promise<{ id: number; order_id?: number; [key: string]: unknown }> {
  const { currencyId = 'IDR', customer_name } = options;
  const formData = new URLSearchParams();
  formData.append('order_date', new Date().toISOString().split('T')[0]);
  formData.append('currency_id', String(currencyId));
  if (customer_name) formData.append('customer_name', customer_name);

  items.forEach((item, index) => {
    formData.append(`items[${index}][product_id]`, item.productId);
    formData.append(`items[${index}][qty]`, String(item.quantity));
    if (item.price) formData.append(`items[${index}][price]`, String(item.price));
    if (item.variantId) {
      formData.append(`items[${index}][variant_id]`, item.variantId);
    }
    if (item.note) {
      formData.append(`items[${index}][notes]`, item.note);
    }
  });

  const res = await olseraFetch('/order/openorder', {
    method: 'POST',
    body: formData,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

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
  // For products WITH variants: use "variant_id|product_id" pipe format
  // For products WITHOUT variants: use just the numeric product ID
  const itemValue = variantId ? `${variantId}|${productId}` : String(productId);
  formData.append('item_product_id', itemValue);
  formData.append('item_products', itemValue);
  formData.append('item_qty', String(quantity));
  if (note) formData.append('note', note);

  console.log(`[Olsera API] addItemToOrder payload:`, Object.fromEntries(formData));

  const res = await olseraFetch('/order/openorder/additem', {
    method: 'POST',
    body: formData,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('Olsera addItemToOrder error:', text);
    throw new Error(`Failed to add item to order: ${res.status}`);
  }

  const data = await res.json();
  return data.data || data;
}

/**
 * Fetch available payment methods from Olsera
 * GET /global/list-payment
 */
export async function getPaymentMethods(): Promise<{ id: number; name: string; [key: string]: unknown }[]> {
  const res = await olseraFetch('/global/list-payment?per_page=50');
  if (!res.ok) {
    const text = await res.text();
    console.error('Olsera getPaymentMethods error:', text);
    throw new Error(`Failed to fetch payment methods: ${res.status}`);
  }

  const data = await res.json();
  const methods = data.data || data;
  console.log('[Olsera API] Payment methods:', JSON.stringify(methods.map((m: { id: number; name: string }) => ({ id: m.id, name: m.name }))));
  return methods;
}

/**
 * Record payment details on an open order
 * POST /order/openorder/updatepayment
 */
export async function updateOrderPayment(
  orderId: number,
  paymentAmount: number,
  paymentModeId: number,
  currencyId: string = 'IDR'
): Promise<unknown> {
  const today = new Date().toISOString().split('T')[0];

  const formData = new URLSearchParams();
  formData.append('order_id', String(orderId));
  formData.append('payment_amount', String(paymentAmount));
  formData.append('payment_currency_id', currencyId);
  formData.append('payment_date', today);
  formData.append('payment_mode_id', String(paymentModeId));
  formData.append('payment_seq', '0');

  const res = await olseraFetch('/order/openorder/updatepayment', {
    method: 'POST',
    body: formData,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('Olsera updateOrderPayment error:', text);
    throw new Error(`Failed to update order payment: ${res.status}`);
  }

  const data = await res.json();
  console.log(`[Olsera API] Payment recorded for order ${orderId}: ${paymentAmount} IDR via mode ${paymentModeId}`);
  return data.data || data;
}

/**
 * Mark an open order as Paid (status=1) or Unpaid (status=0)
 * POST /order/openorder/updatepaymentstatus
 */
export async function markOrderAsPaid(
  orderId: number,
  paid: boolean = true
): Promise<unknown> {
  const formData = new URLSearchParams();
  formData.append('order_id', String(orderId));
  formData.append('status', paid ? '1' : '0');

  const res = await olseraFetch('/order/openorder/updatepaymentstatus', {
    method: 'POST',
    body: formData,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('Olsera markOrderAsPaid error:', text);
    throw new Error(`Failed to mark order as paid: ${res.status}`);
  }

  const data = await res.json();
  console.log(`[Olsera API] Order ${orderId} marked as ${paid ? 'PAID' : 'UNPAID'}`);
  return data.data || data;
}

