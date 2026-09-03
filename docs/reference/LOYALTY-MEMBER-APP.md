# RAKKEN Loyalty / Member App — Backend API Contract

> **Untuk AI coding agent mana pun yang kerja di file ini:** dokumen ini adalah sumber kebenaran untuk fitur loyalty/member app yang sedang dibangun. PoS-system (repo ini) adalah **satu-satunya pemegang database & business logic** ("1 backend, 2 frontend"). Repo terpisah `rakken-member-app` (Next.js, di luar repo ini) HANYA konsumer API — jangan pernah asumsikan ia punya akses database sendiri, dan jangan pernah bikin ulang logic yang sudah ada di sini (reuse fungsi di `pos.adapter.ts`/`olsera.service.ts`, jangan duplikat).
>
> Status: **draft aktif, sebagian sudah diimplementasi** — lihat tabel status di bawah, bukan asumsi. Selalu cek kode aktual sebelum menganggap sesuatu "sudah ada".

## 1. Ringkasan Produk

Member App adalah channel order kedua RAKKEN Coffee (pickup only, order-ahead dari HP sendiri), dengan sistem poin (1 poin = Rp1 nominal transaksi) dan tier membership (4 tier, berdasar akumulasi belanja per 365 hari). Login pakai **Neon Auth** (Google/Email). Referensi desain: aplikasi Chagee. PRD lengkap (15 bab + diagram UML) ada di percakapan Claude sesi brainstorming — **belum dicommit sebagai file di repo mana pun**, jadi dokumen ini sengaja dibuat cukup mandiri (self-contained) untuk kerja sehari-hari, tanpa perlu akses ke PRD itu.

## 2. Arsitektur & Keputusan Kunci

- **Database**: SATU Postgres (Neon) yang sama dengan kiosk, dipegang penuh repo ini (`prisma/schema.prisma`). Tabel loyalty (`Member`, `PointLedger`, `TierRule`, `LoyaltyConfig`, `RewardsCatalog`, `ClaimedBenefit`) + kolom `Order.channel`/`Order.memberId` **SUDAH LIVE di production** (`prisma db push` sukses 2026-09-03).
- **Auth member**: Neon Auth (Managed Better Auth, package `@neondatabase/auth`), di-host & divalidasi di sisi **Member App**, BUKAN di repo ini. Repo ini tidak pernah bicara langsung ke Neon Auth.
- **Komunikasi antar backend — KEPUTUSAN (2026-09-03), REVISI dari draft PRD awal yang sempat menyebut "CORS + API key" langsung dari browser:**
  Browser Member App → **backend Next.js milik Member App sendiri** (yang sudah tervalidasi Neon Auth session-nya) → server-to-server ke PoS-system (repo ini) pakai header `x-api-key`, env var **`MEMBER_APP_API_KEY`** (server-only, JANGAN pakai prefix `NEXT_PUBLIC_` — beda dari `PRINT_BRIDGE_API_KEY` yang existing, itu kebetulan ke-expose ke browser karena print-bridge memang daemon lokal yang bacanya dari env lokal, bukan berarti pola itu harus ditiru di sini).
  **Konsekuensi**: repo ini TIDAK butuh CORS sama sekali untuk endpoint `/api/member/*` (bukan request browser cross-origin, murni server-to-server) — cukup cek `x-api-key` seperti pola `src/app/api/print-jobs/route.ts` yang sudah ada.
  PoS-system tidak pernah tahu soal Neon Auth session — Member App yang resolve identitas dulu, lalu kirim `neonAuthUserId` sebagai parameter biasa.
- **Order dari Member App**: REUSE fungsi Olsera yang sama dgn kiosk (`pos.adapter.ts`'s `createOrder`, `updateOrderPaymentStatus`), BUKAN reimplementasi. `POST /api/orders` (route lama) sudah **deprecated (501)** — jangan dipakai sebagai referensi pola, order creation asli sekarang lewat `/api/payment/create` → `pos.adapter.createOrder()`.
- **Print**: order dari Member App skip nota customer, tapi tetap generate `PrintJob` label dapur — perlu flag baru di `createOrder()`/caller-nya (belum diimplementasi, lihat tabel status).
- **Observasi keamanan (BUKAN untuk diperbaiki sekarang, cuma dicatat biar gak ditiru)**: endpoint `/api/admin/menu` dan sejenisnya **TIDAK punya server-side auth check** — mengandalkan halaman admin di-gate cuma di frontend. Endpoint baru `/api/member/admin/*` di dokumen ini WAJIB pakai `auth()` dari `src/lib/auth.ts` + cek `session.user.role === 'ADMIN'` beneran di server, JANGAN copy pola admin/menu yang lama.

## 3. Skema Database (ringkasan — lihat `prisma/schema.prisma` untuk definisi lengkap/akurat)

| Model | Fungsi |
|---|---|
| `Member` | Profil member: `neonAuthUserId`, `email`, `name`, `phone`, `birthDate`, `olseraCustomerId` (semua required — Member row baru dibuat SETELAH onboarding submit, bukan saat login pertama) + kolom cache `pointBalance`/`tierLevel`/`tierPeriodStart`/`tierPeriodSpend`/`lastTransactionAt`. |
| `PointLedger` | Sumber kebenaran saldo poin (EARN/REDEEM/EXPIRE/ADJUSTMENT), `amount` bertanda. |
| `TierRule` | 1 baris/tier (level, minSpend, dst) — placeholder seed: Tier 1=Rp0, 2=Rp1jt, 3=Rp3jt, 4=Rp7jt. |
| `LoyaltyConfig` | Singleton (`id="singleton"`) — semua angka yang bisa diubah admin (rate poin, expiry, dst). |
| `RewardsCatalog` | Katalog redemption (voucher/menu gratis/merchandise). |
| `ClaimedBenefit` | Klaim manual benefit tier (upgrade/ulang tahun/hari member). |
| `Order.channel` / `Order.memberId` | Diskriminator KIOSK vs MEMBER_APP, link opsional ke Member. |

## 4. Kontrak API — `/api/member/*` (repo ini)

Semua endpoint di bawah ini: guard `x-api-key` (kecuali disebut lain), request/response JSON, dipanggil server-to-server oleh backend `rakken-member-app`.

| # | Endpoint | Method | Status | Fungsi |
|---|---|---|---|---|
| 1 | `/api/member/lookup` | GET `?neonAuthUserId=` | ⬜ TODO | Cek Member existing by neonAuthUserId. 404 kalau belum ada (→ Member App tampilkan Onboarding). |
| 2 | `/api/member/onboarding` | POST | ⬜ TODO | Body: `{neonAuthUserId, email, name, phone, birthDate}`. Search Olsera customer by phone (reuse `findCustomerByPhone`) → kalau ketemu link, kalau tidak → `createCustomer()` (BARU, lihat §5) → buat row `Member`. |
| 3 | `/api/member/menu` | GET | ⬜ TODO (kemungkinan cuma reuse `getMenuItems()` dari `pos.adapter.ts`, sama persis kiosk) | Data menu. |
| 4 | `/api/member/orders` | POST | ⬜ TODO | Buat order channel=MEMBER_APP, reuse `pos.adapter.createOrder`. |
| 5 | `/api/member/orders/:id/simulate-pay` | POST | ⬜ TODO | Set PAID, tulis `PointLedger` EARN, update `Member.tierPeriodSpend`/`pointBalance`/`tierLevel` dalam 1 `$transaction`, trigger print label (skip nota). |
| 6 | `/api/member/:id/points` | GET | ⬜ TODO | Riwayat `PointLedger` + saldo. |
| 7 | `/api/member/:id/redeem` | POST | ⬜ TODO | Redeem `RewardsCatalog`, tulis `PointLedger` REDEEM, generate Discount Voucher Olsera. |
| 8 | `/api/member/admin/config` | GET/PUT | ⬜ TODO | CRUD `TierRule`+`LoyaltyConfig`. **WAJIB** `auth()` + role ADMIN (lihat §2 soal observasi keamanan). |
| 9 | `/api/member/admin/members` | GET | ⬜ TODO | List member + riwayat order, buat CS. |
| 10 | `/api/member/admin/members/:id/adjust-points` | POST | ⬜ TODO | Adjust poin manual, tulis `PointLedger` ADJUSTMENT. |

## 5. Fungsi Baru yang Dibutuhkan di `olsera.service.ts`

- **`createCustomer(name, phone, email?)`** — BELUM ADA, perlu ditambah. Base path sama dengan `findCustomerByPhone` (`/customersupplier/customer`), method POST. Field form berdasar pola yang SUDAH TERBUKTI jalan di `createOrder()`'s guest-customer branch (`customer_name`, `customer_email`, `customer_phone`, `customer_type_id`) — **belum pernah dites sebagai endpoint create customer berdiri sendiri**, jadi wajib ditest manual dulu (curl/Postman) ke Olsera sebelum dipakai di flow onboarding production, jangan asumsikan langsung benar dari analogi ini.

## 6. Environment Variables Baru

```
MEMBER_APP_API_KEY=      # shared secret, server-to-server only, JANGAN NEXT_PUBLIC_
```

## 7. Changelog Dokumen

- 2026-09-03 — Dibuat. Schema database sudah live, endpoint API belum ada (fase eksplorasi kode selesai, mulai implementasi endpoint #1-2 dulu).
