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
 *
 * CACHING STRATEGY (3-layer):
 * Layer 1: In-memory (fastest ~0ms) — survives within warm Vercel container
 * Layer 2: Upstash Redis (~5ms) — survives Vercel cold starts and container recycling
 * Layer 3: Fresh API call (~500-2000ms) — last resort with retry + exponential backoff
 *
 * A mutex prevents concurrent token requests that cause Olsera rate-limiting/401s.
 */

import { redis } from '@/lib/redis';

// ──────────────────────────────
// LAZY ENV GETTERS: Read from process.env on every call.
// This prevents empty strings being cached when Next.js HMR
// re-evaluates the module before .env is fully loaded.
// ──────────────────────────────
function getEnv() {
  return {
    API_BASE: (process.env.OLSERA_API_BASE || 'https://api-open.olsera.co.id').replace(/\/+$/, ''),
    APP_ID: (process.env.OLSERA_APP_ID || '').trim(),
    SECRET_KEY: (process.env.OLSERA_SECRET_KEY || '').trim(),
    STORE_ID: (process.env.OLSERA_STORE_ID || '').trim(),
  };
}

// ──────────────────────────────
// Redis-Based Token Cache (survives Vercel cold starts)
// ──────────────────────────────
const REDIS_TOKEN_KEY = 'olsera:access_token';
const REDIS_TOKEN_TTL_SECONDS = 3000; // 50 minutes (token valid 1hr, 10min buffer)

interface TokenCache {
  token: string;
  expiresAt: number;
}

// In-memory fast cache (primary — survives within a warm container)
let cachedToken: TokenCache | null = null;
let cachedStoreAlias: string | null = null;

// Mutex: only one token request at a time (prevents race conditions)
let tokenRefreshPromise: Promise<string> | null = null;

/**
 * Read token from Redis (fallback when in-memory cache is empty after cold start)
 */
async function readTokenFromRedis(): Promise<TokenCache | null> {
  try {
    const data = await redis.get<TokenCache>(REDIS_TOKEN_KEY);
    if (data && data.token && data.expiresAt > Date.now() + 300_000) {
      return data;
    }
    return null;
  } catch (err) {
    console.warn('[Olsera Auth] Could not read token from Redis:', err);
    return null;
  }
}

/**
 * Write token to Redis for persistence across Vercel cold starts
 */
async function writeTokenToRedis(cache: TokenCache): Promise<void> {
  try {
    await redis.set(REDIS_TOKEN_KEY, cache, { ex: REDIS_TOKEN_TTL_SECONDS });
  } catch (err) {
    // Non-fatal: if we can't write, we just won't have Redis persistence
    console.warn('[Olsera Auth] Could not persist token to Redis:', err);
  }
}

/**
 * Actually fetch a new token from Olsera API (internal, called by getAccessToken)
 */
async function fetchNewToken(): Promise<string> {
  const env = getEnv();

  // Safe logging for debugging .env propagation in Vercel
  const safeLog = (name: string, val: string) => {
    const v = val || '';
    const masked = v.length > 6 
      ? `${v.substring(0, 3)}...${v.substring(v.length - 3)}` 
      : '***';
    return `${name}: [${masked}] (len: ${v.length})`;
  };

  console.log(`[Olsera Auth] Attempting token fetch (DEBUG enabled)...`);
  console.log(`[Olsera Auth] ${safeLog('APP_ID', env.APP_ID)}`);
  console.log(`[Olsera Auth] ${safeLog('SECRET_KEY', env.SECRET_KEY)}`);
  console.log(`[Olsera Auth] URL: ${env.API_BASE}/api/open-api/v1/id/token`);

  // Safety check: if credentials are missing, fail fast with a helpful message
  if (!env.APP_ID || !env.SECRET_KEY) {
    console.error('[Olsera Auth] ❌ OLSERA_APP_ID or OLSERA_SECRET_KEY is empty!');
    throw new Error('Olsera credentials not configured.');
  }

  const formData = new URLSearchParams();
  formData.append('app_id', env.APP_ID);
  formData.append('secret_key', env.SECRET_KEY);
  formData.append('grant_type', 'secret_key');

  // Retry up to 3 times with exponential backoff
  const MAX_AUTH_RETRIES = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_AUTH_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = Math.min(1000 * Math.pow(2, attempt), 8000); // 2s, 4s, 8s
      console.warn(`[Olsera Auth] Retry ${attempt}/${MAX_AUTH_RETRIES} in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }

    try {
      // Add explicit timeout for cold-start resilience on Vercel
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const res = await fetch(`${env.API_BASE}/api/open-api/v1/id/token`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const token = data.access_token || data.data?.access_token;
        if (token) {
          const newCache: TokenCache = {
            token,
            expiresAt: Date.now() + 3600_000, // 1 hour validity
          };
          cachedToken = newCache;
          // Persist to Redis (non-blocking — don't await to avoid slowing response)
          writeTokenToRedis(newCache).catch(() => {});
          console.log(`[Olsera Auth] ✅ Token acquired successfully (attempt ${attempt + 1})`);
          return token;
        }
      }

      const text = await res.text();
      lastError = new Error(`Olsera auth failed (${res.status}): ${text}`);
      
      // If it's a 401, it might be a transient issue — retry
      if (res.status === 401) {
        console.warn(`[Olsera Auth] Got 401 on attempt ${attempt + 1}. Will retry...`);
        continue;
      }
      
      // For other errors (500, etc.), also retry
      console.warn(`[Olsera Auth] Got ${res.status} on attempt ${attempt + 1}. Will retry...`);
    } catch (fetchErr: any) {
      lastError = fetchErr;
      console.warn(`[Olsera Auth] Network error on attempt ${attempt + 1}:`, fetchErr.message);
    }
  }

  throw lastError || new Error('Olsera auth failed after all retries');
}

/**
 * Get access token from Olsera API (with Redis cache, mutex, and retry)
 */
async function getAccessToken(): Promise<string> {
  // 1. Check in-memory cache first (fastest — ~0ms)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 300_000) {
    return cachedToken.token;
  }

  // 2. Check Redis cache (survives Vercel cold starts — ~5ms)
  const redisCache = await readTokenFromRedis();
  if (redisCache) {
    cachedToken = redisCache; // warm the in-memory cache
    console.log('[Olsera Auth] 🔄 Recovered token from Redis cache (survived cold start)');
    return redisCache.token;
  }

  // 3. Need to fetch a new token — use mutex to prevent concurrent requests
  if (tokenRefreshPromise) {
    console.log('[Olsera Auth] ⏳ Waiting for existing token request...');
    return tokenRefreshPromise;
  }

  tokenRefreshPromise = fetchNewToken().finally(() => {
    tokenRefreshPromise = null; // release the mutex
  });

  return tokenRefreshPromise;
}

// Payment methods cache - Initialize with a robust fallback
let cachedPaymentMethods: any[] | null = [{ id: 1, name: 'Cash/General' }];
let paymentMethodsExpiry: number = 0;
const CACHE_TTL_PAYMENT = 3600_000; // 1 hour for success
const CACHE_TTL_FAILURE = 300_000;  // 5 minutes for failure (negative cache)

/**
 * Make authenticated API call to Olsera
 */
export async function olseraFetch(
  path: string, 
  options: RequestInit & { silent?: boolean } = {}, 
  retryCount = 0
): Promise<Response> {
  const { silent, ...fetchOptions } = options;
  const token = await getAccessToken();

  // Add timeout using AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

  // Add a timestamp parameter to aggressively bypass any Next.js disk caching
  const separator = path.includes('?') ? '&' : '?';
  const url = `${getEnv().API_BASE}/api/open-api/v1/en${path}${separator}_t=${Date.now()}`;

  if (!silent) {
    console.log(`[Olsera API] ${retryCount > 0 ? `RETRY ${retryCount}` : "→"} ${path}`);
  }

  try {
    const res = await fetch(url, {
      cache: 'no-store', // Prevent Next.js from caching
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...fetchOptions.headers,
      },
    });

    clearTimeout(timeoutId);

    // If unauthorized, invalidate ALL caches and retry with fresh token
    if (res.status === 401 && retryCount < 2) {
      console.warn(`[Olsera API] 401 on ${path}. Invalidating token & retrying (attempt ${retryCount + 1}/2)...`);
      cachedToken = null;
      // Also delete Redis cache to force a truly fresh token
      redis.del(REDIS_TOKEN_KEY).catch(() => {});
      // Backoff before retry
      await new Promise(r => setTimeout(r, 1000 * (retryCount + 1)));
      return olseraFetch(path, options, retryCount + 1);
    }

    // If not successful, log the body for debugging
    if (!res.ok && !silent) {
      const cloned = res.clone();
      try {
        const errorBody = await cloned.text();
        console.error(`[Olsera API] Request failed: ${res.status} - ${path}`, errorBody);
      } catch (e) {
        console.error(`[Olsera API] Request failed (${res.status}) but body unreadable:`, e);
      }
    }

    return res;
  } catch (err: any) {
    clearTimeout(timeoutId);
    
    // If it's a network error or timeout and we haven't retried enough, retry
    const isNetworkError = err.name === 'AbortError' || err.code === 'UND_ERR_CONNECT_TIMEOUT' || err.message?.includes('fetch failed');
    if (isNetworkError && retryCount < 2) {
      console.warn(`[Olsera API] Network error (${err.name}). Retrying in ${(retryCount + 1)}s...`);
      await new Promise(r => setTimeout(r, 1000 * (retryCount + 1)));
      return olseraFetch(path, options, retryCount + 1);
    }
    
    throw err;
  }
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
 * Get stock level for a specific product
 */
export async function getProductStock(olseraProductId: string | number): Promise<number> {
  const res = await olseraFetch(`/product?product_id=${olseraProductId}`);
  if (!res.ok) return 0;
  const data = await res.json();
  const product = data.data?.[0] || data?.[0];
  return product ? (product.stock || 0) : 0;
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

// Order Detail Cache: prevents re-fetching same details within a short window
const orderDetailCache = new Map<string | number, { data: any, expiresAt: number }>();
const CACHE_TTL_ORDER_DETAIL = 300_000; // 5 minutes

/**
 * Fetch open order detail from Olsera
 * GET /order/openorder/detail?id=xxx
 * Note: Use the numeric internal ID.
 */
export async function getOrderDetail(orderId: number | string): Promise<any> {
  const numericId = typeof orderId === 'string' 
    ? orderId.replace('OLSERA-', '') 
    : orderId;

  // Check Cache First
  const cached = orderDetailCache.get(numericId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  console.log(`[Olsera API] Fetching detail for order: ${numericId}`);

  let res = await olseraFetch(`/order/openorder/detail?id=${numericId}`);
  if (res.status === 429) {
    console.warn(`[Olsera API] Rate limited (429) on order ${numericId}. Waiting 2s...`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    res = await olseraFetch(`/order/openorder/detail?id=${numericId}`);
  }

  if (!res.ok) {
    const text = await res.text();
    console.error(`Olsera getOrderDetail error for ${numericId}:`, text);
    throw new Error(`Failed to fetch open order detail: ${res.status}`);
  }

  const data = await res.json();
  const order = data.data || data;
  
  if (!order || (!order.id && !order.order_id)) {
    throw new Error(`Order ${orderId} detail empty or malformed`);
  }

  // Ensure 'total' is available (alias for total_amount in Open Order)
  if (order.total_amount && !order.total) {
    order.total = order.total_amount;
  }
  
  // Ensure 'items' is available (alias for orderitems in Open Order)
  if (Array.isArray(order.orderitems) && !order.items) {
    order.items = order.orderitems;
  }

  // Store in cache
  orderDetailCache.set(numericId, {
    data: order,
    expiresAt: Date.now() + CACHE_TTL_ORDER_DETAIL
  });

  return order;
}

/**
 * Fetch closed order detail from Olsera
 * GET /order/closeorder/detail?id=xxx
 */
export async function getClosedOrderDetail(orderId: number): Promise<any> {
  const res = await olseraFetch(`/order/closeorder/detail?id=${orderId}`);
  if (!res.ok) {
    const text = await res.text();
    console.error('Olsera getClosedOrderDetail error:', text);
    throw new Error(`Failed to fetch closed order detail: ${res.status}`);
  }

  const data = await res.json();
  return data.data || data;
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
    silent: true, // Suppress 406 "already in status" log noise
  } as any);

  if (!res.ok) {
    const text = await res.text();
    
    // IDEMPOTENCY CHECK: If status is already what we want, Olsera returns 406.
    // We catch this and treat it as a success to avoid terminal clutter.
    if (res.status === 406 && (text.includes('sebelumnya sudah') || text.includes('already'))) {
      console.log(`[Olsera API] Order ${orderId} is already in status ${status}. Skipping update.`);
      return { success: true, message: 'Already in target status' };
    }

    console.error(`Olsera updateOrderStatus error for ${orderId}:`, text);
    throw new Error(`Failed to update order status: ${res.status}`);
  }

  const result = await res.json();
  console.log(`[Olsera API] Successfully updated order ${orderId} to status ${status}`);
  
  // Invalidate Cache so next fetch gets new status
  orderDetailCache.delete(orderId);
  orderDetailCache.delete(String(orderId));

  return result;
}

/**
 * Create an open order in Olsera
 */
export async function createOrder(
  items: { productId: string; variantId?: string; quantity: number; price?: number; note?: string }[] = [],
  options: { currencyId?: string | number; customer_name?: string; notes?: string } = {}
): Promise<{ id: number; order_id?: number; [key: string]: unknown }> {
  const { currencyId = 'IDR', customer_name, notes } = options;
  const uniqueId = Date.now().toString().slice(-6);
  
  // Format dates and customer info
  const payload: any = {
    order_date: new Date().toISOString().split('T')[0],
    currency_id: String(currencyId),
    is_funding: 0,
    customer_name: customer_name || 'Guest',
    customer_email: customer_name 
      ? `${customer_name.replace(/\s+/g, '').toLowerCase()}${uniqueId}@rakkencoffee.com`
      : `guest${uniqueId}@rakkencoffee.com`,
    customer_phone: customer_name ? `08123${uniqueId}` : `08100${uniqueId}`,
    customer_type_id: 0,
    notes: notes || '',
    items: (items || []).map(item => ({
      product_id: Number(item.productId),
      variant_id: item.variantId ? Number(item.variantId) : 0,
      qty: Number(item.quantity),
      price: Number(item.price || 0),
      notes: item.note || ''
    }))
  };

  console.log(`[Olsera API] createOrder JSON payload:`, JSON.stringify(payload));

  const res = await olseraFetch('/order/openorder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('Olsera createOrder error details:', text);
    throw new Error(`Failed to create order header: ${res.status} - ${text}`);
  }

  const result = await res.json();
  const data = result.data || result;
  
  if (!data || !(data.id || data.order_id)) {
    throw new Error(`Olsera createOrder response missing ID: ${JSON.stringify(result)}`);
  }

  return data;
}

/**
 * Add item to an open order
 */
export async function addItemToOrder(
  orderId: number,
  productId: number,
  variantId: number | null,
  quantity: number = 1,
  note: string = '',
  price?: number
): Promise<unknown> {
  const formData = new URLSearchParams();
  formData.append('order_id', String(orderId));
  // For products WITH variants: use "product_id|variant_id" pipe format (Standard Olsera Open API)
  // For products WITHOUT variants: use just the numeric product ID
  const itemValue = variantId ? `${productId}|${variantId}` : String(productId);
  formData.append('item_products', itemValue);
  formData.append('item_qty', String(quantity));
  if (price !== undefined) formData.append('item_price', String(price));
  if (note) formData.append('notes', note);

  console.log(`[Olsera API] addItemToOrder payload:`, Object.fromEntries(formData));

  const response = await olseraFetch('/order/openorder/additem', {
    method: 'POST',
    body: formData,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  const resData = await response.json();
  console.log(`[Olsera API] addItemToOrder response for ${productId}:`, JSON.stringify(resData));

  if (!response.ok || (resData.status !== 'success' && resData.error)) {
    throw new Error(`Olsera Add Item Error: ${resData.error || response.statusText}`);
  }

  return resData;
}

/**
 * Fetch available payment methods from Olsera
 * GET /global/list-payment
 */
export async function getPaymentMethods(): Promise<{ id: number; name: string; [key: string]: unknown }[]> {
  // Return cached methods if available and not expired
  if (cachedPaymentMethods && paymentMethodsExpiry > Date.now()) {
    console.log('[Olsera API] Using cached payment methods');
    return cachedPaymentMethods;
  }

  try {
    const res = await olseraFetch('/global/list-payment?per_page=50', { silent: true });
    if (!res.ok) {
      throw new Error(`Status ${res.status}`);
    }

    const data = await res.json();
    const methods = data.data || data;
    
    if (Array.isArray(methods)) {
      cachedPaymentMethods = methods;
      paymentMethodsExpiry = Date.now() + CACHE_TTL_PAYMENT;
      console.log('[Olsera API] Fetched and cached payment methods');
      return methods;
    }
    
    return methods || [];
  } catch (error: any) {
    // NEGATIVE CACHING: Update expiry even on failure so we don't retry immediately
    paymentMethodsExpiry = Date.now() + CACHE_TTL_FAILURE;
    
    console.warn('[Olsera API] Payment API unavailable (500), using fallback for 5 mins.');
    
    // We already have a default in cachedPaymentMethods from initialization
    return cachedPaymentMethods || [{ id: 1, name: 'Cash/General' }];
  }
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
  formData.append('payment_seq', '1');

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


/**
 * Fetch both open and closed orders from Olsera
 */
export async function getAllOrders(options: { today?: boolean } = {}): Promise<any[]> {
  const { today } = options;
  const allOrders: any[] = [];
  
  // Date filter for today (WIB / GMT+7)
  let dateFilter = '';
  if (today) {
    const now = new Date();
    // Adjust to WIB (GMT+7)
    const wibOffset = 7 * 60 * 60 * 1000;
    const wibDate = new Date(now.getTime() + wibOffset);
    dateFilter = wibDate.toISOString().split('T')[0];
    console.log(`[Olsera API] Filtering orders for today: ${dateFilter}`);
  }

  try {
    // 1. Fetch Open Orders
    const openRes = await olseraFetch(`/order/openorder?per_page=50`);
    if (openRes.ok) {
      const data = await openRes.json();
      const orders = data.data || data || [];
      if (Array.isArray(orders)) {
        allOrders.push(...orders);
      }
    }

    // 2. Fetch Closed Orders
    const closedRes = await olseraFetch(`/order/closeorder?per_page=50${today ? `&start_date=${dateFilter}` : ''}`);
    if (closedRes.ok) {
      const data = await closedRes.json();
      const orders = data.data || data || [];
      if (Array.isArray(orders)) {
        allOrders.push(...orders);
      }
    }

    // Sort by date descending
    allOrders.sort((a, b) => {
      const dateA = new Date(a.order_date || a.created_at || 0).getTime();
      const dateB = new Date(b.order_date || b.created_at || 0).getTime();
      return dateB - dateA;
    });

    console.log(`[Olsera API] Total orders fetched (Open+Closed): ${allOrders.length}`);
    return allOrders;
  } catch (err) {
    console.error('[Olsera API] Error fetching combined orders:', err);
    throw err;
  }
}

/**
 * Fetch all active discount vouchers from Olsera
 */
export async function getVouchers(): Promise<any[]> {
  const res = await olseraFetch('/discountvoucher');
  if (!res.ok) {
    const text = await res.text();
    console.error('Olsera getVouchers error:', text);
    return [];
  }
  const data = await res.json();
  return data.data || data || [];
}

/**
 * Validate a voucher code remotely via Olsera
 */
export async function validateVoucherRemote(code: string, totalAmount: number): Promise<{
  valid: boolean;
  discountAmount: number;
  message: string;
}> {
  const uppercaseCode = code.toUpperCase().trim();
  
  // 1. Fetch available vouchers
  const vouchers = await getVouchers();
  
  // 2. Find matching voucher by code
  const voucher = vouchers.find((v: any) => 
    (v.code?.toUpperCase() === uppercaseCode) || 
    (v.voucher_code?.toUpperCase() === uppercaseCode)
  );

  if (!voucher) {
    return { valid: false, discountAmount: 0, message: 'Kode voucher tidak valid.' };
  }

  // 3. Check status
  if (voucher.status !== '1' && voucher.status !== 1 && voucher.status !== 'active') {
    return { valid: false, discountAmount: 0, message: 'Voucher sudah tidak aktif.' };
  }

  // 4. Check min purchase
  const minPurchase = Number(voucher.min_purchase || 0);
  if (totalAmount < minPurchase) {
    return { 
      valid: false, 
      discountAmount: 0, 
      message: `Minimal pembelian Rp ${minPurchase.toLocaleString('id-ID')}` 
    };
  }

  // 5. Calculate discount
  let discountAmount = 0;
  const type = voucher.discount_type || (voucher.type === '1' ? 'nominal' : 'percentage');
  const value = Number(voucher.discount_value || voucher.value || 0);

  if (type === 'nominal' || type === '1') {
    discountAmount = value;
  } else {
    discountAmount = Math.floor(totalAmount * (value / 100));
  }

  // Cap discount at total amount
  discountAmount = Math.min(discountAmount, totalAmount);

  return {
    valid: true,
    discountAmount,
    message: 'Voucher berhasil diterapkan!'
  };
}

/**
 * Convenience API Object (Drop-in replacement for olsera.ts)
 */
export const olseraApi = {
  getProducts,
  getProductGroups,
  getProductStock,
  getOrderDetail,
  createOrder,
  addItemToOrder,
  getVouchers,
  validateVoucherRemote,
  olseraFetch // Included for internal use if needed
};
