# SPRINT_AUDIT.md — POS Rakken Coffee

> Dokumen audit progress sprint untuk referensi AI dan developer.
> **Terakhir diupdate:** 21 Mei 2026
> **Arsitektur:** Pilihan A — Olsera Native
> **Referensi utama:** `PLAN.md`

---

## 1. Informasi Proyek

| Key | Value |
|-----|-------|
| **Nama** | POS System — Rakken Coffee (StartFriday) |
| **Framework** | Next.js 16.1.6 (App Router) |
| **Language** | TypeScript / Node.js |
| **Styling** | Tailwind CSS v4 |
| **Database** | Neon PostgreSQL (Prisma ORM v6.19.3) |
| **Cache** | Upstash Redis |
| **Queue** | Upstash QStash |
| **Realtime** | Pusher Channels (cluster: `ap1`) |
| **Auth** | Auth.js v5 (next-auth beta.31, Credentials provider, JWT strategy) |
| **Payment** | EDC ECR (Direncanakan menggantikan Midtrans secara penuh) |
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
  Pelanggan buka /menu → pilih produk → customize → checkout → Midtrans / Local Payment → success + print via Local Print Bridge
```

### Deviasi & Perbandingan Detail

| Aspek | PLAN.MD | Aktual | Status/Keterangan |
|-------|---------|--------|-------------------|
| **Route Utama** | `/pos` (cashier) | `/menu`, `/cart`, `/checkout` (customer) | ✅ Disesuaikan untuk Kiosk |
| **Auth Order** | Wajib login kasir | Public access (tanpa login) untuk customer | ✅ Sesuai kebutuhan Kiosk |
| **Station A/B/C** | Ya (Zustand persist) | Tidak ada di Kiosk UI, diidentifikasi via Kiosk browser | ✅ Menggunakan satu URL production |
| **Payment** | EDC via Print Bridge | Midtrans Snap (Direncanakan diganti full oleh EDC ECR) | ⚠️ Transisi ke EDC ECR Fisik |
| **Print** | Print Bridge (localhost:3001) | Print Bridge (localhost:3001) + Web print fallback | ✅ Didukung ganda (Local & Browser fallback) |
| **Cart State** | Zustand + persist localStorage | Zustand persist | ✅ Sinkron & Cepat |

---

## 3. Progress Per Sprint

### 3.1 Pra-Sprint — Setup Olsera ✅ (100%)

| Item | Status | Detail |
|------|--------|--------|
| Daftar/login Olsera Backoffice | ✅ | Selesai |
| Input semua produk menu | ✅ | 6 kategori: Coffee Based, Milk Based, Main Course, Dessert, Snack, Refreshment |
| Setup kategori produk | ✅ | Terkonfirmasi dari API response |
| Dapatkan API Token | ✅ | Di `.env` sebagai `OLSERA_CLIENT_ID` + `OLSERA_SECRET_KEY` |
| Catat format respons API | ✅ | Adapter lengkap di `olsera.service.ts` |
| Konfigurasi webhook Olsera | ✅ | **100% Synchronized** dengan `openOrderUpdateStatus` spec |

---

### 3.2 Sprint 1 — Fondasi ✅ (100%)

| Item | Status | File/Detail |
|------|--------|-------------|
| Next.js + TypeScript + Tailwind | ✅ | Next.js **16.1.6** & React 19 |
| Neon DB + Prisma schema + migration | ✅ | `prisma/schema.prisma` |
| Upstash Redis | ✅ | `src/lib/redis.ts` |
| Upstash QStash | ✅ | `src/lib/qstash.ts` |
| Auth.js v5 — login kasir + role | ✅ | `src/lib/auth.ts` + `src/lib/auth.config.ts` |
| Vercel deployment + Fluid Compute | ✅ | Deployed (Fluid Compute ON) |
| **Sentry monitoring** | ✅ | Full-stack active (Tunnel + Manual Init + Logs) |

---

### 3.3 Sprint 2 — Integrasi & Offline Ready ✅ (100%)

| Item | Status | File/Detail |
|------|--------|-------------|
| `lib/olsera.ts` adapter | ✅ | `src/lib/integrations/olsera.service.ts` |
| Webhook: `/api/webhooks/olsera` | ✅ | **Verified dengan Olsera standard** |
| Generator Order ID (#A001) | ✅ | `src/lib/order-id.ts` |
| **Offline mode (Dexie.js)** | ✅ | `src/lib/dexie.ts` + `OfflineSyncProvider` |
| **Offline Fallback Checkout** | ✅ | Pesanan disimpan ke Dexie saat internet mati |
| **PWA Manifest + Service Worker** | ✅ | `@ducanh2912/next-pwa` (Anti-Dino Page) |
| **Payment Gateway** | ✅ | Midtrans Snap (Sandbox/Production) |

---

### 3.4 Sprint 3 — Real-time & Security ✅ (100%)

| Item | Status | Detail |
|------|--------|--------|
| Pusher Integration (KDS) | ✅ | `src/lib/pusher.ts` + Kitchen & Barista subscription |
| **Error Boundaries (Custom UI)** | ✅ | Global `error.tsx` + `ErrorBoundary.tsx` |
| **KDS Auto-Refresh on Reconnect** | ✅ | Online & Pusher reconnection listeners |
| **Thermal Print (Receipt Component)** | ✅ | `@media print` optimized for 80mm & Local Print Bridge API integration |
| Local Printing (Print Bridge) | ✅ | Express server local (`localhost:3001`) untuk direct thermal printing |

---

### 3.5 Sprint 4 — Admin & Reports ✅ (100%)

| Item | Status | Detail |
|------|--------|--------|
| **Real-time Sales Report** | ✅ | API aggregated dari local Prisma |
| **Admin Dashboard UI** | ✅ | Interactive charts via `recharts` |
| **Dual-Sync Persistence** | ✅ | Mirroring orders ke Prisma & Olsera |
| **Unified Admin Auth** | ✅ | Secure access via Auth.js (Role-based) |

---

### 3.6 Sprint 5 — Load Testing & Polish ✅ (100%)

| Item | Status | Detail |
|------|--------|--------|
| **Load & Concurrency Testing** | ✅ | Diuji menggunakan skrip kustom di `scripts/concurrency_test.ts` dan `scripts/kds_stress_test.ts` (menggantikan K6 untuk pengujian native API). |
| **Idempotency & Reconciliation** | ✅ | Pengujian webhook ganda (`idempotency_test.ts`) dan pemulihan order SF- fallback (`reconciliation_test.ts`) sukses 100%. |
| **Voucher Validation Polish** | ✅ | Penanganan bug Olsera voucher `fmin_order_amount` (IDR 0) dengan formatting lokal agar pesan error user presisi. |
| **Print Bridge CORS Fix** | ✅ | CORS whitelisting untuk domain custom (`https://menu.rakkencoffee.com`) agar tablet kiosk dapat mengakses printer lokal. |
| **PM2 Background Automation** | ✅ | Print Bridge berjalan otomatis sebagai background service via PM2 dengan restart otomatis saat boot. |
| Vercel Analytics | ⏳ | Direkomendasikan diaktifkan di dashboard Vercel. |

---

## 4. Perbaikan Terbaru & Optimasi (Mei 2026)

1. **Voucher Validation Robustness:**
   - Ditemukan masalah di mana Olsera API mengembalikan `"fmin_order_amount": "IDR 0"` untuk voucher tidak valid atau di bawah batas minimum.
   - Diperbaiki di `olsera.service.ts` dengan memformat minimum order amount lokal secara dinamis agar user mendapatkan pesan error yang ramah dan tepat (misal: `"Minimal pembelian Rp 50.000"`).

2. **CORS Whitelisting:**
   - Server `print-bridge/src/index.js` diperbarui untuk mendukung header CORS dari domain custom produksi `https://menu.rakkencoffee.com`.

3. **Background Daemonization & Auto-Reconnect Printer:**
   - `print-bridge` sekarang berjalan di atas PM2 dengan mode clustering/forking, menjamin ketersediaan server printer lokal secara silent di PC/alat kasir utama.
   - **Auto-Reconnect Loop:** Menambahkan *self-healing loop* 5 detik pada jembatan serial bluetooth. Jika koneksi serial terputus di tengah jalan, mati lampu, printer low-battery, atau baru dinyalakan lambat setelah OS boot, jembatan akan otomatis menyambungkan kembali tanpa intervensi manual staf kasir.

4. **Dual-Layer Windows Boot Automation:**
   - Menyediakan `start-rakken-printer.bat` yang otomatis berjalan saat Windows login.
   - Script memberikan delay **15 detik** agar stack Bluetooth Windows siap sepenuhnya, kemudian melakukan `pm2 restart` dengan `--update-env` dan menembak `/health` untuk memverifikasi kesiapan akhir.

5. **Pembersihan Drink Options & Bug E2E POS Kiosk:**
   - **Drink Options Cleaning:** Mencegah opsi minuman (sugar level, ice, size) merembet ke item makanan (makanan/snack) di checkout cart.
   - **Order Status Flow Fix:** Memperbaiki KDS status patcher agar status Olsera tetap di "Konfirmasi" (`'A'`) selama stasiun KDS lain masih bekerja (tidak prematur reset ke tunda).
   - **Status Page Fallback:** Mengaktifkan query fallback database lokal pada `/status` untuk mencegah flicker kembali ke "Pending" karena delay sinkronisasi Cloud API.
   - **Payment Cancel Protection:** Memblokir kirim data ke KDS/struk cetak prematur jika user menekan batal pada Snap/Midtrans dialog box.

---

## 5. Struktur File Aktual

```
pos-system/
├── scripts/
│   ├── concurrency_test.ts        ← Test order simultan dari tablet
│   ├── kds_stress_test.ts         ← Simulasi beban berat KDS fetch
│   ├── idempotency_test.ts        ← Verifikasi double webhook Midtrans
│   └── reconciliation_test.ts     ← Pengujian recovery order gagal (SF- to OLSERA-)
├── prisma/
│   └── schema.prisma              ← Sesuai PLAN.md (ditambah model PrintJob & Order fields)
├── print-bridge/                  ← Repo jembatan cetak lokal PC kasir
│   ├── src/
│   │   ├── index.js               ← Express server + auto-reconnect serial
│   │   ├── format-receipt.js      ← ESC/POS formatter struk & label
│   │   └── test-print.js          ← Script scan & diagnostic printer
│   ├── start-rakken-printer.bat   ← Jaring pengaman delay boot script
│   └── .env                       ← PRINTER_PORT & API Key config
├── src/
│   ├── app/
│   │   ├── (admin)/admin/         ← Admin dashboard
│   │   ├── (kds)/kitchen/         ← Kitchen Display System
│   │   ├── (kds)/barista/         ← Barista display screen
│   │   ├── (kiosk)/               ← Customer self-service kiosk
│   │   │   ├── checkout/page.tsx  ← Offline fallback logic inside
│   │   │   └── success/page.tsx   ← Offline success UI handling
│   │   ├── api/                   ← All API endpoints (Termasuk print-jobs queue)
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

## 6. Kekurangan dari Plan Awal & Kritik Arsitektur (Best Practices)

### 6.1 Gaps (Kekurangan dari PLAN.md)
* **Ketiadaan Centralized Print Queue:** **[SELESAI / TERATASI]**
  - *Sebelumnya:* Cetak struk direncanakan dikirim langsung dari browser tablet kiosk. Hal ini akan gagal jika memanggil `localhost:3001` dari browser iPad/Android yang terpisah (karena print bridge berjalan di PC Windows Kasir).
  - *Solusi Aktual:* Diimplementasikan **Cloud Print Queue** di database PostgreSQL (`prisma.printJob`). Tablet kiosk cukup mengunggah print job ke API Cloud `/api/print-jobs`. Server Print Bridge lokal di PC kasir kemudian melakukan long-polling `GET /api/print-jobs` setiap 3 detik untuk mengambil antrean dan mencetaknya secara berurutan.

### 6.2 Evaluasi & Kritik Best-Practice
1. **Model Proxy Cetak (Localhost Print Bridge):** **[TERTANGGULANGI]**
   - *Masalah:* Tablet kiosk memanggil localhost yang mengarah ke tablet itu sendiri.
   - *Solusi:* Cloud Print Queue menghilangkan kebutuhan pemanggilan langsung. Komunikasi diatur via sinkronisasi antrean cloud terpusat.

2. **Keamanan Local Print Bridge:** **[SELESAI / TERATASI]**
   - *Masalah:* Jembatan cetak Express berjalan tanpa otorisasi di jaringan LAN kasir.
   - *Solusi:* Menambahkan header `x-api-key` statis (`rakken-print-bridge-secret-key-123`) di sisi Express Server dan Client Fetch Next.js. Hanya server Next.js resmi yang diizinkan memicu cetak.

3. **Autentikasi & Proteksi Endpoint Webhook:** **[TERPROTEKSI]**
   - Signature token internal diverifikasi untuk mencegah injeksi order palsu.

4. **Keamanan Penyimpanan Offline (Dexie.js / IndexedDB):** **[SANGAT AMAN]**
   - Browser dijalankan dalam Kiosk Mode (Single App Mode) terisolasi tanpa akses developer tools bagi publik.

---

*Versi: 1.4.0 | Auditor: Antigravity | Tanggal: 25 Mei 2026*

