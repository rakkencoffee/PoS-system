# PRD — RAKKEN Coffee Kiosk & POS System

> Product Requirements Document. Dokumen ini bicara di level **produk** (masalah, tujuan, siapa pakai, fitur apa) — bukan level teknis. Untuk detail implementasi lihat [`architecture/SYSTEM-DESIGN.md`](architecture/SYSTEM-DESIGN.md) & [`sprint/PLAN.md`](sprint/PLAN.md). Untuk status progres per sprint lihat [`sprint/SPRINT_AUDIT.md`](sprint/SPRINT_AUDIT.md).
>
> **Terakhir diupdate:** 2026-08-20

---

## 1. Latar Belakang & Masalah

RAKKEN Coffee butuh sistem pemesanan mandiri (self-service kiosk) di outlet untuk memecah antrian kasir tunggal. Sebelumnya semua order lewat 1 kasir manusia — bottleneck saat ramai. Selain itu, tim butuh cara untuk **melacak setiap perubahan status order** (siapa/apa yang mengubah status, kapan, dari mana) karena sempat ada order yang "nyangkut" tanpa jejak audit yang jelas.

Target akhir: outlet fisik dengan **3 tablet kiosk** pelanggan, 1 layar **KDS Barista**, 1 layar **KDS Kitchen** — dan idealnya **tanpa 1 pun komputer/server fisik pusat** di lokasi (lihat [§7](#7-keputusan-arsitektur-printer-zero-local-server)).

## 2. Tujuan Produk

1. Pelanggan bisa pesan & bayar sendiri dari tablet tanpa antre ke kasir manusia.
2. Setiap order langsung tersinkron ke Olsera (source of truth stok & laporan penjualan existing outlet).
3. Barista & kitchen menerima order secara real-time di layar KDS masing-masing, tanpa nota kertas sebagai satu-satunya sumber informasi.
4. Struk pelanggan tetap tercetak otomatis di printer thermal outlet.
5. Semua perubahan status order (dibuat → dibayar → diproses → selesai/batal) tercatat di jurnal audit yang bisa di-query, dengan sumber perubahan yang jelas.
6. Infrastruktur fisik di outlet seminim mungkin — idealnya nol PC/server lokal yang harus dijaga staf.

## 3. Target Pengguna (Persona)

| Persona | Device | Kebutuhan utama |
|---|---|---|
| **Pelanggan** | Tablet kiosk (browser, landscape, mis. iPad gen 11 A16) | Pilih menu, bayar, tahu nomor antrian & status pesanan, dapat struk |
| **Barista** | Layar/tablet KDS `/barista` (login staff) | Lihat antrian minuman real-time, tandai proses/selesai |
| **Kitchen** | Layar/tablet KDS `/kitchen` (login staff) | Lihat antrian makanan real-time, tandai proses/selesai |
| **Admin/Owner** | Dashboard `/admin` (login staff role ADMIN) | Laporan penjualan, kelola akun staff, investigasi order bermasalah lewat jurnal audit |
| **(Rencana) Kasir dadakan** | — | Bisa bantu input manual kalau kiosk down (belum jadi prioritas) |

## 4. Scope Fitur — Sudah Berjalan (MVP, live di `menu.rakkencoffee.com`)

- **Kiosk pemesanan**: `/menu` → `/cart` → `/checkout`, header terpadu (logo + search + cart badge), responsif untuk tablet landscape.
- **Pembayaran**: Midtrans Snap — **catatan penting: ini stub testing**, bukan arsitektur pembayaran final (lihat [§8](#8-yang-belum-selesai--roadmap)).
- **Sinkronisasi Olsera**: order & pembayaran termirror ke Olsera (stok, laporan), termasuk penanganan customer CRM (match by nomor HP, nama ketikan pelanggan menang atas nama CRM).
- **KDS real-time**: `/barista` & `/kitchen`, subscribe Pusher, update status per stasiun, self-healing kalau race condition data belum sinkron.
- **Auth staff**: NextAuth (Auth.js v5), role `KITCHEN`/`ADMIN`/`CASHIER`/`MANAGER`, melindungi `/barista`, `/kitchen`, `/admin`.
- **Cetak struk**: cloud print queue (`PrintJob` di Postgres) + daemon lokal `print-bridge` (Bluetooth ke printer QPOS EPM58UB), notifikasi instan via Pusher (bukan cuma polling 3 detik).
- **Jurnal audit (`OrderStatusLog`)**: setiap perubahan `Order.status`/`baristaStatus`/`kitchenStatus` tercatat dengan `source` (order_created, midtrans_webhook, midtrans_manual_verify, system_voucher_100, olsera_settlement, kds_manual, olsera_webhook, system_recovery) dan `actorId` (user staff asli yang login, bukan null).
- **Status order pelanggan**: `/status` (polling + fallback DB lokal biar gak flicker ke "Pending" saat delay sinkronisasi cloud).
- **Voucher**: redeem voucher Olsera saat checkout, termasuk voucher 100% (gratis, skip Midtrans).
- **PWA**: bisa Add-to-Home-Screen di tablet.

## 5. User Flow Utama

```
1. Pelanggan  : buka /menu di tablet kiosk → pilih produk → /cart → /checkout
2. Pembayaran : bayar via Midtrans Snap (stub) → webhook / manual-verify fallback
               → settlement ke Olsera → jurnal audit tercatat → broadcast Pusher
3. Dapur      : KDS Barista & Kitchen terima order real-time → proses → tandai selesai
               (tiap klik tercatat di jurnal audit dengan actorId staff)
4. Pelanggan  : /success (nomor antrian, struk auto-print) → /status (progress real-time)
               → ambil pesanan di counter
5. Selesai    : order jadi COMPLETED kalau kedua stasiun (barista+kitchen) selesai,
               atau CANCELLED kalau pembayaran gagal/expired
```

## 6. Requirement Non-Fungsional

- **Auditability**: semua mutasi status harus tercatat, tidak boleh menggagalkan flow utama kalau pencatatan gagal (fail-open untuk jurnal, fail-closed untuk otorisasi webhook).
- **Realtime**: perubahan order harus sampai ke KDS dalam hitungan detik (Pusher, bukan cuma polling).
- **Resilient terhadap race condition**: order yang dibuat sistem lain (mis. webhook Olsera duluan) tidak boleh menghasilkan data ganda/hilang di KDS.
- **Device target**: tablet iPad gen 11 A16, landscape, browser Safari — semua UI kiosk harus jalan mulus di kondisi ini (`min-h-dvh`, no `background-attachment: fixed`, viewport locked no-zoom).
- **Keamanan dasar**: webhook eksternal (Olsera) wajib fail-closed di production kalau secret tidak diset. Halaman staff (KDS/admin) wajib auth.

## 7. Keputusan Arsitektur Printer (Zero Local Server)

**Konteks masalah:** printer thermal butuh koneksi fisik dari *sesuatu* di outlet. Kalau pakai PC/server lokal sebagai jembatan (seperti `print-bridge` sekarang), berarti ada 1 device pusat yang harus selalu nyala & dijaga — ini yang ingin dihindari.

**Opsi yang sudah dieksplorasi & ditolak:**
- Cloud printer resmi (Epson OmniLink/Server Direct Print, Star CloudPRNT) → secara teknis paling bersih (printer connect langsung ke cloud, server kirim print job tanpa perantara), tapi **tidak ada distributor resmi di Indonesia** (hanya jalur impor, tanpa garansi lokal) dan modelnya jauh lebih mahal.
- App native/hybrid (Capacitor.js) untuk akses printer via Bluetooth langsung dari tablet → butuh Mac (Xcode) + Apple Developer Program ($99/tahun) untuk distribusi permanen ke iPad, dan iOS mensyaratkan sertifikasi MFi untuk perangkat Bluetooth SPP agar reliable — kompleksitas & biaya tidak sepadan.
- Browser buka koneksi TCP/Bluetooth langsung ke printer dari tablet → **tidak mungkin secara teknis**, Safari/WebKit (wajib dipakai semua browser iOS) tidak punya akses raw socket/Web Bluetooth/Web Serial.

**Keputusan final:** **Port-forwarding router + DDNS**.
- Beli printer thermal biasa yang punya **LAN/WiFi built-in** (tidak perlu "cloud"-branded, tidak perlu OmniLink) — printer existing (QPOS EPM58UB) tidak dipakai untuk jalur ini karena cuma USB+Bluetooth.
- Set IP statis lokal untuk printer, lalu router outlet di-setting **port forwarding** (port custom non-standar → IP printer:9100) + daftar hostname **DDNS gratis** (DuckDNS/No-IP) untuk menghadapi IP publik dinamis.
- Server Next.js (Vercel) mengirim raw ESC/POS langsung ke `hostname.duckdns.org:port` lewat internet — **tidak ada device fisik tambahan** di outlet selain router (yang memang sudah ada) dan printer itu sendiri.
- Karena yang melakukan koneksi ke printer adalah **server**, bukan tablet/browser, semua batasan browser (poin di atas) otomatis tidak relevan — kiosk tetap web app biasa, tidak perlu jadi native/hybrid app.
- Level keamanan yang dipilih: **Level A (simpel)** — port custom sebagai proteksi dasar saja, bukan VPN tunnel (Level B, lebih aman tapi lebih ribet setup-nya). Resiko diterima karena printer adalah perangkat pasif (paling buruk kalau disalahgunakan: kertas struk terbuang, bukan kebocoran data).

## 8. Yang Belum Selesai / Roadmap

| Item | Status | Catatan |
|---|---|---|
| Pembayaran final (EDC + API bank Mandiri) | Belum, Midtrans masih stub testing | Menunggu kejelasan dari Mandiri: integrasi cloud/API vs butuh device fisik per tablet (lihat [`reference/BRIEF-EDC.md`](reference/BRIEF-EDC.md)) |
| Printer LAN/WiFi + port forwarding | Belum, arsitektur sudah diputuskan (§7) | Menunggu user beli printer baru berLAN/WiFi, lalu setup router + DDNS + endpoint kirim raw print baru di server |
| Multi-printer routing (nota + label stiker) | Belum, baru dibahas | 3 tablet order + printer stiker gelas di barista & kitchen (protokol kemungkinan TSPL/ZPL, beda dari ESC/POS nota) — butuh kolom `station`/`printerTarget` di `PrintJob` |
| EDC per tablet order | Belum, tergantung hasil klarifikasi Mandiri | Kalau EDC butuh pairing device fisik, ini kasus terpisah dari printer (EDC kemungkinan besar tetap butuh sesuatu di lokasi) |
| SLA/wait-time indicator di KDS | Belum, ide dari perbandingan kompetitor (iSeller) | Nice-to-have |
| Dine-in vs takeaway | Belum diputuskan | Tergantung apakah RAKKEN outlet ini punya seating dine-in |

## 9. Di Luar Scope (Sengaja Tidak Dikerjakan Sekarang)

- Redesign UX halaman `/success` (polling existing dianggap cukup, bukan bug).
- Migrasi penuh dari Midtrans ke EDC (menunggu keputusan bisnis/teknis dari pihak bank).
- VPN tunnel (Level B) untuk printer — sengaja dipilih opsi simpel dulu.

## 10. Referensi Dokumen Terkait

| Dokumen | Isi |
|---|---|
| [`architecture/SYSTEM-DESIGN.md`](architecture/SYSTEM-DESIGN.md) | Arsitektur teknis & design system UI |
| [`sprint/PLAN.md`](sprint/PLAN.md) | Blueprint teknis awal per layer (Next.js, Prisma, Redis, dst) |
| [`sprint/SPRINT_AUDIT.md`](sprint/SPRINT_AUDIT.md) | Progress aktual vs rencana, per sprint |
| [`guides/PRINT-BRIDGE.md`](guides/PRINT-BRIDGE.md) | Cara kerja print bridge & cloud print queue saat ini |
| [`guides/SETUP-DEVICE.md`](guides/SETUP-DEVICE.md) | Setup device fisik (tablet, KDS, printer, jaringan) |
| [`reference/BRIEF-EDC.md`](reference/BRIEF-EDC.md) | Riset integrasi EDC bank |
| [`reference/APP_ROUTES.md`](reference/APP_ROUTES.md) | Daftar route aplikasi |
