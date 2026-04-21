# PLAN.MD — POS Coffee Shop (Next.js + Vercel)
> Dokumen perencanaan teknis lengkap untuk junior developer & AI model.
> Baca dari atas ke bawah sebelum menulis satu baris kode pun.

> **Arsitektur yang dipilih: Pilihan A — Olsera Native.**
> Olsera Backoffice adalah **satu-satunya** tempat mengelola produk, stok, dan CRM.
> PostgreSQL (Neon) hanya menyimpan data operasional POS: order, session, log, shift.
> Jangan pernah membuat UI admin produk di sistem ini — gunakan dashboard.olsera.co.id.

---

## Daftar Isi

1. [Gambaran Sistem](#1-gambaran-sistem)
2. [Data Ownership & Source of Truth](#2-data-ownership--source-of-truth)
3. [Konvensi & Aturan Wajib](#3-konvensi--aturan-wajib)
3. [Konvensi & Aturan Wajib](#3-konvensi--aturan-wajib)
4. [Struktur Folder](#4-struktur-folder)
5. [Layer 1 — Framework](#5-layer-1--framework-nextjs-14--typescript)
6. [Layer 2 — State Management](#6-layer-2--state-management)
7. [Layer 3 — UI Components](#7-layer-3--ui-components)
8. [Layer 4 — Offline & PWA](#8-layer-4--offline--pwa)
9. [Layer 5 — Backend / API Routes](#9-layer-5--backend--api-routes)
10. [Layer 6 — ORM](#10-layer-6--orm-prisma-v5)
11. [Layer 7 — Database](#11-layer-7--database-neon-postgresql)
12. [Layer 8 — Cache](#12-layer-8--cache-upstash-redis)
13. [Layer 9 — Queue / Background Jobs](#13-layer-9--queue--background-jobs-upstash-qstash)
14. [Layer 10 — Realtime](#14-layer-10--realtime-pusher-channels)
15. [Layer 11 — Auth](#15-layer-11--auth-authjs-v5)
16. [Layer 12 — Print Bridge](#16-layer-12--print-bridge-local-nodejs-agent)
17. [Layer 13 — Deployment](#17-layer-13--deployment-vercel-hobby)
18. [Layer 14 — Monitoring](#18-layer-14--monitoring-sentry--vercel-analytics)
19. [Integrasi Olsera API](#19-integrasi-olsera-api)
20. [Sistem 3 Tablet (A / B / C)](#20-sistem-3-tablet-a--b--c)
21. [Koneksi EDC](#21-koneksi-edc)
22. [Alur Order End-to-End](#22-alur-order-end-to-end)
23. [Skema Database](#23-skema-database)
24. [Environment Variables](#24-environment-variables)
25. [Urutan Implementasi (Sprint)](#25-urutan-implementasi-sprint)
26. [Checklist Pre-Launch](#26-checklist-pre-launch)

---

## 1. Gambaran Sistem

### Apa yang dibangun
Sistem POS (Point of Sale) berbasis web untuk coffee shop dengan:
- **3 tablet aktif** sebagai kasir (Station A, B, C)
- Setiap station punya prefix order ID sendiri: `#A001`, `#B001`, `#C001`
- Integrasi **EDC** untuk pembayaran kartu/QRIS
- **Cetak struk** otomatis via thermal printer setiap order selesai
- Integrasi **satu arah** dengan **Olsera**: produk/stok dibaca dari Olsera, transaksi di-push ke Olsera
- **Kitchen Display** realtime — order baru langsung muncul di layar dapur
- Offline-first: order tetap bisa diinput saat koneksi internet putus

### Topologi Hardware di Coffee Shop

```
[ Tablet A ]──┐
[ Tablet B ]──┼──(WiFi/LAN)──[ Router ]──[ Internet ]──[ Vercel + Neon + Upstash + Pusher ]
[ Tablet C ]──┘                   │
                                   │──[ PC Kasir ]──[ Thermal Printer (USB/LAN) ]
                                   │               └[ Print Bridge (localhost:3001) ]
                                   │
                                   └──[ EDC Machine ]──(Serial/TCP)──[ PC Kasir ]
                                   └──[ Kitchen Display ] (browser fullscreen, Pusher subscriber)
```

### Siapa yang mengakses sistem

| Role | Akses | Keterangan |
|---|---|---|
| `cashier` | `/pos/*` saja | Input order, proses bayar |
| `manager` | `/pos/*` + `/dashboard/*` | Lihat laporan, kelola shift |
| `kitchen` | `/kitchen` (read-only) | Display order, tandai selesai |
| `admin` | Semua route | Setup sistem, user management |

---

## 2. Data Ownership & Source of Truth

> Ini adalah keputusan arsitektur paling penting dalam sistem ini.
> Setiap developer **wajib** memahami tabel ini sebelum menulis kode apapun.

### Peta Kepemilikan Data

| Data | Pemilik (Source of Truth) | Sistem Kita | Arah Sync |
|---|---|---|---|
| Produk (nama, harga, SKU) | **Olsera Backoffice** | Read-only cache | Olsera → kita |
| Stok / inventory | **Olsera Backoffice** | Read-only cache | Olsera → kita |
| Kategori produk | **Olsera Backoffice** | Read-only cache | Olsera → kita |
| CRM pelanggan | **Olsera Backoffice** | Tidak disimpan | — |
| Loyalty point | **Olsera Backoffice** | Tidak disimpan | — |
| Laporan penjualan bisnis | **Olsera Backoffice** | Tidak disimpan | Kita → Olsera |
| Order (transaksi POS) | **PostgreSQL kita** | Source of truth | Kita → Olsera |
| Session kasir | **PostgreSQL kita** | Source of truth | Tidak sync |
| Shift log | **PostgreSQL kita** | Source of truth | Tidak sync |
| Audit log | **PostgreSQL kita** | Source of truth | Tidak sync |
| User / kasir | **PostgreSQL kita** | Source of truth | Tidak sync |

### Aturan Besi (Golden Rules)

```
RULE 1: Jangan pernah membuat CRUD produk di sistem kita.
        Semua kelola produk → login ke dashboardv2.olsera.co.id

RULE 2: product_cache di Neon adalah SNAPSHOT BACA SAJA dari Olsera.
        Tidak boleh ada Route Handler yang POST/PUT/DELETE ke tabel product_cache
        berdasarkan input user. Hanya job sync dari Olsera yang boleh menulis ke sana.

RULE 3: Stok di product_cache adalah stok optimistic sementara.
        Stok "sesungguhnya" ada di Olsera. Setelah push transaksi berhasil,
        Olsera yang menjadi referensi akhir stok.

RULE 4: Laporan pendapatan & analitik bisnis → buka di Olsera Backoffice.
        Dashboard kita hanya tampilkan ringkasan per-station untuk kebutuhan operasional
        kasir (misal: total penjualan shift hari ini Station A).

RULE 5: Jika ada konflik data antara Olsera dan PostgreSQL kita → Olsera yang menang.
```

### Visualisasi Aliran Data

```
                    ┌─────────────────────────────┐
                    │      OLSERA BACKOFFICE       │
                    │  (dashboardv2.olsera.co.id)  │
                    │                              │
                    │  ✓ Kelola produk & harga     │
                    │  ✓ Kelola stok               │
                    │  ✓ CRM pelanggan             │
                    │  ✓ Laporan bisnis            │
                    │  ✓ Loyalty point             │
                    └──────────┬──────────┬────────┘
                               │          │
              Sync produk      │          │  Terima transaksi
              (webhook/cron)   │          │  (QStash job)
                               ▼          ▲
                    ┌─────────────────────────────┐
                    │     SISTEM POS KITA          │
                    │  (Next.js + Neon + Vercel)  │
                    │                              │
                    │  ✓ Proses order #A001        │
                    │  ✓ Cache produk (5 menit)    │
                    │  ✓ Session kasir             │
                    │  ✓ Shift log                 │
                    │  ✗ TIDAK kelola produk       │
                    │  ✗ TIDAK kelola stok         │
                    │  ✗ TIDAK kelola CRM          │
                    └──────────────────────────────┘
```

### Anti-Pattern yang Dilarang

```typescript
// ❌ DILARANG: Update stok dari sistem kita secara langsung sebagai master
await prisma.productCache.update({
  where: { olseraId },
  data: { stock: newStock }, // Ini anti-pattern — stok bukan milik kita
});

// ❌ DILARANG: Buat endpoint POST /api/products untuk tambah produk baru
// Tambah produk → harus dari Olsera Backoffice

// ❌ DILARANG: Simpan data pelanggan/member dari sistem kita
// CRM → Olsera yang handle

// ✅ BENAR: Hanya update stok cache secara optimistic saat order dibuat
// dan biarkan Olsera menjadi referensi akhir via webhook/sync berikutnya
await tx.$executeRaw`
  UPDATE product_cache
  SET stock = stock - ${item.quantity},  -- optimistic deduction
      updated_at = NOW()
  WHERE olsera_id = ${item.olseraId}
`;
// Stok "real" akan dikoreksi saat Olsera kirim webhook stock.updated
```

---

## 3. Konvensi & Aturan Wajib

> **JANGAN** langsung coding sebelum membaca bagian ini.

### Penamaan File & Folder
- Semua file TypeScript: `kebab-case.ts` / `kebab-case.tsx`
- Semua komponen React: `PascalCase` di dalam file `kebab-case.tsx`
- Server Actions diawali kata kerja: `createOrder`, `updateStock`
- API Route Handler: selalu dalam folder, misal `app/api/orders/route.ts`

### Aturan TypeScript
```typescript
// WAJIB: selalu definisikan return type fungsi async
async function createOrder(data: CreateOrderInput): Promise<Order> { ... }

// WAJIB: gunakan Zod untuk validasi semua input API
import { z } from 'zod';
const OrderSchema = z.object({
  stationId: z.enum(['A', 'B', 'C']),
  items: z.array(z.object({
    olseraId: z.string(),
    quantity: z.number().int().positive(),
    price: z.number().positive(),
  })).min(1),
});

// DILARANG: any
// DILARANG: @ts-ignore tanpa komentar penjelasan
// DILARANG: console.log di production code — gunakan logger
```

### Aturan API Response
```typescript
// Selalu gunakan format ini untuk konsistensi
type ApiResponse<T> =
  | { success: true;  data: T }
  | { success: false; error: string; code?: string };

// Contoh penggunaan
return Response.json({ success: true, data: order });
return Response.json({ success: false, error: 'Stok habis', code: 'OUT_OF_STOCK' }, { status: 409 });
```

### Aturan Error Handling
- Setiap Route Handler wajib dibungkus `try/catch`
- Error wajib di-log ke Sentry sebelum return response
- Jangan expose detail error internal ke client (stack trace, SQL query, dsb.)

### Aturan Race Condition
- Setiap operasi yang ubah stok **wajib** pakai `prisma.$transaction` dengan `SELECT FOR UPDATE`
- Jangan pernah: read stock → check → write (tanpa transaction lock)
- Idempotency key wajib untuk semua payment endpoint

---

## 4. Struktur Folder

```
pos-coffeeshop/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx
│   ├── (pos)/
│   │   ├── layout.tsx              ← Auth guard, station context provider
│   │   ├── pos/
│   │   │   └── page.tsx            ← Main POS interface
│   │   ├── kitchen/
│   │   │   └── page.tsx            ← Kitchen display (baca Pusher)
│   │   └── dashboard/
│   │       ├── page.tsx            ← Ringkasan shift hari ini (per-station)
│   │       └── reports/
│   │           └── page.tsx        ← Laporan shift — BUKAN laporan bisnis
│   │                                 (laporan bisnis → Olsera Backoffice)
│   ├── api/
│   │   ├── auth/
│   │   │   └── [...nextauth]/
│   │   │       └── route.ts
│   │   ├── orders/
│   │   │   ├── route.ts            ← POST create order
│   │   │   └── [id]/
│   │   │       ├── route.ts        ← GET, PATCH order
│   │   │       └── status/
│   │   │           └── route.ts    ← PATCH order status
│   │   ├── products/
│   │   │   └── route.ts            ← GET ONLY — baca dari cache Olsera
│   │   │                             ⚠ Tidak ada POST/PUT/DELETE di sini
│   │   ├── payments/
│   │   │   ├── route.ts            ← POST initiate payment
│   │   │   └── callback/
│   │   │       └── route.ts        ← POST EDC/payment callback
│   │   ├── pusher/
│   │   │   └── auth/
│   │   │       └── route.ts        ← Pusher private channel auth
│   │   ├── webhooks/
│   │   │   └── olsera/
│   │   │       └── route.ts        ← Terima update produk/stok dari Olsera
│   │   └── jobs/
│   │       ├── push-olsera/
│   │       │   └── route.ts        ← QStash: push transaksi ke Olsera
│   │       └── sync-products/
│   │           └── route.ts        ← QStash: tarik produk terbaru dari Olsera
│   ├── layout.tsx
│   └── globals.css
│
├── components/
│   ├── pos/
│   │   ├── product-grid.tsx        ← Grid menu (data dari Olsera cache)
│   │   ├── order-cart.tsx          ← Sidebar cart kanan
│   │   ├── numpad.tsx              ← Numpad custom
│   │   ├── payment-modal.tsx       ← Modal pilih metode bayar
│   │   ├── receipt-preview.tsx     ← Preview struk sebelum print
│   │   └── station-badge.tsx       ← Badge "Station A" di header
│   ├── kitchen/
│   │   ├── order-card.tsx
│   │   └── order-grid.tsx
│   └── ui/                         ← shadcn/ui components (auto-generated)
│
├── lib/
│   ├── auth.ts                     ← Auth.js config
│   ├── db.ts                       ← Prisma client singleton
│   ├── neon.ts                     ← Neon serverless driver
│   ├── redis.ts                    ← Upstash Redis client
│   ├── qstash.ts                   ← Upstash QStash client
│   ├── pusher.ts                   ← Pusher server + client config
│   ├── olsera.ts                   ← Olsera API adapter (rate-limited)
│   ├── olsera-sync.ts              ← Fungsi sync produk Olsera → product_cache
│   ├── rate-limit.ts               ← Ratelimiter config
│   ├── order-id.ts                 ← Generator ID #A001, #B001, #C001
│   ├── print.ts                    ← HTTP client ke Print Bridge
│   └── logger.ts                   ← Pino logger (production-safe)
│
├── stores/
│   ├── cart.store.ts               ← Zustand: cart state
│   ├── ui.store.ts                 ← Zustand: modal, drawer, loading
│   └── station.store.ts            ← Zustand: station ID (A/B/C)
│
├── hooks/
│   ├── use-products.ts             ← TanStack Query: fetch dari /api/products
│   ├── use-orders.ts               ← TanStack Query: fetch orders
│   ├── use-kitchen-realtime.ts     ← Pusher subscription hook
│   └── use-offline-sync.ts         ← Dexie.js offline sync hook
│
├── types/
│   ├── order.ts
│   ├── product.ts                  ← Type OlseraProduct (shape dari API Olsera)
│   ├── payment.ts
│   └── station.ts
│
├── prisma/
│   └── schema.prisma
│
├── print-bridge/                   ← Repo/subfolder terpisah, jalan di PC kasir
│   ├── src/
│   │   └── index.ts
│   ├── package.json
│   └── ecosystem.config.js         ← PM2 config
│
├── middleware.ts                   ← Next.js middleware (auth guard)
├── instrumentation.ts              ← Sentry init
├── .env.local                      ← Jangan di-commit!
├── .env.example                    ← Template env (wajib di-commit)
└── vercel.json
```

---

## 4. Layer 1 — Framework (Next.js 14 + TypeScript)

### Setup Awal
```bash
npx create-next-app@latest pos-coffeeshop \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir=false \
  --import-alias="@/*"
```

### `vercel.json` — WAJIB ADA
```json
{
  "functions": {
    "app/api/**": {
      "maxDuration": 300
    }
  }
}
```

### `instrumentation.ts` — Sentry init (Next.js 14)
```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation.node');
  }
}
```

### Catatan Kritis
- **Fluid Compute** HARUS diaktifkan di Vercel Dashboard → Project Settings → Functions → Enable Fluid Compute
- Tanpa Fluid Compute, `maxDuration` max 10 detik di Hobby plan — semua API yang hit Olsera akan timeout
- App Router (`app/`) digunakan sepenuhnya — jangan campur dengan `pages/`
- Server Components untuk halaman statis/data fetching, Client Components untuk interaktivitas

---

## 5. Layer 2 — State Management

### Zustand — UI & Cart State
```bash
npm install zustand
```

**`stores/cart.store.ts`**
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CartItem {
  olseraId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
}

interface CartStore {
  items: CartItem[];
  stationId: 'A' | 'B' | 'C' | null;
  addItem: (product: CartItem) => void;
  removeItem: (olseraId: string) => void;
  updateQty: (olseraId: string, qty: number) => void;
  clearCart: () => void;
  total: () => number;
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      stationId: null,
      addItem: (product) => set((state) => {
        const existing = state.items.find(i => i.olseraId === product.olseraId);
        if (existing) {
          return {
            items: state.items.map(i =>
              i.olseraId === product.olseraId
                ? { ...i, quantity: i.quantity + 1 }
                : i
            )
          };
        }
        return { items: [...state.items, { ...product, quantity: 1 }] };
      }),
      removeItem: (olseraId) => set((state) => ({
        items: state.items.filter(i => i.olseraId !== olseraId)
      })),
      updateQty: (olseraId, qty) => set((state) => ({
        items: qty <= 0
          ? state.items.filter(i => i.olseraId !== olseraId)
          : state.items.map(i => i.olseraId === olseraId ? { ...i, quantity: qty } : i)
      })),
      clearCart: () => set({ items: [] }),
      total: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    }),
    { name: 'pos-cart' }
  )
);
```

**`stores/station.store.ts`**
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type StationId = 'A' | 'B' | 'C';

interface StationStore {
  stationId: StationId | null;
  setStation: (id: StationId) => void;
}

// Persistd ke localStorage — tablet ingat station-nya meski refresh
export const useStation = create<StationStore>()(
  persist(
    (set) => ({
      stationId: null,
      setStation: (id) => set({ stationId: id }),
    }),
    { name: 'pos-station' }
  )
);
```

### TanStack Query — Server State
```bash
npm install @tanstack/react-query @tanstack/react-query-devtools
```

```typescript
// hooks/use-products.ts
import { useQuery } from '@tanstack/react-query';

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const res = await fetch('/api/products');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    staleTime: 5 * 60 * 1000,     // 5 menit — cache produk Olsera
    gcTime:    10 * 60 * 1000,    // 10 menit di memory
    refetchOnWindowFocus: false,   // PENTING: jangan refetch saat tablet unlock
  });
}
```

---

## 6. Layer 3 — UI Components

### Setup shadcn/ui
```bash
npx shadcn@latest init
# Pilih: Default style, Zinc color, CSS variables: yes

# Install komponen yang dibutuhkan POS
npx shadcn@latest add dialog button input badge toast
npx shadcn@latest add command sheet separator scroll-area
```

### Komponen Kritis POS

**`components/pos/station-badge.tsx`**
```typescript
'use client';
import { useStation } from '@/stores/station.store';
import { Badge } from '@/components/ui/badge';

const STATION_COLORS = {
  A: 'bg-blue-100 text-blue-800 border-blue-200',
  B: 'bg-green-100 text-green-800 border-green-200',
  C: 'bg-amber-100 text-amber-800 border-amber-200',
};

export function StationBadge() {
  const { stationId } = useStation();
  if (!stationId) return null;
  return (
    <Badge className={STATION_COLORS[stationId]}>
      Station {stationId}
    </Badge>
  );
}
```

**`lib/order-id.ts`** — Generator Order ID
```typescript
// Format: #A001, #A002, ... #A999, #A1000 (tidak ada batas atas)
// Sequence disimpan di Redis per station per hari

import { redis } from './redis';

export async function generateOrderId(stationId: 'A' | 'B' | 'C'): Promise<string> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // 20251225
  const key = `order_seq:${stationId}:${today}`;

  // Increment atomic di Redis — aman untuk concurrent request
  const seq = await redis.incr(key);

  // TTL 2 hari agar sequence reset otomatis keesokan harinya
  if (seq === 1) {
    await redis.expire(key, 172800); // 48 jam
  }

  const padded = String(seq).padStart(3, '0');
  return `#${stationId}${padded}`; // #A001, #B023, #C100
}
```

---

## 7. Layer 4 — Offline & PWA

### Setup
```bash
npm install dexie dexie-react-hooks
npm install next-pwa
npm install -D workbox-webpack-plugin
```

### `lib/offline-db.ts`
```typescript
import Dexie, { Table } from 'dexie';

export interface PendingOrder {
  id?: number;
  tempOrderId: string;       // ID sementara sebelum dapat server ID
  stationId: 'A' | 'B' | 'C';
  items: any[];
  total: number;
  createdAt: Date;
  synced: boolean;
  syncAttempts: number;
}

export interface ProductCache {
  olseraId: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  imageUrl?: string;
  cachedAt: Date;
}

class PosDatabase extends Dexie {
  pendingOrders!: Table<PendingOrder, number>;
  productCache!: Table<ProductCache, string>;

  constructor() {
    super('pos_coffeeshop_db');
    this.version(1).stores({
      pendingOrders: '++id, tempOrderId, stationId, synced, createdAt',
      productCache:  'olseraId, name, category, cachedAt',
    });
  }
}

export const offlineDb = new PosDatabase();
```

### `hooks/use-offline-sync.ts`
```typescript
'use client';
import { useEffect } from 'react';
import { offlineDb } from '@/lib/offline-db';

export function useOfflineSync() {
  useEffect(() => {
    // Broadcast channel: detect online status dari tab lain
    const syncPending = async () => {
      if (!navigator.onLine) return;

      const pending = await offlineDb.pendingOrders
        .where('synced').equals(0)
        .and(o => o.syncAttempts < 5)
        .toArray();

      for (const order of pending) {
        try {
          const res = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...order, offline: true }),
          });
          if (res.ok) {
            await offlineDb.pendingOrders.update(order.id!, { synced: true });
          }
        } catch {
          await offlineDb.pendingOrders.update(order.id!, {
            syncAttempts: (order.syncAttempts || 0) + 1
          });
        }
      }
    };

    window.addEventListener('online', syncPending);
    syncPending(); // Coba sync saat komponen mount

    return () => window.removeEventListener('online', syncPending);
  }, []);
}
```

---

## 8. Layer 5 — Backend / API Routes

### Middleware Pattern (Pengganti NestJS Guards)

**`lib/api-helpers.ts`**
```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { ratelimit } from './rate-limit';
import { logger } from './logger';
import { NextRequest } from 'next/server';
import Sentry from '@sentry/nextjs';

type Handler = (req: NextRequest, ctx: { session: any }) => Promise<Response>;

// HOF: Wrap handler dengan auth + rate limit
export function withAuth(handler: Handler) {
  return async (req: NextRequest) => {
    try {
      // Auth check
      const session = await getServerSession(authOptions);
      if (!session) {
        return Response.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }

      // Rate limit per user (bukan per IP)
      const { success } = await ratelimit.limit(session.user.id);
      if (!success) {
        return Response.json(
          { success: false, error: 'Too many requests' },
          { status: 429 }
        );
      }

      return await handler(req, { session });
    } catch (err) {
      Sentry.captureException(err);
      logger.error({ err }, 'API handler error');
      return Response.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

// HOF: Tambahan check role
export function withRole(roles: string[], handler: Handler) {
  return withAuth(async (req, ctx) => {
    if (!roles.includes(ctx.session.user.role)) {
      return Response.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }
    return handler(req, ctx);
  });
}
```

### Contoh Route Handler

**`app/api/orders/route.ts`**
```typescript
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api-helpers';
import { prisma } from '@/lib/db';
import { generateOrderId } from '@/lib/order-id';
import { pusherServer } from '@/lib/pusher';
import { qstash } from '@/lib/qstash';

export const maxDuration = 300;

const CreateOrderSchema = z.object({
  stationId: z.enum(['A', 'B', 'C']),
  items: z.array(z.object({
    olseraId: z.string(),
    name: z.string(),
    price: z.number().positive(),
    quantity: z.number().int().positive(),
    notes: z.string().optional(),
  })).min(1),
  tableNumber: z.string().optional(),
  offline: z.boolean().default(false),
});

export const POST = withAuth(async (req, { session }) => {
  const body = await req.json();
  const parsed = CreateOrderSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { success: false, error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { stationId, items, tableNumber } = parsed.data;
  const orderId = await generateOrderId(stationId);
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);

  // Buat order dengan race condition protection
  const order = await prisma.$transaction(async (tx) => {
    // Lock product rows untuk cek stok
    for (const item of items) {
      const product = await tx.$queryRaw<{ stock: number }[]>`
        SELECT stock FROM product_cache
        WHERE olsera_id = ${item.olseraId}
        FOR UPDATE
      `;
      if (!product[0] || product[0].stock < item.quantity) {
        throw new Error(`Stok ${item.name} tidak cukup`);
      }
    }

    // Buat order
    const newOrder = await tx.order.create({
      data: {
        id: orderId,
        stationId,
        cashierId: session.user.id,
        tableNumber,
        total,
        status: 'PENDING',
        items: {
          create: items.map(i => ({
            olseraId: i.olseraId,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
            notes: i.notes,
          }))
        }
      },
      include: { items: true }
    });

    // Update stock cache lokal
    for (const item of items) {
      await tx.$executeRaw`
        UPDATE product_cache
        SET stock = stock - ${item.quantity}
        WHERE olsera_id = ${item.olseraId}
      `;
    }

    return newOrder;
  });

  // Trigger kitchen display via Pusher (fire & forget)
  pusherServer.trigger('kitchen-channel', 'new-order', {
    orderId,
    stationId,
    tableNumber,
    items,
    total,
    timestamp: Date.now(),
  }).catch(err => console.error('Pusher error:', err));

  // Queue job: sync transaksi ke Olsera (async, dengan retry)
  await qstash.publishJSON({
    url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/jobs/push-olsera`,
    body: { orderId },
    retries: 5,
    delay: 2,
  });

  return Response.json({ success: true, data: order }, { status: 201 });
});
```

---

## 9. Layer 6 — ORM (Prisma v5)

### Setup
```bash
npm install prisma @prisma/client
npm install @neondatabase/serverless
npx prisma init
```

### `lib/db.ts` — Singleton Pattern (Wajib di Serverless)
```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

### Catatan Kritis
- Gunakan `DIRECT_DATABASE_URL` untuk `prisma migrate deploy` (direct connection)
- Gunakan `DATABASE_URL` (pooled) untuk semua query runtime
- Jangan import `PrismaClient` langsung — selalu import `prisma` dari `lib/db.ts`

---

## 10. Layer 7 — Database (Neon PostgreSQL)

### Setup
1. Daftar di [neon.tech](https://neon.tech) — tanpa kartu kredit
2. Buat project baru: `pos-coffeeshop`
3. Salin **dua** connection string: Connection pooling URL + Direct URL

### Strategi Storage (0.5 GB limit)
```
Estimasi per bulan (1 outlet, 200 order/hari):
- 1 order           ≈ 1 KB (header + 5 items)
- 200 order/hari    ≈ 200 KB
- 30 hari           ≈ 6 MB/bulan
- 12 bulan          ≈ 72 MB → AMAN dalam 0.5 GB

Strategi arsip wajib setelah 6 bulan:
- Ekspor order lama ke CSV (download dari Neon console)
- Hapus order > 180 hari: DELETE FROM orders WHERE created_at < NOW() - INTERVAL '180 days'
```

### `lib/neon.ts` — Driver Cepat untuk Query Produk
```typescript
import { neon } from '@neondatabase/serverless';

// Gunakan driver HTTP untuk query yang latency-sensitif
// Lebih toleran terhadap cold start daripada Prisma TCP
export const sql = neon(process.env.DATABASE_URL!);
```

---

## 11. Layer 8 — Cache (Upstash Redis)

### Setup
1. Daftar di [upstash.com](https://upstash.com) — tanpa kartu kredit
2. Buat database Redis: `pos-cache`
3. Pilih region: Singapore (ap-southeast-1)

### `lib/redis.ts`
```typescript
import { Redis } from '@upstash/redis';

export const redis = Redis.fromEnv();
// Otomatis pakai UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN dari env
```

### `lib/rate-limit.ts`
```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { redis } from './redis';

// Rate limiter untuk Olsera API (max 10 req/10 detik)
export const olseraRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '10 s'),
  prefix: 'olsera',
});

// Rate limiter untuk API internal (max 50 req/menit per user)
export const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(50, '1 m'),
  prefix: 'api',
});
```

### Strategi Cache Produk Olsera
```typescript
// Simpan produk dari Olsera di Redis selama 5 menit
// Key: products:all | products:category:{id}
const PRODUCT_TTL = 300; // 5 menit

async function getCachedProducts() {
  const cached = await redis.get<Product[]>('products:all');
  if (cached) return cached;

  const products = await olseraApi.getProducts();
  await redis.setex('products:all', PRODUCT_TTL, products);
  return products;
}

// Invalidate cache saat ada webhook update produk dari Olsera
async function invalidateProductCache() {
  await redis.del('products:all');
}
```

---

## 12. Layer 9 — Queue / Background Jobs (Upstash QStash)

### Setup
```bash
npm install @upstash/qstash
```

### `lib/qstash.ts`
```typescript
import { Client } from '@upstash/qstash';

export const qstash = new Client({
  token: process.env.QSTASH_TOKEN!,
});
```

### Pattern Job Handler — Wajib Verifikasi Signature

```typescript
// app/api/jobs/push-olsera/route.ts
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { olseraApi } from '@/lib/olsera';
import { prisma } from '@/lib/db';

export const maxDuration = 300;

async function handler(req: Request) {
  const { orderId } = await req.json();

  // Fetch order dari DB
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) {
    // Return 200 agar QStash tidak retry — order sudah tidak ada
    return Response.json({ success: true, skipped: true });
  }

  if (order.olseraSynced) {
    // Idempotency: sudah pernah di-push, skip
    return Response.json({ success: true, alreadySynced: true });
  }

  // Push ke Olsera
  await olseraApi.createTransaction({
    items: order.items.map(i => ({
      product_id: i.olseraId,
      qty: i.quantity,
      price: i.price,
    })),
    total: order.total,
    station_ref: order.id,
  });

  // Tandai sudah di-sync
  await prisma.order.update({
    where: { id: orderId },
    data: { olseraSynced: true, olseraSyncedAt: new Date() },
  });

  return Response.json({ success: true });
}

// Verifikasi signature QStash — JANGAN HAPUS
export const POST = verifySignatureAppRouter(handler);
```

---

## 13. Layer 10 — Realtime (Pusher Channels)

### Setup
1. Daftar di [pusher.com](https://pusher.com)
2. Buat app baru: `pos-coffeeshop`
3. Pilih cluster: `ap1` (Singapore) — PENTING untuk latensi rendah dari Indonesia

```bash
npm install pusher pusher-js
```

### `lib/pusher.ts`
```typescript
import Pusher from 'pusher';
import PusherClient from 'pusher-js';

// Server-side (untuk trigger events)
export const pusherServer = new Pusher({
  appId:   process.env.PUSHER_APP_ID!,
  key:     process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret:  process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS:  true,
});

// Client-side (singleton)
let pusherClientInstance: PusherClient | null = null;

export function getPusherClient(): PusherClient {
  if (!pusherClientInstance) {
    pusherClientInstance = new PusherClient(
      process.env.NEXT_PUBLIC_PUSHER_KEY!,
      { cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER! }
    );
  }
  return pusherClientInstance;
}
```

### Channel Design
```
Channel: kitchen-channel           → Kitchen display subscribe
Channel: station-a-channel         → Notifikasi khusus Station A
Channel: station-b-channel         → Notifikasi khusus Station B
Channel: station-c-channel         → Notifikasi khusus Station C

Events per channel:
  new-order       → Order baru masuk (ke kitchen-channel)
  order-ready     → Order siap diambil (ke station-{X}-channel)
  payment-done    → Pembayaran berhasil (ke station-{X}-channel)
  stock-low       → Stok menipis (ke semua station)
```

### `hooks/use-kitchen-realtime.ts`
```typescript
'use client';
import { useEffect, useState } from 'react';
import { getPusherClient } from '@/lib/pusher';

export interface KitchenOrder {
  orderId: string;
  stationId: 'A' | 'B' | 'C';
  items: any[];
  timestamp: number;
}

export function useKitchenRealtime() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);

  useEffect(() => {
    const pusher = getPusherClient();
    const channel = pusher.subscribe('kitchen-channel');

    channel.bind('new-order', (data: KitchenOrder) => {
      setOrders(prev => [data, ...prev].slice(0, 50)); // max 50 order tampil
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe('kitchen-channel');
    };
  }, []);

  const markDone = (orderId: string) => {
    setOrders(prev => prev.filter(o => o.orderId !== orderId));
  };

  return { orders, markDone };
}
```

---

## 14. Layer 11 — Auth (Auth.js v5)

### Setup
```bash
npm install next-auth@beta
npx auth secret  # Generate AUTH_SECRET otomatis
```

### `lib/auth.ts`
```typescript
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { prisma } from './db';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const LoginSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = LoginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { username: parsed.data.username },
        });

        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          role: user.role,
          stationId: user.defaultStationId,
        };
      }
    })
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.stationId = user.stationId;
      }
      return token;
    },
    session({ session, token }) {
      session.user.role = token.role as string;
      session.user.stationId = token.stationId as string;
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error:  '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 jam = 1 shift kasir
  },
});
```

### `middleware.ts` — Route Protection
```typescript
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Redirect ke login jika belum auth
  if (!session && pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Role guard: dashboard hanya untuk manager ke atas
  if (pathname.startsWith('/dashboard') && session?.user.role === 'cashier') {
    return NextResponse.redirect(new URL('/pos', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next|api/auth|favicon.ico|.*\\.png$).*)'],
};
```

---

## 15. Layer 12 — Print Bridge (Local Node.js Agent)

### Overview
Print Bridge adalah program terpisah yang **jalan di PC kasir**, bukan di cloud. Program ini expose HTTP server di `localhost:3001`. Web POS browser kirim perintah print via `fetch('http://localhost:3001/print', ...)`.

### Setup Print Bridge (Folder `print-bridge/`)
```bash
# Inisialisasi di folder terpisah
mkdir print-bridge && cd print-bridge
npm init -y
npm install express node-thermal-printer cors
npm install -D typescript ts-node @types/node @types/express
npm install -g pm2
```

### `print-bridge/src/index.ts`
```typescript
import express from 'express';
import cors from 'cors';
import {
  ThermalPrinter,
  PrinterTypes,
  CharacterSet,
} from 'node-thermal-printer';

const app = express();
app.use(express.json());

// Hanya izinkan akses dari localhost
app.use(cors({
  origin: ['http://localhost:3000', 'https://pos-coffeeshop.vercel.app'],
}));

const printer = new ThermalPrinter({
  type: PrinterTypes.EPSON,
  interface: process.env.PRINTER_INTERFACE || 'tcp://192.168.1.100', // atau 'usb' untuk USB langsung
  characterSet: CharacterSet.PC852_LATIN2,
  removeSpecialCharacters: false,
  lineCharacter: '-',
  options: { timeout: 5000 },
});

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  notes?: string;
}

interface PrintPayload {
  orderId: string;        // #A001
  stationId: string;      // A
  items: OrderItem[];
  total: number;
  paymentMethod: string;
  cashReceived?: number;
  change?: number;
  tableNumber?: string;
  cashierName: string;
  timestamp: string;
}

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID').format(amount);
}

app.post('/print', async (req, res) => {
  const data: PrintPayload = req.body;

  try {
    printer.clear();

    // Header
    printer.alignCenter();
    printer.setTextSize(1, 1);
    printer.bold(true);
    printer.println('COFFEE SHOP');
    printer.bold(false);
    printer.setTextNormal();
    printer.println('Jl. Contoh No. 1, Surabaya');
    printer.println('Telp: 031-1234567');
    printer.drawLine();

    // Info order
    printer.alignLeft();
    printer.println(`Order  : ${data.orderId}`);
    printer.println(`Station: ${data.stationId}`);
    if (data.tableNumber) printer.println(`Meja   : ${data.tableNumber}`);
    printer.println(`Kasir  : ${data.cashierName}`);
    printer.println(`Waktu  : ${new Date(data.timestamp).toLocaleString('id-ID')}`);
    printer.drawLine();

    // Items
    printer.bold(true);
    printer.leftRight('Item', 'Harga');
    printer.bold(false);
    printer.drawLine();

    for (const item of data.items) {
      printer.println(`${item.name}`);
      if (item.notes) printer.println(`  *${item.notes}`);
      printer.leftRight(
        `  ${item.quantity}x ${formatRupiah(item.price)}`,
        `Rp ${formatRupiah(item.price * item.quantity)}`
      );
    }

    printer.drawLine();

    // Total
    printer.bold(true);
    printer.leftRight('TOTAL', `Rp ${formatRupiah(data.total)}`);
    printer.bold(false);

    // Pembayaran
    printer.println(`Metode : ${data.paymentMethod}`);
    if (data.cashReceived) {
      printer.leftRight('Bayar', `Rp ${formatRupiah(data.cashReceived)}`);
      printer.leftRight('Kembali', `Rp ${formatRupiah(data.change || 0)}`);
    }

    printer.drawLine();

    // Footer
    printer.alignCenter();
    printer.println('Terima kasih!');
    printer.println('Selamat menikmati :)');
    printer.cut();

    await printer.execute();
    res.json({ success: true });
  } catch (error: any) {
    console.error('Print error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/health', (_, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Print Bridge running on http://localhost:${PORT}`);
});
```

### `print-bridge/ecosystem.config.js` — PM2
```javascript
module.exports = {
  apps: [{
    name: 'print-bridge',
    script: 'src/index.ts',
    interpreter: 'ts-node',
    env: {
      NODE_ENV: 'production',
      PRINTER_INTERFACE: 'tcp://192.168.1.100', // Ganti IP printer
      PORT: 3001,
    },
    watch: false,
    restart_delay: 3000,
    max_restarts: 10,
  }]
};
```

### Cara Jalankan di PC Kasir
```bash
cd print-bridge
pm2 start ecosystem.config.js
pm2 save          # Auto-start saat Windows/Linux reboot
pm2 startup       # Generate startup script
```

### `lib/print.ts` — Client di Next.js
```typescript
interface PrintOrderData {
  orderId: string;
  items: any[];
  total: number;
  paymentMethod: string;
  cashierName: string;
  // ... field lainnya
}

const PRINT_BRIDGE_URL = 'http://localhost:3001';

export async function printReceipt(data: PrintOrderData): Promise<boolean> {
  try {
    // Cek dulu apakah print bridge aktif
    const health = await fetch(`${PRINT_BRIDGE_URL}/health`, {
      signal: AbortSignal.timeout(2000), // timeout 2 detik
    });
    if (!health.ok) return false;

    const res = await fetch(`${PRINT_BRIDGE_URL}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(10000), // timeout 10 detik
    });

    return res.ok;
  } catch {
    // Print bridge offline — order tetap berhasil, hanya tidak bisa print
    console.warn('Print bridge tidak tersedia');
    return false;
  }
}
```

---

## 16. Layer 13 — Deployment (Vercel Hobby)

### Setup Pertama Kali
1. Push repo ke GitHub
2. Buka [vercel.com](https://vercel.com) → Import Project
3. Framework preset: **Next.js** (auto-detected)
4. Tambah semua Environment Variables (lihat Bagian 23)
5. Deploy

### Konfigurasi WAJIB Setelah Deploy
```
Vercel Dashboard → Project → Settings → Functions
→ Enable Fluid Compute: ON   ← WAJIB
→ Max Duration: 300 seconds
```

### `vercel.json`
```json
{
  "functions": {
    "app/api/**": {
      "maxDuration": 300
    }
  },
  "headers": [
    {
      "source": "/api/jobs/(.*)",
      "headers": [
        {
          "key": "x-robots-tag",
          "value": "noindex"
        }
      ]
    }
  ]
}
```

### Preview Deployment
- Setiap push ke branch non-main otomatis dapat preview URL unik
- Preview URL bagus untuk testing sebelum merge ke `main`
- **Jangan** test payment atau push Olsera dari preview URL — gunakan env var berbeda

---

## 17. Layer 14 — Monitoring (Sentry + Vercel Analytics)

### Sentry Setup
```bash
npx @sentry/wizard@latest -i nextjs
```

### `instrumentation.ts`
```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { init } = await import('@sentry/nextjs');
    init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.1,        // Sample 10% saja agar tidak habis kuota
      profilesSampleRate: 0.05,
      ignoreErrors: [
        /^4\d{2}/,                  // Skip semua 4xx error
        'AbortError',               // Skip browser abort
        'ChunkLoadError',           // Skip chunk load browser error
      ],
      beforeSend(event) {
        // Hapus data sensitif sebelum kirim ke Sentry
        if (event.request?.data) {
          delete event.request.data.password;
          delete event.request.data.cardNumber;
        }
        return event;
      },
    });
  }
}
```

### Custom Error Boundary untuk POS
```typescript
// Setiap page POS wajib punya error boundary
// app/(pos)/pos/error.tsx
'use client';
export default function POSError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4">
      <h2 className="text-xl font-medium">Terjadi kesalahan</h2>
      <p className="text-muted-foreground">{error.message}</p>
      <button onClick={reset}>Coba lagi</button>
    </div>
  );
}
```

---

## 19. Integrasi Olsera API

> **Konteks arsitektur**: Olsera adalah **master data** untuk semua hal yang berhubungan dengan produk, stok, dan laporan bisnis. Sistem kita hanyalah **consumer** data Olsera, bukan pemiliknya.

### Prinsip Integrasi

```
Olsera → Kita : Produk & stok (webhook atau cron sync)
Kita → Olsera : Transaksi order setelah pembayaran selesai (QStash job)

Tidak ada arah lain. Tidak ada sinkronisasi stok dari kita ke Olsera.
```

### `lib/olsera.ts` — Adapter dengan Rate Limit

```typescript
import { olseraRatelimit } from './rate-limit';
import { redis } from './redis';

const OLSERA_BASE = 'https://api.olsera.co.id/v1';
const PRODUCT_CACHE_TTL_REDIS = 300;  // 5 menit di Redis (L1 cache)

async function olseraFetch(path: string, options?: RequestInit) {
  // Rate limit sebelum setiap hit ke Olsera API
  const { success, reset } = await olseraRatelimit.limit('global');
  if (!success) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000);
    throw new Error(`Olsera rate limit. Retry in ${retryAfter}s`);
  }

  const res = await fetch(`${OLSERA_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${process.env.OLSERA_API_TOKEN}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Olsera ${res.status}: ${body}`);
  }

  return res.json();
}

export const olseraApi = {
  /**
   * Ambil semua produk aktif dari Olsera.
   * Hasil di-cache di Redis 5 menit (L1) dan di product_cache Neon (L2).
   * JANGAN panggil ini langsung dari Route Handler — gunakan /api/products
   * yang sudah handle cache dua lapis.
   */
  async getProducts(): Promise<OlseraProduct[]> {
    return olseraFetch('/products?active=true&limit=500');
  },

  /**
   * Ambil stok terkini satu produk.
   * Dipanggil oleh webhook handler setelah Olsera kirim stock.updated.
   */
  async getProductStock(olseraProductId: string): Promise<number> {
    const data = await olseraFetch(`/products/${olseraProductId}/stock`);
    return data.stock;
  },

  /**
   * Push transaksi order ke Olsera setelah pembayaran berhasil.
   * Olsera akan otomatis memotong stok dari sisi mereka.
   * station_ref diisi dengan Order ID kita (#A001) untuk traceability.
   */
  async createTransaction(payload: {
    items: { product_id: string; qty: number; price: number }[];
    total: number;
    payment_method: string;
    station_ref: string;   // Order ID: #A001, #B023, dll
    cashier_note?: string;
  }): Promise<{ olsera_transaction_id: string }> {
    return olseraFetch('/transactions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
```

### `lib/olsera-sync.ts` — Fungsi Sync Produk ke Local Cache

```typescript
import { olseraApi } from './olsera';
import { prisma } from './db';
import { redis } from './redis';
import { logger } from './logger';

export interface OlseraProduct {
  id: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  category_name: string;
  image_url?: string;
  is_active: boolean;
}

/**
 * Tarik semua produk dari Olsera dan upsert ke product_cache Neon.
 * Dipanggil oleh:
 * - QStash cron job setiap 5 menit (POST /api/jobs/sync-products)
 * - Webhook handler saat ada product.created / product.updated dari Olsera
 */
export async function syncProductsFromOlsera(): Promise<{
  synced: number;
  deactivated: number;
}> {
  logger.info('Starting Olsera product sync');

  const olseraProducts = await olseraApi.getProducts();

  // Upsert ke Neon — ini satu-satunya tempat yang boleh tulis ke product_cache
  const upsertOps = olseraProducts.map(p =>
    prisma.productCache.upsert({
      where: { olseraId: p.id },
      update: {
        name: p.name,
        description: p.description,
        price: p.price,
        stock: p.stock,
        category: p.category_name,
        imageUrl: p.image_url,
        isActive: p.is_active,
        cachedAt: new Date(),
      },
      create: {
        olseraId: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        stock: p.stock,
        category: p.category_name,
        imageUrl: p.image_url,
        isActive: p.is_active,
      },
    })
  );

  await prisma.$transaction(upsertOps);

  // Deactivate produk yang sudah tidak ada di Olsera
  const activeIds = olseraProducts.map(p => p.id);
  const deactivated = await prisma.productCache.updateMany({
    where: { olseraId: { notIn: activeIds }, isActive: true },
    data: { isActive: false },
  });

  // Invalidate Redis cache agar POS langsung dapat data terbaru
  await redis.del('olsera:products');

  logger.info({ synced: olseraProducts.length, deactivated: deactivated.count }, 'Olsera sync complete');

  return { synced: olseraProducts.length, deactivated: deactivated.count };
}

/**
 * Update stok SATU produk dari Olsera.
 * Dipanggil oleh webhook handler saat event stock.updated.
 * Ini adalah koreksi stok "real" dari Olsera setelah kita lakukan optimistic deduction.
 */
export async function syncStockFromOlsera(olseraProductId: string): Promise<void> {
  const realStock = await olseraApi.getProductStock(olseraProductId);

  await prisma.productCache.update({
    where: { olseraId: olseraProductId },
    data: { stock: realStock, cachedAt: new Date() },
  });

  // Invalidate Redis untuk produk ini
  await redis.del('olsera:products');

  logger.info({ olseraProductId, realStock }, 'Stock corrected from Olsera');
}
```

### `app/api/products/route.ts` — Endpoint Baca Produk (GET Only)

```typescript
import { withAuth } from '@/lib/api-helpers';
import { redis } from '@/lib/redis';
import { sql } from '@/lib/neon';

export const maxDuration = 30;

// ⚠ Endpoint ini GET-ONLY. Tidak ada POST/PUT/DELETE.
// Kelola produk → Olsera Backoffice (dashboardv2.olsera.co.id)

export const GET = withAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');

  // L1 Cache: Redis (5 menit)
  const cacheKey = category ? `olsera:products:${category}` : 'olsera:products';
  const cached = await redis.get<any[]>(cacheKey);
  if (cached) {
    return Response.json({ success: true, data: cached, source: 'redis' });
  }

  // L2 Cache: Neon product_cache (data dari last sync Olsera)
  const products = category
    ? await sql`SELECT * FROM product_cache WHERE category = ${category} AND is_active = true ORDER BY name`
    : await sql`SELECT * FROM product_cache WHERE is_active = true ORDER BY category, name`;

  // Simpan ke Redis 5 menit
  await redis.setex(cacheKey, 300, products);

  return Response.json({ success: true, data: products, source: 'neon' });
});
```

### `app/api/webhooks/olsera/route.ts` — Terima Update dari Olsera

```typescript
import { syncProductsFromOlsera, syncStockFromOlsera } from '@/lib/olsera-sync';
import { logger } from '@/lib/logger';
import crypto from 'crypto';

export const maxDuration = 60;

function verifyOlseraSignature(payload: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = crypto
    .createHmac('sha256', process.env.OLSERA_WEBHOOK_SECRET!)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-olsera-signature');

  if (!verifyOlseraSignature(rawBody, signature)) {
    logger.warn('Olsera webhook: invalid signature');
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = JSON.parse(rawBody);
  logger.info({ eventType: event.type }, 'Olsera webhook received');

  try {
    switch (event.type) {
      case 'product.created':
      case 'product.updated':
      case 'product.deleted':
        // Satu produk berubah → sync seluruh produk agar konsisten
        await syncProductsFromOlsera();
        break;

      case 'stock.updated':
        // Update stok satu produk saja — lebih efisien dari sync penuh
        await syncStockFromOlsera(event.data.product_id);
        break;

      default:
        logger.info({ eventType: event.type }, 'Olsera webhook: unhandled event type');
    }

    return Response.json({ received: true });
  } catch (err) {
    logger.error({ err, eventType: event.type }, 'Olsera webhook processing failed');
    // Return 500 agar Olsera retry webhook-nya
    return Response.json({ error: 'Processing failed' }, { status: 500 });
  }
}
```

### `app/api/jobs/sync-products/route.ts` — Cron Sync (QStash)

```typescript
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { syncProductsFromOlsera } from '@/lib/olsera-sync';

export const maxDuration = 60;

// QStash memanggil endpoint ini setiap 5 menit sebagai fallback
// jika webhook Olsera tidak terkirim (network issue, dll)
async function handler(req: Request) {
  const result = await syncProductsFromOlsera();
  return Response.json({ success: true, ...result });
}

export const POST = verifySignatureAppRouter(handler);
```

### `app/api/jobs/push-olsera/route.ts` — Push Transaksi ke Olsera

```typescript
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { olseraApi } from '@/lib/olsera';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export const maxDuration = 120;

async function handler(req: Request) {
  const { orderId } = await req.json();

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) {
    // Return 200 agar QStash tidak retry — order tidak ada
    return Response.json({ success: true, skipped: 'order_not_found' });
  }

  if (order.olseraSynced) {
    // Idempotency — sudah pernah di-push sebelumnya, skip
    return Response.json({ success: true, skipped: 'already_synced' });
  }

  if (order.status !== 'PAID' && order.status !== 'COMPLETED') {
    // Hanya push order yang sudah dibayar
    return Response.json({ success: true, skipped: 'not_paid' });
  }

  try {
    const result = await olseraApi.createTransaction({
      items: order.items.map(i => ({
        product_id: i.olseraId,
        qty: i.quantity,
        price: i.price,
      })),
      total: order.total,
      payment_method: order.paymentMethod || 'CASH',
      station_ref: order.id,  // #A001 — untuk traceability di Olsera
    });

    // Catat bahwa transaksi sudah masuk ke Olsera
    await prisma.order.update({
      where: { id: orderId },
      data: {
        olseraSynced: true,
        olseraSyncedAt: new Date(),
        olseraTransactionId: result.olsera_transaction_id,
      },
    });

    logger.info({ orderId, olseraTransactionId: result.olsera_transaction_id }, 'Order pushed to Olsera');
    return Response.json({ success: true, olseraTransactionId: result.olsera_transaction_id });

  } catch (err: any) {
    logger.error({ err, orderId }, 'Failed to push order to Olsera');
    // Return 500 → QStash akan retry dengan exponential backoff
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}

export const POST = verifySignatureAppRouter(handler);
```

### Setup Cron Job di QStash (Sync Produk Setiap 5 Menit)

```typescript
// Jalankan sekali saat setup — atau set via Upstash Console
// Cukup jalankan script ini sekali untuk mendaftarkan cron

import { Client } from '@upstash/qstash';
const client = new Client({ token: process.env.QSTASH_TOKEN! });

await client.schedules.create({
  destination: `${process.env.NEXT_PUBLIC_BASE_URL}/api/jobs/sync-products`,
  cron: '*/5 * * * *',  // Setiap 5 menit
});
```

### Konfigurasi di Olsera Backoffice

Setelah deploy, tambahkan webhook URL di Olsera Backoffice:
```
Menu: Settings → Webhook / API Integration
Webhook URL: https://your-project.vercel.app/api/webhooks/olsera
Events yang dicentang:
  ✓ product.created
  ✓ product.updated
  ✓ product.deleted
  ✓ stock.updated
```

---

## 19. Sistem 3 Tablet (A / B / C)

### Konsep

Setiap tablet adalah browser yang membuka URL yang sama (`/pos`). Pembeda antar tablet adalah `stationId` yang tersimpan di `localStorage` via Zustand persist.

### Setup Station Pertama Kali

Saat kasir login, sistem akan prompt untuk memilih station jika belum ada:

```typescript
// app/(pos)/pos/page.tsx
'use client';
import { useStation } from '@/stores/station.store';
import { StationSelect } from '@/components/pos/station-select';

export default function POSPage() {
  const { stationId, setStation } = useStation();

  if (!stationId) {
    return <StationSelect onSelect={setStation} />;
  }

  return <POSInterface stationId={stationId} />;
}
```

```typescript
// components/pos/station-select.tsx
'use client';
type StationId = 'A' | 'B' | 'C';

export function StationSelect({ onSelect }: { onSelect: (id: StationId) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-screen gap-6">
      <h1 className="text-2xl font-medium">Pilih Station</h1>
      <div className="flex gap-4">
        {(['A', 'B', 'C'] as StationId[]).map(id => (
          <button
            key={id}
            onClick={() => onSelect(id)}
            className="w-24 h-24 text-4xl font-bold rounded-xl border-2 hover:bg-accent"
          >
            {id}
          </button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        Pilih station sesuai tablet ini. Tidak bisa diubah setelah dipilih.
      </p>
    </div>
  );
}
```

### Order ID Generation per Station

| Station | Format | Contoh hari ini |
|---------|--------|-----------------|
| A | `#A` + sequence 3 digit | `#A001`, `#A002`, ..., `#A999` |
| B | `#B` + sequence 3 digit | `#B001`, `#B002`, ..., `#B999` |
| C | `#C` + sequence 3 digit | `#C001`, `#C002`, ..., `#C999` |

Sequence reset otomatis setiap hari (TTL Redis 48 jam).

### Isolasi Data per Station

Setiap cart state di Zustand ter-isolasi per browser tab/tablet karena menggunakan `localStorage`. Station A tidak bisa "melihat" cart Station B.

Untuk laporan, filter berdasarkan `stationId`:
```typescript
// Laporan harian per station
const ordersA = await prisma.order.findMany({
  where: {
    stationId: 'A',
    createdAt: { gte: startOfDay, lte: endOfDay },
  }
});
```

---

## 20. Koneksi EDC

### Arsitektur

```
Web POS (browser) → fetch POST /api/payments → Route Handler
                                                    ↓
                              Print Bridge (localhost:3001)
                                                    ↓
                                      EDC machine (TCP/Serial)
```

EDC dijangkau via Print Bridge — bukan langsung dari browser. Print Bridge yang berbicara dengan EDC melalui koneksi lokal (TCP atau Serial port).

### `print-bridge/src/edc.ts`
```typescript
import net from 'net';

const EDC_HOST = process.env.EDC_HOST || '192.168.1.200';
const EDC_PORT = parseInt(process.env.EDC_PORT || '8080');

export async function requestEDCPayment(amount: number): Promise<{
  success: boolean;
  transactionId?: string;
  cardType?: string;
  message: string;
}> {
  return new Promise((resolve) => {
    const client = new net.Socket();
    const timeout = setTimeout(() => {
      client.destroy();
      resolve({ success: false, message: 'EDC timeout' });
    }, 60000); // 60 detik untuk proses kartu

    client.connect(EDC_PORT, EDC_HOST, () => {
      // Format perintah sesuai spesifikasi EDC Anda
      // Contoh untuk EDC generik (sesuaikan dengan manual EDC)
      const payload = Buffer.from(
        JSON.stringify({ action: 'SALE', amount, currency: 'IDR' })
      );
      client.write(payload);
    });

    client.on('data', (data) => {
      clearTimeout(timeout);
      client.destroy();
      try {
        const response = JSON.parse(data.toString());
        resolve({
          success: response.status === 'APPROVED',
          transactionId: response.transaction_id,
          cardType: response.card_type,
          message: response.message,
        });
      } catch {
        resolve({ success: false, message: 'Invalid EDC response' });
      }
    });

    client.on('error', (err) => {
      clearTimeout(timeout);
      resolve({ success: false, message: err.message });
    });
  });
}
```

### Endpoint Payment di Print Bridge
```typescript
// print-bridge/src/index.ts (tambahkan endpoint baru)
app.post('/payment/edc', async (req, res) => {
  const { amount, orderId } = req.body;
  const result = await requestEDCPayment(amount);
  res.json({ ...result, orderId });
});
```

### Flow Payment dari Web POS
```typescript
// Di payment-modal.tsx
async function handleCardPayment(amount: number, orderId: string) {
  setStatus('processing');

  // Kirim ke print bridge → EDC
  const res = await fetch('http://localhost:3001/payment/edc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, orderId }),
    signal: AbortSignal.timeout(65000), // 65 detik (lebih dari EDC timeout)
  });

  const result = await res.json();

  if (result.success) {
    // Update order status di server
    await fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'PAID',
        paymentMethod: 'CARD',
        edcTransactionId: result.transactionId,
      }),
    });

    // Print struk
    await printReceipt({ orderId, paymentMethod: 'Kartu', ... });

    setStatus('success');
  } else {
    setStatus('failed');
    toast.error(result.message);
  }
}
```

---

## 21. Alur Order End-to-End

```
[1] Kasir pilih produk → Cart (Zustand)
        ↓
[2] Tap "Bayar" → Payment Modal
        ↓
[3a] Tunai: input nominal → hitung kembalian → langsung ke [4]
[3b] QRIS/Transfer: tampil QR → polling status → ke [4]
[3c] Kartu: POST ke Print Bridge → EDC proses kartu → callback → ke [4]
        ↓
[4] POST /api/orders
    ├─ Validasi Zod
    ├─ Prisma transaction (SELECT FOR UPDATE → buat order → update stok cache)
    ├─ Generate Order ID (#A001)
    ├─ Trigger Pusher "new-order" → Kitchen Display update realtime
    └─ Publish QStash job "push-olsera"
        ↓
[5] Response 201 → Client
    ├─ Clear cart (Zustand)
    ├─ Show success toast dengan Order ID
    └─ Trigger print: POST localhost:3001/print
        ↓
[6] Print Bridge cetak struk ESC/POS ke thermal printer
        ↓
[7] QStash job berjalan (async, retry jika gagal):
    POST /api/jobs/push-olsera
    → Olsera API createTransaction
    → Update order.olseraSynced = true
```

---

## 23. Skema Database

> **Pengingat Pilihan A**: Tabel `product_cache` adalah **snapshot read-only dari Olsera**.
> Hanya `lib/olsera-sync.ts` yang boleh menulis ke tabel ini. Tidak ada Route Handler
> user-facing yang boleh INSERT/UPDATE/DELETE ke `product_cache` secara langsung.

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")        // Pooled — untuk runtime query
  directUrl = env("DIRECT_DATABASE_URL") // Direct — untuk prisma migrate
}

// ─── TABEL MILIK SISTEM KITA (Source of Truth) ──────────────────────────────

model User {
  id                String     @id @default(cuid())
  username          String     @unique
  name              String
  passwordHash      String
  role              Role       @default(CASHIER)
  defaultStationId  String?
  createdAt         DateTime   @default(now())
  orders            Order[]
  shiftLogs         ShiftLog[]
}

enum Role {
  CASHIER
  MANAGER
  KITCHEN
  ADMIN
}

model Order {
  id                  String      @id // Format: #A001 — bukan UUID
  stationId           String      // "A", "B", atau "C"
  cashier             User        @relation(fields: [cashierId], references: [id])
  cashierId           String
  tableNumber         String?
  status              OrderStatus @default(PENDING)
  total               Int         // Rupiah integer — JANGAN pakai Float
  paymentMethod       String?     // CASH, CARD, QRIS, TRANSFER
  cashReceived        Int?        // Untuk pembayaran tunai
  changeAmount        Int?        // Kembalian
  edcTransactionId    String?     // ID dari mesin EDC jika bayar kartu

  // Tracking sinkronisasi ke Olsera
  olseraSynced        Boolean     @default(false)
  olseraSyncedAt      DateTime?
  olseraTransactionId String?     // ID transaksi dari Olsera setelah push berhasil

  items               OrderItem[]
  createdAt           DateTime    @default(now())
  updatedAt           DateTime    @updatedAt

  @@index([stationId, createdAt])
  @@index([status])
  @@index([createdAt])
  @@index([olseraSynced])           // Index untuk query job "belum ter-sync"
}

enum OrderStatus {
  PENDING       // Baru dibuat, belum dibayar
  PROCESSING    // Sedang diproses EDC/QRIS
  PAID          // Sudah dibayar, menunggu dibuat
  PREPARING     // Sedang dibuat di dapur
  READY         // Siap diambil oleh pelanggan
  COMPLETED     // Selesai dan diambil
  CANCELLED     // Dibatalkan sebelum bayar
}

model OrderItem {
  id        String @id @default(cuid())
  order     Order  @relation(fields: [orderId], references: [id])
  orderId   String
  olseraId  String // ID produk di Olsera — untuk mapping saat push transaksi
  name      String // Snapshot nama produk saat order dibuat
  price     Int    // Snapshot harga saat order dibuat (Int Rupiah)
  quantity  Int
  subtotal  Int    // price × quantity — disimpan untuk audit
  notes     String?

  @@index([orderId])
}

model ShiftLog {
  id          String    @id @default(cuid())
  stationId   String
  cashier     User      @relation(fields: [cashierId], references: [id])
  cashierId   String
  startTime   DateTime  @default(now())
  endTime     DateTime?
  openingCash Int       @default(0)
  closingCash Int?
  totalSales  Int?      // Dihitung saat shift ditutup — bukan dari Olsera

  @@index([stationId, startTime])
}

// ─── TABEL CACHE DARI OLSERA (Read-Only Mirror) ──────────────────────────────
// ⚠ JANGAN pernah update tabel ini dari input user.
// ⚠ Hanya lib/olsera-sync.ts yang boleh menulis ke sini.
// ⚠ Ini adalah snapshot stok optimistic — stok "real" ada di Olsera.

model ProductCache {
  olseraId    String   @id        // ID produk di Olsera — primary key
  name        String
  description String?
  price       Int                 // Snapshot harga dari Olsera (Int Rupiah)
  stock       Int                 // Stok optimistic — koreksi via webhook
  category    String
  imageUrl    String?
  isActive    Boolean  @default(true)
  cachedAt    DateTime @default(now())  // Kapan terakhir sync dari Olsera
  updatedAt   DateTime @updatedAt

  @@index([category])
  @@index([isActive])
  @@index([cachedAt])             // Untuk deteksi produk yang sudah lama tidak di-sync
}

// ─── AUDIT LOG SINKRONISASI OLSERA ───────────────────────────────────────────

model OlseraSyncLog {
  id          String   @id @default(cuid())
  type        String   // "product_sync" | "stock_update" | "push_transaction"
  status      String   // "success" | "failed"
  orderId     String?  // Untuk type push_transaction
  productId   String?  // Untuk type stock_update
  itemsSynced Int?     // Untuk type product_sync
  errorMsg    String?
  createdAt   DateTime @default(now())

  @@index([type, createdAt])
  @@index([status])
}
```

**Catatan Skema:**
- Semua uang disimpan sebagai `Int` (Rupiah), bukan `Float` — hindari floating point bug
- `Order.id` adalah Order ID custom (`#A001`) — ini primary key, bukan UUID
- `OrderItem.name` dan `OrderItem.price` adalah snapshot saat order dibuat, bukan referensi live ke `ProductCache`. Ini penting karena harga produk di Olsera bisa berubah.
- `ProductCache.stock` bersifat optimistic — dikurangi saat order masuk, dikoreksi ke nilai real via webhook `stock.updated` dari Olsera
- `OlseraSyncLog` untuk audit — mudah debug jika ada masalah sinkronisasi

---

## 23. Environment Variables

### `.env.example` (Commit file ini, jangan `.env.local`)
```bash
# ─── Next.js ───
NEXT_PUBLIC_BASE_URL=https://your-project.vercel.app
NEXTAUTH_URL=https://your-project.vercel.app
AUTH_SECRET=                          # Generate: npx auth secret

# ─── Neon PostgreSQL ───
DATABASE_URL=                         # Pooled connection string
DIRECT_DATABASE_URL=                  # Direct connection (untuk migrate)

# ─── Upstash Redis ───
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# ─── Upstash QStash ───
QSTASH_TOKEN=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=

# ─── Pusher ───
PUSHER_APP_ID=
PUSHER_SECRET=
NEXT_PUBLIC_PUSHER_KEY=
NEXT_PUBLIC_PUSHER_CLUSTER=ap1       # Singapore

# ─── Olsera ───
OLSERA_API_TOKEN=
OLSERA_WEBHOOK_SECRET=

# ─── Sentry ───
SENTRY_DSN=
SENTRY_ORG=
SENTRY_PROJECT=

# ─── Print Bridge (lokal — tidak perlu di Vercel) ───
# PRINTER_INTERFACE=tcp://192.168.1.100
# EDC_HOST=192.168.1.200
# EDC_PORT=8080
```

### Cara Set di Vercel
```
Vercel Dashboard → Project → Settings → Environment Variables
→ Tambahkan satu per satu
→ Centang: Production, Preview, Development
→ JANGAN set variabel yang hanya untuk print bridge (PRINTER_INTERFACE, EDC_HOST)
```

---

## 25. Urutan Implementasi (Sprint)

> **Prinsip urutan**: Olsera Backoffice harus sudah dikonfigurasi sebelum Sprint 2.
> Tanpa data produk di Olsera, POS tidak bisa menampilkan menu.

### Pra-Sprint — Setup Olsera (Lakukan PERTAMA)
- [ ] Daftar/login ke [dashboardv2.olsera.co.id](https://dashboardv2.olsera.co.id)
- [ ] Input semua produk menu coffee shop (nama, harga, kategori, stok awal)
- [ ] Setup kategori produk (misal: Espresso, Manual Brew, Makanan, dll)
- [ ] Dapatkan API Token Olsera dari Settings → API
- [ ] Catat format respons API Olsera (`/products`, `/transactions`) untuk type mapping
- [ ] Pastikan webhook dapat dikonfigurasi (tanya support Olsera jika perlu)

### Sprint 1 — Fondasi (Minggu 1-2)
- [ ] Setup project Next.js + TypeScript + Tailwind
- [ ] Setup Neon database + Prisma schema + migration
- [ ] Setup Upstash Redis + QStash
- [ ] Setup Auth.js — login kasir dengan role
- [ ] Setup Vercel deployment + **Fluid Compute ON**
- [ ] Setup Sentry monitoring
- [ ] Implementasi middleware auth + role guard

### Sprint 2 — Integrasi Olsera + Core POS (Minggu 3-4)
- [ ] Implementasi `lib/olsera.ts` adapter dengan rate limit
- [ ] Implementasi `lib/olsera-sync.ts` (syncProductsFromOlsera, syncStockFromOlsera)
- [ ] Job: `POST /api/jobs/sync-products` (QStash handler, verifikasi signature)
- [ ] Daftarkan cron QStash setiap 5 menit untuk sync produk
- [ ] Webhook: `POST /api/webhooks/olsera` (verifikasi signature Olsera)
- [ ] Test: pastikan `product_cache` Neon terisi dari Olsera
- [ ] API: `GET /api/products` (dua lapis cache: Redis → Neon)
- [ ] UI: Layout POS (product grid + cart sidebar)
- [ ] UI: Station selector (A/B/C)
- [ ] Zustand: cart store + station store
- [ ] TanStack Query: `useProducts` hook
- [ ] Generator Order ID (#A001, #B001, #C001)
- [ ] API: `POST /api/orders` (dengan transaction lock + optimistic stock deduction)

### Sprint 3 — Realtime & Print (Minggu 5)
- [ ] Setup Pusher Channels (cluster `ap1` Singapore)
- [ ] Kitchen Display page (subscriber Pusher)
- [ ] Print Bridge: setup + thermal printer test di PC kasir
- [ ] Integrasi `lib/print.ts` — print setelah order sukses
- [ ] Offline mode dengan Dexie.js
- [ ] Offline sync saat reconnect

### Sprint 4 — Payment & EDC (Minggu 6)
- [ ] Payment modal UI (tunai, kartu, QRIS)
- [ ] Flow pembayaran tunai + hitung kembalian
- [ ] Integrasi EDC via Print Bridge (`/payment/edc`)
- [ ] Idempotency key untuk semua payment endpoint
- [ ] Status tracking payment (polling / EDC callback)
- [ ] Job: `POST /api/jobs/push-olsera` (push transaksi PAID ke Olsera via QStash)
- [ ] Test: order #A001 muncul di Olsera Backoffice setelah bayar

### Sprint 5 — Dashboard & Polish (Minggu 7-8)
- [ ] Dashboard: ringkasan shift per station (bukan laporan bisnis — itu di Olsera)
- [ ] Shift management (buka/tutup shift + log uang tunai)
- [ ] Error boundaries di semua POS routes
- [ ] PWA manifest + Service Worker
- [ ] Konfigurasi webhook Olsera di dashboardv2.olsera.co.id
- [ ] Load testing: simulasi 3 tablet concurrent order
- [ ] Checklist pre-launch lengkap

---

## 26. Checklist Pre-Launch

### Vercel Configuration
- [ ] Fluid Compute diaktifkan di Project Settings → Functions
- [ ] `maxDuration: 300` ada di `vercel.json`
- [ ] Semua environment variables sudah di-set (lihat Bagian 24)
- [ ] Custom domain sudah terhubung (opsional)

### Olsera Backoffice (Pilihan A — Wajib Dikerjakan Pertama)
- [ ] Semua produk menu sudah diinput di dashboardv2.olsera.co.id
- [ ] Stok awal sudah diset untuk semua produk
- [ ] Kategori produk sudah rapi (akan menjadi kategori di grid POS)
- [ ] API Token Olsera sudah di-set di environment variables Vercel
- [ ] Webhook URL sudah didaftarkan di Olsera: `https://your-project.vercel.app/api/webhooks/olsera`
- [ ] Events webhook yang aktif: `product.created`, `product.updated`, `product.deleted`, `stock.updated`
- [ ] Test webhook: tambah satu produk dummy di Olsera → cek apakah `product_cache` Neon ikut update

### Database
- [ ] Migration sudah dijalankan: `npx prisma migrate deploy`
- [ ] Seed data: user admin, kasir A/B/C sudah dibuat dengan password
- [ ] `product_cache` sudah terisi dari sync Olsera: `SELECT COUNT(*) FROM product_cache`
- [ ] Index sudah ada dan verified di tabel `orders` dan `product_cache`

### Integrasi Olsera (End-to-End)
- [ ] Buat order test dari tablet → cek `olseraSynced = false` dulu
- [ ] Bayar order test → tunggu QStash job berjalan (< 30 detik)
- [ ] Cek `olseraSynced = true` dan `olseraTransactionId` terisi di DB
- [ ] Buka Olsera Backoffice → cek transaksi test muncul di laporan
- [ ] Cek stok produk yang dipesan berkurang di Olsera Backoffice
- [ ] Tunggu webhook `stock.updated` dari Olsera → cek `product_cache` stok ikut terupdate

### Security
- [ ] `AUTH_SECRET` kuat (32+ karakter random)
- [ ] JWT `maxAge` 8 jam (bukan lebih lama)
- [ ] Semua `/api/jobs/*` memverifikasi QStash signature
- [ ] Webhook `/api/webhooks/olsera` memverifikasi Olsera signature
- [ ] Tidak ada endpoint POST/PUT/DELETE produk yang bisa dipanggil dari frontend

### Hardware di Lokasi
- [ ] Print Bridge berjalan: `pm2 status` menunjukkan `online`
- [ ] Print Bridge auto-start dikonfigurasi: `pm2 startup` + `pm2 save`
- [ ] Thermal printer test berhasil dari Print Bridge
- [ ] EDC terkoneksi ke jaringan lokal (cek IP di `ecosystem.config.js`)
- [ ] 3 tablet terhubung ke WiFi yang sama dengan PC kasir

### Testing Fungsional (3 Tablet)
- [ ] Login kasir A, B, C masing-masing berhasil di tablet berbeda
- [ ] Station A → generate `#A001`, Station B → `#B001`, Station C → `#C001`
- [ ] Order dari Tablet A muncul di kitchen display < 2 detik
- [ ] Print struk berhasil setelah bayar tunai (dengan kembalian)
- [ ] Print struk berhasil setelah bayar kartu via EDC
- [ ] Saat koneksi putus → order tersimpan offline → reconnect → auto sync
- [ ] Saat Print Bridge offline → order tetap berhasil (muncul toast warning)
- [ ] 3 tablet order produk yang sama secara bersamaan → tidak ada race condition

### Monitoring
- [ ] Sentry menerima test error
- [ ] Vercel Analytics aktif di dashboard
- [ ] Alert Sentry ke email untuk error critical dikonfigurasi
- [ ] QStash job history bisa dilihat di Upstash Console

---

*Dokumen ini harus diupdate setiap ada perubahan arsitektur signifikan.*
*Arsitektur: Pilihan A — Olsera Native | Versi: 1.1.0 | Update: 2025*