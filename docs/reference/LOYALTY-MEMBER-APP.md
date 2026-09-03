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
- **Print**: SUDAH BERES, gak butuh flag baru — lihat §4 baris #4/#5, ternyata cuma ada 1 jenis PrintJob (tiket dapur), bukan nota+label terpisah.
- **Observasi keamanan (BUKAN untuk diperbaiki sekarang, cuma dicatat biar gak ditiru)**: endpoint `/api/admin/menu` dan sejenisnya **TIDAK punya server-side auth check** — mengandalkan halaman admin di-gate cuma di frontend.
- **KOREKSI auth admin (2026-09-03) — rencana awal "pakai `auth()` NextAuth session langsung" TERNYATA GAK BISA jalan cross-domain**: NextAuth (`src/lib/auth.ts`) pakai session COOKIE yang di-scope ke domain PoS-system (`menu.rakkencoffee.com`) — gak otomatis kebawa ke request dari domain Member App (`rakkencoffee.com`). Solusi yang dipakai: **`POST /api/member/admin/login`** (endpoint BARU) — nerima `{username, password}`, validasi LANGSUNG ke `prisma.user` + bcrypt (logic yang sama persis kayak `Credentials.authorize()` di `src/lib/auth.ts`, tapi dipanggil sebagai fungsi biasa, BUKAN lewat NextAuth), balikin `{id, name, role}` kalau valid. Member App backend yang nyimpen & ngatur SESI ADMIN-nya SENDIRI (mirip pola dia ngatur sesi Neon Auth member) — PoS-system gak pernah tau/peduli soal sesi admin itu. Semua endpoint `/api/member/admin/*` LAINNYA (`config`, `members`, `members/:id/adjust-points`) cukup pakai `x-api-key` yang sama kayak endpoint member lain — trust boundary-nya di titik "Member App backend udah validasi admin login duluan sebelum manggil endpoint-endpoint ini", BUKAN di titik ini.

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
| 1 | `/api/member/lookup` | GET `?neonAuthUserId=` | ✅ DONE | Cek Member existing by neonAuthUserId. 404 kalau belum ada (→ Member App tampilkan Onboarding). |
| 2 | `/api/member/onboarding` | POST | ✅ DONE & TERVERIFIKASI ke Olsera production (lihat §5) | Body: `{neonAuthUserId, email, name, phone, birthDate}`. Search Olsera customer by phone (reuse `findCustomerByPhone`, sudah dibetulin — lihat §5) → kalau ketemu link, kalau tidak → `createCustomer()` (sudah dites jalan) → buat row `Member`. |
| 3 | `/api/member/menu` | GET | ✅ DONE | Reuse `getMenuItems()` dari `pos.adapter.ts`, sama persis kiosk — cuma dibedain path biar kena guard `x-api-key`. |
| 4 | `/api/member/orders` | POST | ✅ DONE | Body `{memberId, items}`. Reuse `pos.adapter.createOrder()` PERSIS (station=null, discountAmount=0 — redeem/diskon belum disambung), lalu tag `channel=MEMBER_APP`+`memberId` di Order row hasilnya (createOrder sendiri gak diubah/gak tau soal member). |
| 5 | `/api/member/orders/:id/simulate-pay` | POST | ✅ DONE | Body `{totalAmount}` (trusted dari client, sama kayak pola `/api/payment/create` kiosk). Reuse `pos.adapter.updateOrderPaymentStatus()` PERSIS, lalu `applyEarnedPoints()` (baru, `src/lib/loyalty.ts`) dalam `$transaction`: tulis `PointLedger` EARN + update cache Member (poin/tier). |
| 6 | `/api/member/:id/points` | GET | ✅ DONE | Balance+tier snapshot dari cache Member + riwayat `PointLedger` (max 100 terbaru). |
| 7 | `/api/member/:id/redeem` | POST | ✅ DONE (kecuali 1 gap, lihat catatan) | Cek saldo poin + `stockQuota` (pakai `timesRedeemed`, update atomic anti-race), tulis `PointLedger` REDEEM, decrement `Member.pointBalance`. **KEPUTUSAN (2026-09-03): TIDAK generate Discount Voucher Olsera terpisah** — `olsera.service.ts` gak punya fungsi create-voucher, nebak bentuk request-nya terlalu beresiko. Gantinya, diskon dari reward VOUCHER dimaksudkan diterapkan langsung lewat `discountAmount` yang udah ada di `/api/member/orders` (jalur yang sama dipakai kode voucher hardcode kiosk) — diskon tetap beneran keliatan di order Olsera, cuma bukan lewat modul Voucher. **GAP YANG MASIH TERBUKA**: belum ada state terstruktur "member ini punya 1 voucher hasil redeem, siap dipakai" di mana pun — endpoint ini baru motong poinnya doang. Jembatan redeem→pakai-di-checkout BELUM didesain, ini keputusan terpisah yang belum dibahas. |
| 8 | `/api/member/admin/login` | POST | ✅ DONE | Body `{username, password}`. Validasi langsung ke `prisma.user`+bcrypt (logic sama kayak `Credentials.authorize()` di `src/lib/auth.ts`, dipanggil sebagai fungsi biasa) — lihat §2 soal kenapa gak bisa pakai NextAuth session langsung cross-domain. |
| 9 | `/api/member/admin/config` | GET/PUT | ✅ DONE | GET: balikin semua `TierRule` + `LoyaltyConfig`. PUT: upsert `TierRule` per level + update `LoyaltyConfig`. |
| 10 | `/api/member/admin/members` | GET | ✅ DONE | List member (pointBalance/tierLevel/dst) + jumlah order per member. |
| 11 | `/api/member/admin/members/:id/adjust-points` | POST | ✅ DONE | Body `{amount, note}`. Tulis `PointLedger` ADJUSTMENT (amount boleh negatif buat koreksi), update `Member.pointBalance`. |

## 5. Fungsi Baru yang Dibutuhkan di `olsera.service.ts`

- **`createCustomer(name, phone, email?, gender?)`** — ✅ SUDAH DITES BENERAN ke Olsera production (2026-09-03, `testing-dev/scripts/test_create_customer.ts`) & JALAN. Field yang BENAR (dikonfirmasi lewat trial-and-error 3 ronde, BUKAN sama kayak field `createOrder()`'s guest-customer branch seperti dugaan awal — endpoint standalone customer ini punya bentuk sendiri): `name`, `phone`, `email` (bare, TANPA prefix `customer_`), PLUS `gender` (wajib, isi `L`/`P`, kita default `'L'` karena gender gak dikumpulin di form onboarding Member App), PLUS `customer_type_id` (`'0'`, INI tetap pakai prefix `customer_`) dan `country_id` (kode 2-huruf, `'ID'` buat Indonesia — dikonfirmasi lewat `GET /global/country`, BUKAN angka).
- **BUG PRODUCTION KETEMU & DIPERBAIKI (2026-09-03): `findCustomerByPhone()` gak pernah bisa nemuin customer yang nomornya kesimpen Olsera dengan format `+62xxx`.** Versi lama bandingin pakai `.endsWith()` string PENUH — `"089900000001".endsWith` gagal cocok sama `"6289900000001"` karena digit sebelum bagian yang sama beda (`0` vs `2`), padahal itu nomor yang SAMA. Ini bukan bug baru dari kode Member App, ini **bug yang udah lama ada di fungsi yang dipakai kiosk juga** (`/api/customers/lookup`) — kemungkinan customer manapun yang nomornya kesimpen format `+62` di Olsera gak pernah kekenali kiosk pas nomornya diketik pakai awalan `0`. **Fix**: bandingin 9 digit TERAKHIR aja (bagian nomor yang gak berubah apa pun prefix-nya), bukan seluruh string. Sudah diverifikasi ulang jalan bener pasca-fix.

## 5b. `src/lib/loyalty.ts` (BARU)

- `getLoyaltyConfig(tx)` — baca singleton `LoyaltyConfig`, upsert lazy (auto-create pakai default schema kalau baris belum pernah ada) — TIDAK butuh seed script terpisah.
- `applyEarnedPoints(tx, memberId, orderTotal, orderId)` — tulis `PointLedger` EARN + update cache `Member` (poin, tier) dalam transaksi yang sama. Kalau tabel `TierRule` masih kosong (belum di-seed admin), fungsi ini cuma gak menaikkan tier (tidak error) — poin tetap ke-earn normal.
- **`TierRule` BELUM PERNAH DI-SEED** — tabelnya ada tapi kosong, artinya sampai admin isi lewat `/api/member/admin/config` (masih TODO, #8), tier gak akan pernah naik dari Tier 1 walау `tierPeriodSpend` udah gede. Ini bukan bug, cuma belum ada data.

## 6. Environment Variables Baru

```
MEMBER_APP_API_KEY=      # shared secret, server-to-server only, JANGAN NEXT_PUBLIC_
```

## 7. Changelog Dokumen

- 2026-09-03 — Dibuat. Schema database sudah live, endpoint API belum ada (fase eksplorasi kode selesai, mulai implementasi endpoint #1-2 dulu).
