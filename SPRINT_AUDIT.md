# SPRINT_AUDIT.md — POS Rakken Coffee

> Dokumen audit progress sprint untuk referensi AI dan developer.
> **Terakhir diupdate:** 28 April 2026
> **Arsitektur:** Pilihan A — Olsera Native
> **Referensi utama:** `PLAN.md`

---

## 1. Informasi Proyek

| Key | Value |
|-----|-------|
| **Nama** | POS System — Rakken Coffee (StartFriday) |
| **Framework** | Next.js 15.1.6 (App Router) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS v4 |
| **Database** | Neon PostgreSQL (Prisma ORM v6) |
| **Cache** | Upstash Redis |
| **Queue** | Upstash QStash |
| **Realtime** | Pusher Channels (cluster: `ap1`) |
| **Auth** | Auth.js v5 (next-auth beta.31, Credentials provider, JWT strategy) |
| **Payment** | Midtrans Snap (bukan EDC seperti di PLAN.md) |
| **Deployment** | Vercel (Hobby plan, Fluid Compute ON) |
| **POS Backoffice** | Olsera (dashboardv2.olsera.co.id) — master data produk & stok |

---

## 2. Arsitektur Aktual vs PLAN.MD

### Perubahan Paradigma Utama

PLAN.md merencanakan sistem **POS Kasir** (3 tablet A/B/C dioperasikan oleh staf).
Yang dibangun adalah **Kios Self-Service** (pelanggan memesan sendiri via tablet/browser).
**Klarifikasi User (22 April 2026):** Memang benar arsitektur UI adalah Kiosk Self-Service. POS ini akan di-deploy di 3 tablet untuk memecah antrian, semua mengarah ke URL produksi yang sama.

```
PLAN.MD (Direncanakan):
  Kasir login → pilih station A/B/C → input order → EDC/cash → print thermal

AKTUAL (Dibangun):
  Pelanggan buka /menu → pilih produk → customize → checkout → Midtrans → success + print virtual
```

### Deviasi #2: State Management — Zustand + TanStack Query (RESOLVED) ✅

Pada audit sebelumnya, tercatat penggunaan React Context. Saat ini seluruh codebase telah dimigrasikan ke:
- **Zustand** dengan `persist` middleware (keranjang tahan refresh).
- **TanStack Query** (v5) untuk caching menu, kategori, dan pesanan.
- **QueryProvider** diatur di root layout.

| Aspek | PLAN.MD | Aktual |
|-------|---------|--------|
| Route utama | `/pos` (cashier) | `/menu`, `/cart`, `/checkout` (customer) |
| Auth untuk order | Wajib login kasir | Public access (tanpa login) |
| Station A/B/C | Ya (Zustand persist) | Tidak ada |
| Payment | EDC via Print Bridge | Midtrans Snap popup |
| Print | Print Bridge (localhost:3001) | Browser `window.print()` + CSS |
| Cart state | Zustand + persist localStorage | Zustand persist |

---

## 3. Progress Per Sprint

### 3.1 Pra-Sprint — Setup Olsera ✅ (100%)

| Item | Status | Detail |
|------|--------|--------|
| Daftar/login Olsera Backoffice | ✅ | Done |
| Input semua produk menu | ✅ | 6 kategori: Coffee Based, Milk Based, Main Course, Dessert, Snack, Refreshment |
| Setup kategori produk | ✅ | Terkonfirmasi dari API response |
| Dapatkan API Token | ✅ | Di `.env` sebagai `OLSERA_CLIENT_ID` + `OLSERA_SECRET_KEY` |
| Catat format respons API | ✅ | Adapter lengkap di `olsera.service.ts` |
| Konfigurasi webhook Olsera | ✅ | **100% Synchronized** with `openOrderUpdateStatus` spec |

---

### 3.2 Sprint 1 — Fondasi ✅ (100%)

| Item | Status | File/Detail |
|------|--------|-------------|
| Next.js + TypeScript + Tailwind | ✅ | Next.js **15.1.6** |
| Neon DB + Prisma schema + migration | ✅ | `prisma/schema.prisma` |
| Upstash Redis | ✅ | `src/lib/redis.ts` |
| Upstash QStash | ✅ | `src/lib/qstash.ts` |
| Auth.js v5 — login kasir + role | ✅ | `src/lib/auth.ts` + `src/lib/auth.config.ts` |
| Vercel deployment + Fluid Compute | ✅ | Deployed |
| **Sentry monitoring** | ✅ | Full-stack active (Tunnel + Manual Init + Logs) |

---

### 3.3 Sprint 2 — Integrasi & Offline Ready ✅ (100%)

| Item | Status | File/Detail |
|------|--------|-------------|
| `lib/olsera.ts` adapter | ✅ | `src/lib/integrations/olsera.service.ts` |
| Webhook: `/api/webhooks/olsera` | ✅ | **Verified with Olsera standard** |
| Generator Order ID (#A001) | ✅ | `src/lib/order-id.ts` |
| **Offline mode (Dexie.js)** | ✅ | `src/lib/dexie.ts` + `OfflineSyncProvider` |
| **Offline Fallback Checkout** | ✅ | Pesanan disimpan ke Dexie saat internet mati |
| **PWA Manifest + Service Worker** | ✅ | `@ducanh2912/next-pwa` (Anti-Dino Page) |
| **Payment Gateway** | ✅ | Midtrans Snap (Sandbox/Production) |

---

### 3.4 Sprint 3 — Real-time & Security ✅ (100%)
| Item | Status | Detail |
|------|--------|--------|
| Pusher Integration (KDS) | ✅ | `src/lib/pusher.ts` + Kitchen subscription |
| **Error Boundaries (Custom UI)** | ✅ | Global `error.tsx` + `ErrorBoundary.tsx` |
| **KDS Auto-Refresh on Reconnect** | ✅ | Online & Pusher reconnection listeners |
| **Thermal Print (Receipt Component)** | ✅ | `@media print` optimized for 80mm |
| Bluetooth/Network Printing | ⏳ | Under discussion (Browser print ready) |

---

### 3.5 Sprint 4 — Admin & Reports ✅ (100%)
| Item | Status | Detail |
|------|--------|--------|
| **Real-time Sales Report** | ✅ | API aggregated from local Prisma |
| **Admin Dashboard UI** | ✅ | Interactive charts via `recharts` |
| **Dual-Sync Persistence** | ✅ | Mirroring orders to Prisma & Olsera |
| **Unified Admin Auth** | ✅ | Secure access via Auth.js (Role-based) |

---

### 3.6 Sprint 5 — Load Testing & Polish ⚠️ (~0%)
| Item | Status | Detail |
|------|--------|--------|
| **Load testing (K6)** | ❌ | Pengujian beban server |
| Final UI Polish | ❌ | Transisi & Micro-animations |
| Vercel Analytics | ❌ | Belum ada |

---

## 4. Struktur File Aktual

```
pos-system/
├── prisma/
│   └── schema.prisma              ← Sesuai PLAN.md
├── src/
│   ├── app/
│   │   ├── (admin)/admin/         ← Admin dashboard
│   │   ├── (kds)/kitchen/         ← Kitchen Display System
│   │   ├── (kiosk)/               ← Customer self-service kiosk
│   │   │   ├── checkout/page.tsx  ← Offline fallback logic inside
│   │   │   └── success/page.tsx   ← Offline success UI handling
│   │   ├── api/                   ← All API endpoints
│   │   └── layout.tsx             ← Sentry + OfflineSyncProvider
│   ├── components/
│   │   ├── OfflineSyncProvider.tsx ← Background sync engine
│   │   ├── SentryProvider.tsx      ← Manual Sentry init
│   │   └── pos/Receipt.tsx         ← Virtual thermal receipt
│   └── lib/
│       ├── dexie.ts               ← Offline Database schema
│       └── integrations/          ← Olsera & Midtrans adapters
├── public/
│   ├── manifest.json              ← PWA Configuration
│   └── sw.js                      ← Generated Service Worker
└── next.config.ts                 ← PWA + Sentry Config
```

---

## 5. Dependencies Aktual (Updated)

### Installed (package.json)
- `@ducanh2912/next-pwa` (PWA Engine)
- `@sentry/nextjs` (Monitoring)
- `dexie` & `dexie-react-hooks` (Offline DB)
- `@tanstack/react-query` (Caching)
- `zustand` (State Management)
- `midtrans-client` (Payment)
- `pusher` & `pusher-js` (Realtime)

---

## 6. Environment Variables (.env)

### ✅ Sudah Dikonfigurasi
```
✅ DATABASE_URL
✅ AUTH_SECRET
✅ UPSTASH_REDIS_REST_URL
✅ QSTASH_TOKEN
✅ PUSHER_APP_ID / SECRET / KEY
✅ OLSERA_CLIENT_ID / SECRET / STORE_ID
✅ MIDTRANS_SERVER_KEY / CLIENT_KEY
✅ SENTRY_DSN
✅ OLSERA_WEBHOOK_SECRET
```

❌ OLSERA_API_TOKEN (DEPRECATED)

---

*Versi: 1.2.0 | Auditor: AI Assistant | Tanggal: 25 April 2026*
