import { olseraRatelimit } from '../redis';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Olsera Native Integration (Choice A Architecture)
 * 
 * Master data (Products, Stock) resides in Olsera.
 * We pull and cache this data in Neon (ProductCache).
 */

const TOKEN_CACHE_FILE = path.join(os.tmpdir(), '.olsera_token_cache.json');

interface TokenCache {
  token: string;
  expiresAt: number;
}

let cachedToken: TokenCache | null = null;
let tokenRefreshPromise: Promise<string> | null = null;

function getEnv() {
  return {
    API_BASE: (process.env.OLSERA_API_BASE || 'https://api-open.olsera.co.id').replace(/\/+$/, ''),
    APP_ID: (process.env.OLSERA_APP_ID || '').trim(),
    SECRET_KEY: (process.env.OLSERA_SECRET_KEY || '').trim(),
    STORE_ID: (process.env.OLSERA_STORE_ID || '').trim(),
  };
}

async function fetchNewToken(): Promise<string> {
  const env = getEnv();
  
  if (!env.APP_ID || !env.SECRET_KEY || env.APP_ID.includes('YOUR_SECRET_VALUE')) {
    console.error('[Olsera Auth] INVALID CREDENTIALS DETECTED. Please check Vercel Env Variables.');
    throw new Error('Olsera credentials are not configured or still using placeholders.');
  }

  const formData = new URLSearchParams();
  formData.append('app_id', env.APP_ID);
  formData.append('secret_key', env.SECRET_KEY);
  formData.append('grant_type', 'secret_key');

  console.log(`[Olsera Auth] Attempting to fetch new token for APP_ID: ${env.APP_ID.substring(0, 5)}...`);
  
  const res = await fetch(`${env.API_BASE}/api/open-api/v1/id/token`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[Olsera Auth] FAILED (${res.status}): ${text}`);
    throw new Error(`Olsera auth failed: ${text}`);
  }

  const data = await res.json();
  const token = data.access_token || data.data?.access_token || data.token;

  if (!token) {
    console.error('[Olsera Auth] Token missing in successful response:', JSON.stringify(data));
    throw new Error('Olsera token missing in response');
  }

  console.log('[Olsera Auth] Successfully retrieved new token.');
  
  const newCache = { token, expiresAt: Date.now() + 3600_000 };
  try { 
    // In Vercel, tmpdir is writable
    fs.writeFileSync(TOKEN_CACHE_FILE, JSON.stringify(newCache)); 
  } catch (err) {
    console.warn('[Olsera Auth] Failed to write token cache file:', err);
  }
  cachedToken = newCache;
  return token;
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 300_000) return cachedToken.token;

  try {
    if (fs.existsSync(TOKEN_CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(TOKEN_CACHE_FILE, 'utf-8'));
      if (data.token && data.expiresAt > Date.now() + 300_000) {
        cachedToken = data;
        return data.token;
      }
    }
  } catch {}

  if (tokenRefreshPromise) return tokenRefreshPromise;
  tokenRefreshPromise = fetchNewToken().finally(() => { tokenRefreshPromise = null; });
  return tokenRefreshPromise;
}

/**
 * Standardized Fetch to Olsera with Rate Limiting
 */
async function olseraFetch(path: string, options: RequestInit = {}) {
  // Rate limit check
  try {
    const { success, reset } = await olseraRatelimit.limit('global');
    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000);
      throw new Error(`Olsera rate limit reached. Retry in ${retryAfter}s`);
    }
  } catch (limitErr) {
    console.warn('[Olsera API] Rate limiter error (Redis probably down), skipping limit...', limitErr);
  }

  const token = await getAccessToken();
  const env = getEnv();
  
  // Always bypass cache
  const separator = path.includes('?') ? '&' : '?';
  const url = `${env.API_BASE}/api/open-api/v1/en${path}${separator}_t=${Date.now()}`;

  console.log(`[Olsera API] FETCH: ${url}`);

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[Olsera API] ERROR ${res.status} on ${path}: ${text}`);
    throw new Error(`Olsera error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data;
}

/**
 * Olsera Native Service API
 */
export const olseraApi = {
  /**
   * Fetch all active products (paginated)
   */
  async getProducts(): Promise<any[]> {
    const allProducts: any[] = [];
    let page = 1;
    const perPage = 50;

    while (true) {
      const data = await olseraFetch(`/product?page=${page}&per_page=${perPage}`);
      const products = data.data || data;

      if (!products || products.length === 0) break;
      allProducts.push(...products);
      if (products.length < perPage) break;
      page++;
    }

    return allProducts;
  },

  /**
   * Get stock level for a specific product
   */
  async getProductStock(olseraProductId: string | number): Promise<number> {
    // Current Open API doesn't have a single /product/:id/stock endpoint like in PLAN.md
    // We usually get stock from the product list or a specific inventory endpoint
    // For Choice A, we'll fetch the product detail to get the latest stock
    const data = await olseraFetch(`/product?product_id=${olseraProductId}`);
    const product = data.data?.[0] || data?.[0];
    return product ? (product.stock || 0) : 0;
  },

  /**
   * Create Transaction Header (Choice A style)
   */
  async createOrder(payload: any) {
    // This matches the existing logic used in the project
    const formData = new URLSearchParams();
    Object.entries(payload).forEach(([key, val]) => {
      formData.append(key, String(val));
    });

    return olseraFetch('/order/openorder', {
      method: 'POST',
      body: formData,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  },

  /**
   * Add Item to existing order
   */
  async addItemToOrder(payload: any) {
    const formData = new URLSearchParams();
    Object.entries(payload).forEach(([key, val]) => {
      formData.append(key, String(val));
    });

    return olseraFetch('/order/openorder/additem', {
      method: 'POST',
      body: formData,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  },

  /**
   * Fetch all active discount vouchers from Olsera
   */
  async getVouchers(): Promise<any[]> {
    const data = await olseraFetch('/discountvoucher');
    return data.data || data || [];
  },

  /**
   * Validate a voucher code remotely via Olsera
   */
  async validateVoucherRemote(code: string, totalAmount: number): Promise<{
    valid: boolean;
    discountAmount: number;
    message: string;
  }> {
    const uppercaseCode = code.toUpperCase().trim();
    console.log(`[Voucher] Validating code: ${uppercaseCode} for amount: ${totalAmount}`);
    
    // 1. Fetch available vouchers
    let vouchers: any[] = [];
    try {
      vouchers = await this.getVouchers();
      console.log(`[Voucher] Retrieved ${vouchers.length} vouchers from Olsera`);
    } catch (err: any) {
      console.error('[Voucher] Failed to fetch vouchers:', err.message);
      return { valid: false, discountAmount: 0, message: 'Gagal menghubungi server Olsera.' };
    }
    
    // 2. Find matching voucher by code - Flexible matching for various schemas
    const voucher = vouchers.find((v: any) => 
      (v.code?.toUpperCase() === uppercaseCode) || 
      (v.voucher_code?.toUpperCase() === uppercaseCode) ||
      (v.promo_code?.toUpperCase() === uppercaseCode)
    );

    if (!voucher) {
      console.warn(`[Voucher] Code ${uppercaseCode} not found in Olsera list`);
      return { valid: false, discountAmount: 0, message: 'Kode voucher tidak valid.' };
    }

    console.log('[Voucher] Matching voucher found:', JSON.stringify(voucher));

    // 3. Check status
    const status = String(voucher.status).toLowerCase();
    const isInactive = status === '0' || status === 'inactive' || status === 'disabled';
    if (isInactive) {
      return { valid: false, discountAmount: 0, message: 'Voucher sudah tidak aktif.' };
    }

    // 4. Check min purchase
    const minPurchase = Number(voucher.min_purchase || voucher.min_order || 0);
    if (totalAmount < minPurchase) {
      return { 
        valid: false, 
        discountAmount: 0, 
        message: `Minimal pembelian Rp ${minPurchase.toLocaleString('id-ID')}` 
      };
    }

    // 5. Calculate discount
    let discountAmount = 0;
    // Handle diff field names: discount_type (string), type (1=nominal, 2=percentage)
    const rawType = String(voucher.discount_type || voucher.type || '1');
    const type = (rawType === '1' || rawType === 'nominal') ? 'nominal' : 'percentage';
    
    const value = Number(voucher.discount_value || voucher.value || voucher.amount || 0);

    if (type === 'nominal') {
      discountAmount = value;
    } else {
      discountAmount = Math.floor(totalAmount * (value / 100));
    }

    // Cap discount at total amount
    discountAmount = Math.min(discountAmount, totalAmount);
    
    console.log(`[Voucher] Validation Success! Discount: ${discountAmount}`);

    return {
      valid: true,
      discountAmount,
      message: 'Voucher berhasil diterapkan!'
    };
  }
};
