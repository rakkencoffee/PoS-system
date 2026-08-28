# Brief Status Sistem RAKKEN Kiosk PoS — 26 Agustus 2026

> Dokumen ini dibuat buat didiskusikan dengan agent/AI lain. Isinya rangkuman kondisi terkini 3 topik besar yang lagi jalan: **arsitektur printer**, **integrasi EDC Yokke**, dan **hasil review kode/performa sistem**.

## Konteks Sistem

- **Stack**: Next.js (Vercel) + Prisma + PostgreSQL (Neon) + TanStack React Query + Dexie (IndexedDB, offline cache) + Pusher (realtime) + integrasi Olsera POS.
- **Device kiosk**: 3 unit **iPad (iOS)**, masing-masing di 1 station (A/B/C), akses via **browser (web app)**, BUKAN aplikasi native.
- **Repo**: `C:\Users\Lenovo\Downloads\Start Friday Asia\PoS-system`.
- Developer: solo (user sendiri, StartFriday).

---

## 1. Arsitektur Printer — Status & Keputusan

### Masalah inti
Printer struk (iWare D260WF, WiFi/ESC-POS biasa, **bukan** cloud-printer) butuh dikirimin data raw TCP ke port 9100. Awalnya direncanakan server (Vercel) kirim langsung ke printer via internet ("Opsi A" / direct print — kode-nya **sudah ada dan tervalidasi**: `src/lib/print/direct-print.ts` + `format-receipt.ts`, tinggal isi `STATION_PRINTER_MAP` env var per station).

### Kenapa Opsi A (direct print via internet) belum bisa jalan
- **Jaringan rumah user**: kena **CGNAT** — WAN IP router-nya sendiri `10.115.82.124` (privat), padahal IP yang kelihatan dari luar (`182.8.97.206`) kelihatan kayak publik. ISP nge-share 1 IP publik ke banyak pelanggan pakai rentang privat non-standar (`10.x`, bukan rentang resmi CGNAT `100.64.0.0/10`). **Port forwarding gak akan pernah bisa jalan** di jaringan ini, ini fakta jaringan bukan salah konfigurasi.
- **Jaringan kantor StartFriday (WiFi utama, V-SOL router)**: WAN IP `101.128.83.186` — **ini IP publik asli** (dikonfirmasi cocok dengan hasil cek `ifconfig.me` dari device yang sama). TAPI: router V-SOL model **V2802DAC** yang dipakai, akun login `"user"` (bukan admin), **sama sekali gak punya menu Port Forwarding/NAT/Virtual Server/DMZ** di UI-nya (sudah ditelusuri semua tab: Status, Network, Security, Management — nihil). Ada indikasi firmware-nya support **mode Bridge** (disebut di halaman MAC Filtering: "MAC filtering in bridge mode is not supported"), tapi toggle-nya gak ada di akun user, kemungkinan dikunci ISP/dikontrol via TR-069.
  - **Status**: sudah kirim pertanyaan ke ISP kantor, minta salah satu dari 2 hal — (a) port forwarding dibukain dari sisi mereka, atau (b) diubah ke mode Bridge biar bisa pasang router sendiri di belakangnya. **Menunggu balasan.**

### Masalah baru yang lebih fundamental: iPad gak bisa jadi relay
Sempat dibahas alternatif "0 device tambahan" — daemon `print-bridge` yang sudah ada & tervalidasi (polling ke Vercel, forward lokal ke printer) dijalankan LANGSUNG di device kiosk itu sendiri (bukan device terpisah). Ini **gagal** khusus buat iPad, karena:
- iPadOS **tidak mengizinkan aplikasi pihak ketiga jalan sebagai background service/daemon** yang buka koneksi jaringan terus-terusan — beda dari Windows/Android yang bisa.
- Safari/WebKit (browser kiosk-nya) juga **tidak bisa buka raw TCP socket** langsung ke printer dari JavaScript.

**Kesimpulan yang disepakati**: karena device-nya iPad, **wajib ada 1 device relay kecil terpisah** di jaringan lokal outlet (bukan laptop/PC mahal — cukup Raspberry Pi Zero 2 W ~Rp300-500rb, atau HP Android bekas via Termux). Device ini yang jalanin daemon `print-bridge` (manggil KELUAR ke Vercel via polling — imun CGNAT/NAT apapun kondisi ISP-nya), lalu forward ke printer secara lokal. **1 unit relay cukup buat 3 printer sekaligus** (gak perlu 1 device per station), asal semua di WiFi outlet yang sama.

### Yang sudah tervalidasi dari sisi kode (gak tergantung hasil ISP)
- Pipeline end-to-end (iPad → server → cloud queue → daemon `print-bridge` → printer) **sudah full berhasil ditest** pakai `virtual-printer.js` (simulator printer via TCP) di beberapa sesi sebelumnya.
- Server sudah support **dual-mode otomatis**: kalau station ada di `STATION_PRINTER_MAP`, server langsung direct-print (skip daemon); kalau enggak, fallback ke daemon lokal. Gak perlu ubah kode lagi buat pindah mode.
- `DAEMON_STATIONS` env var filter (biar 1 daemon test gak "nyolong" print job station lain) sudah diimplementasi & tervalidasi di production, **tapi belum di-commit ke git** (masih modified di working tree).

### Belum selesai / pending
- Beli device relay fisik (Raspberry Pi/Android bekas) buat produksi.
- Fix race condition duplicate print job (2 jalur bikin `PrintJob` bisa lolos dedup check `findFirst` yang gak atomic — sekarang minimal udah ke-routing ke station yang benar, tapi masih berpotensi cetak 2x kalau race kejadian). User belum minta ini difix.
- Aktifin auto-cutter ESC/POS (`CUT_PARTIAL`/`CUT_FULL`, masih di-comment-out) begitu unit fisik iWare D260WF beneran dipakai buat validasi command-nya.
- Push 2 commit lokal yang ditahan (`47feb6f` direct-print, `6c0adc7` DAEMON_STATIONS fix) + commit perubahan `print-bridge/src/index.js` yang belum ke-commit sama sekali.
- Tunggu balasan ISP kantor (port-forward atau bridge mode).

---

## 2. Integrasi Payment — EDC via Yokke

### Pivot penting
Rencana lama (di `docs/reference/BRIEF-EDC.md`) asumsinya EDC **bank-issued terkunci** (Verifone X990 dari BRI/dst) — kesimpulannya cuma bisa jalur manual: kasir input nominal sendiri di EDC + ketik approval code balik ke sistem. **Ini sudah tidak relevan.**

Sekarang user lagi proses kerja sama dengan **Yokke**, target: pembayaran **full lewat mesin EDC**, sistem (POS) yang **mengirim pesan pembayaran ke mesin EDC** secara terprogram (bukan manual key-in).

### Hasil tanya-jawab dengan pihak Yokke (by user, 2026-08-26)
Pertanyaan yang diajukan: apakah integrasi dari sistem web-based (iPad browser) ke EDC itu butuh sesuatu yang diinstall.

**Jawaban Yokke**: *"Untuk yang punya kita harus ada yg diinstall ya pak, karena itu jembatan komunikasi antara POS dan EDC."* Lalu ditanya lebih lanjut soal teknis install-nya (karena sistem berbasis web di iPad), dijawab: *"biasanya akan ada tambahan aplikasi khusus dari web ke aplikasi kita pak, namun itu dari sisi POS yg kembangkan sesuai dgn spek ECR kita."*

### Artinya secara teknis
- Integrasi POS↔EDC Yokke **bukan** pola cloud-to-cloud sederhana (server kita panggil API mereka dari internet tanpa perlu apa-apa lagi).
- Butuh **aplikasi jembatan custom**, yang **dikembangkan sendiri oleh sisi POS** (bukan disediakan jadi oleh Yokke), mengikuti dokumen spesifikasi teknis yang mereka sebut **"spek ECR"** (ECR = Electronic Cash Register, istilah standar industri buat sisi kasir dalam integrasi ke terminal pembayaran — biasanya berisi format pesan & protokol komunikasi, umum lewat TCP/IP di jaringan lokal atau serial).
- **Belum jelas** apakah aplikasi jembatan ini wajib jalan di device yang sama dengan EDC-nya (LAN lokal outlet) atau bisa remote — ini baru bisa dijawab pasti setelah baca dokumen spek ECR-nya.

### Next step
- **Minta dokumen spesifikasi ECR** dari Yokke — ini blocker utama, belum ada di tangan. Tanpa dokumen ini gak bisa mulai desain/estimasi implementasi.
- Setelah dokumen didapat: pelajari protokol & transport-nya (TCP/IP? Serial? Lewat jaringan lokal outlet atau bisa remote?), baru bisa dinilai kompleksitas & apakah bisa reuse pola arsitektur yang mirip printer (device relay lokal) atau perlu pendekatan lain sama sekali.

---

## 3. Hasil Review Kode & Performa (TanStack Query, dkk)

Ditelusuri langsung file: `QueryProvider.tsx`, `useMenu.ts`, `useOrders.ts`, `useOnlineStatus.ts`, `dexie.ts`, `pusher.ts`, `schema.prisma`, `print-jobs/route.ts`.

### Yang sudah bagus
1. **Hybrid Pusher (realtime) + polling (`refetchInterval: 30000` sebagai safety-net)** di KDS orders — desain yang tepat buat POS, gak ada order yang "senyap ilang" kalau websocket putus.
2. **Optimistic update + rollback** (`onMutate`/`onError`) di update status order, plus **status-weight guard** (`STATUS_WEIGHTS`) buat cegah race condition antara update optimistic, response server, dan event Pusher yang datang gak berurutan.
3. **Dexie (IndexedDB) sebagai offline fallback** buat menu/kategori/order KDS — tablet tetap nunjukin data terakhir kalau internet outlet putus sesaat.
4. **`staleTime` di-tuning per jenis data** (5 detik buat order, Infinity buat payment config, 5 menit default) — nunjukin pemahaman React Query yang matang.
5. **Index Prisma sudah pas** sama pola query asli (`Order` di-index `stationId+createdAt`/`status`, `PrintJob` di-index `status`).
6. **Pusher client singleton** — gak ada resiko bocor koneksi socket.
7. Server sudah punya jalur `tryDirectPrint` yang otomatis skip daemon kalau station ada di `STATION_PRINTER_MAP` — arsitektur dual-mode print sudah siap tanpa perlu ubah kode lagi.

### Temuan (perlu tindakan)
1. **Rate limiter didefinisikan tapi gak pernah dipakai** (`src/lib/redis.ts` → `ratelimit`, dead code). Endpoint publik `/api/payment/create` dan `/api/print-jobs` (POST) **tidak ada proteksi spam/abuse sama sekali** — siapa saja yang tau endpoint-nya (gampang dilihat lewat DevTools) bisa script-spam bikin order/print job palsu. **Fix-nya gampang** (15-30 menit), tinggal wire yang udah ada.
2. **XOR "encryption" di Dexie (`xorEncrypt`/`xorDecrypt`) bukan enkripsi beneran** — key statis (`OFFLINE_STORAGE_SECRET`) ke-bundle plain-text di JS yang dikirim ke browser, gampang dibalikin siapa aja yang buka DevTools. Resiko rendah buat data kayak nama customer/item order kiosk kopi, tapi kalau ada klaim "data terenkripsi" ke pihak lain, klaim itu gak akurat.
3. **Duplicate print job race condition** — sudah ketemu, belum diperbaiki (lihat bagian Printer di atas).
4. **Audit trail `OrderStatusLog`** sudah lengkap diimplementasi tapi **gak pernah ditampilkan di UI manapun** — effort ada, belum ditarik manfaatnya.
5. **Testing belum pernah dicoba** buat: skenario voucher diskon 100%, order gagal bayar, webhook Olsera langsung (bukan lewat verify manual).

### Verdict umum
Implementasi TanStack Query & arsitektur offline-resilience-nya **solid buat skala 1 outlet, 3 station** — gak over-engineered, gak juga naif. Perlu diawasi kalau nanti scale ke banyak outlet dalam 1 database (volume polling & tabel yang gak pernah di-purge).

---

## Ringkasan Prioritas Kerjaan

| # | Item | Blocker? | Effort |
|---|---|---|---|
| 1 | Wire rate limiter ke endpoint publik | Tidak | Kecil (~30 menit) |
| 2 | Tunggu balasan ISP kantor (port-forward/bridge mode) | Ya, nunggu pihak luar | - |
| 3 | Beli & setup device relay fisik (Raspberry Pi/Android bekas) buat printer | Tidak, bisa jalan duluan | Sedang |
| 4 | Minta dokumen spek ECR dari Yokke | Ya, blocker integrasi EDC | - |
| 5 | Push commit yang ditahan + commit perubahan `print-bridge` yang belum ke-commit | Tidak | Kecil |
| 6 | Fix race condition duplicate print job | Tidak, opsional | Sedang |
| 7 | Aktifin auto-cutter (nunggu unit fisik) | Ya, nunggu hardware | Kecil |
| 8 | Testing skenario belum tercoba (voucher 100%, gagal bayar, webhook langsung) | Tidak | Sedang |

