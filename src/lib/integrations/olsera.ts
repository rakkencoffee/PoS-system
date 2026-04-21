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
  const formData = new URLSearchParams();
  formData.append('app_id', env.APP_ID);
  formData.append('secret_key', env.SECRET_KEY);
  formData.append('grant_type', 'secret_key');

  const res = await fetch(`${env.API_BASE}/api/open-api/v1/id/token`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Olsera auth failed: ${text}`);
  }

  const data = await res.json();
  const token = data.access_token || data.data?.access_token;

  if (!token) throw new Error('Olsera token missing in response');

  const newCache = { token, expiresAt: Date.now() + 3600_000 };
  try { fs.writeFileSync(TOKEN_CACHE_FILE, JSON.stringify(newCache)); } catch {}
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
  const { success, reset } = await olseraRatelimit.limit('global');
  if (!success) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000);
    throw new Error(`Olsera rate limit reached. Retry in ${retryAfter}s`);
  }

  const token = await getAccessToken();
  const env = getEnv();
  
  // Always bypass cache
  const separator = path.includes('?') ? '&' : '?';
  const url = `${env.API_BASE}/api/open-api/v1/en${path}${separator}_t=${Date.now()}`;

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
    console.error(`[Olsera API] Error ${res.status}: ${text}`);
    throw new Error(`Olsera error ${res.status}`);
  }

  return res.json();
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
  }
};
