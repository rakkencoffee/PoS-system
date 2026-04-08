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

// Payment methods cache - Initialize with a robust fallback
let cachedPaymentMethods: any[] | null = [{ id: 1, name: 'Cash/General' }];
let paymentMethodsExpiry: number = 0;
const CACHE_TTL_PAYMENT = 3600_000; // 1 hour for success
const CACHE_TTL_FAILURE = 300_000;  // 5 minutes for failure (negative cache)

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
  const url = `${OLSERA_API_BASE}/api/open-api/v1/en${path}${separator}_t=${Date.now()}`;

  console.log(`[Olsera API] Fetching (${retryCount > 0 ? "RETRY " + retryCount : "FIRST"}): ${url}`);

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

    // If unauthorized, clear cached token and retry exactly once
    if (res.status === 401 && retryCount === 0) {
      console.warn('[Olsera API] Token expired or invalid. Refreshing token and retrying...');
      cachedToken = null; 
      return olseraFetch(path, options, 1);
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
    
    // If it's a network error or timeout and we haven't retried yet, retry once
    const isNetworkError = err.name === 'AbortError' || err.code === 'UND_ERR_CONNECT_TIMEOUT' || err.message?.includes('fetch failed');
    if (isNetworkError && retryCount < 1) {
      console.warn(`[Olsera API] Network/Timeout error (${err.name}). Retrying once...`);
      // Wait 1s before retry
      await new Promise(r => setTimeout(r, 1000));
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
 * GET /order/openorder/detail?id=xxx
 * Note: Use the numeric internal ID.
 */
export async function getOrderDetail(orderId: number | string): Promise<any> {
  // Extract numeric ID if string (e.g. OLSERA-12345 -> 12345)
  const numericId = typeof orderId === 'string' 
    ? orderId.replace('OLSERA-', '') 
    : orderId;

  console.log(`[Olsera API] Fetching detail for order: ${numericId}`);

  const res = await olseraFetch(`/order/openorder/detail?id=${numericId}`);
  if (!res.ok) {
    const text = await res.text();
    console.error(`Olsera getOrderDetail error for ${numericId}:`, text);
    throw new Error(`Failed to fetch open order detail: ${res.status}`);
  }

  const data = await res.json();
  // Detail API returns order inside .data
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
  });

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
  return result;
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
  formData.append('is_funding', '0'); // Required by Olsera Open API (boolean: 1/0)
  
  if (customer_name) {
    formData.append('customer_name', customer_name);
    // Guest profile requires email, phone, and customer_type_id to avoid 406 errors
    const uniqueId = Date.now().toString().slice(-6);
    formData.append('customer_email', `${customer_name.replace(/\s+/g, '').toLowerCase()}${uniqueId}@rakkencoffee.com`);
    formData.append('customer_phone', `08123${uniqueId}`);
    formData.append('customer_type_id', '0'); // Guest type ID found from API
  } else {
    formData.append('customer_name', 'Guest');
    formData.append('customer_type_id', '0');
  }

  // Items are better added via addItemToOrder after getting order_id
  // but we keep the logic here if items were passed
  if (items && items.length > 0) {
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
  }

  const res = await olseraFetch('/order/openorder', {
    method: 'POST',
    body: formData,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
  note: string = ''
): Promise<unknown> {
  const formData = new URLSearchParams();
  formData.append('order_id', String(orderId));
  // For products WITH variants: use "product_id|variant_id" pipe format (Standard Olsera Open API)
  // For products WITHOUT variants: use just the numeric product ID
  const itemValue = variantId ? `${productId}|${variantId}` : String(productId);
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

