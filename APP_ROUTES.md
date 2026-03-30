# 🗺️ Dokumentasi Arsitektur Route & Path Rakken Coffee POS

Proyek ini dibangun menggunakan **Next.js 14 (App Router)**. Terdapat tiga "dunia" utama di dalam aplikasi ini: **Kiosk (Pelanggan)**, **Kitchen (KDS/Dapur)**, dan **Admin (Backoffice)**, serta satu buah jembatan API untuk melayani semuanya.


---

## 1. 📱 KIOSK APP ROUTES (Untuk Pelanggan)
Berada di dalam folder `src/app/(kiosk)/`. Semua halaman ini dirancang untuk layar sentuh beresolusi tinggi (Vertical/Portrait) tanpa login.

| URL Path | Nama File Valid | Deksripsi & Alur |
| --- | --- | --- |
| `/` | `(kiosk)/page.tsx` | **Halaman Utama / Welcome Screen.** Menampilkan layar ucapan selamat datang. Pelanggan menyentuh layar ("Dine In" / "Take Away") untuk memulai pesanan. |
| `/menu` | `(kiosk)/menu/page.tsx` | **Katalog Menu.** Mengambil `GET /api/menu` dan `/api/categories`. Menampilkan semua produk dari Olsera. Jika user klik produk, akan muncul popup *CustomizeModal* untuk ukuran, gula, es, dan *addons* khusus. |
| `/cart` | `(kiosk)/cart/page.tsx` | **Keranjang Belanja.** Tempat pelanggan mengedit pesanan (tambah/kurang kuantitas). Terhubung langung dengan *React Context* (`CartContext.tsx`). |
| `/checkout` | `(kiosk)/checkout/page.tsx` | **Halaman Pembayaran.** Meminta nama pelanggan, memanggil API `POST /api/payment/create` untuk men-generate token Midtrans, lalu memunculkan sistem *Snap Payment Gateway*. |
| `/success` | `(kiosk)/success/page.tsx` | **Sukses Pembayaran.** Halaman terakhir yang menginformasikan bahwa pembayaran berhasil ditarik dan pesanan telah diteruskan ke dapur. (Membawa *search param* `?orderId=...`). |
| `/status` | `(kiosk)/status/page.tsx` | **Layar Status Antrean.** Bisa ditampilkan di TV menghadap pelanggan untuk melihat nomor antrean mana yang "Sedang Disiapkan" (Preparing) dan "Bisa Diambil" (Ready). Berlangganan event SSE (Server-Sent Events) dari `/api/orders/stream`. |

**ALUR KIOSK:** `/` 👉 `/menu` 👉 Popup Customize 👉 `/cart` 👉 `/checkout` 👉 Midtrans Snap 👉 `/success`.

---

## 2. 🍳 KITCHEN DISPLAY SYSTEM / KDS (Untuk Barista)
Berada di dalam folder `src/app/(kds)/`. Digunakan oleh Barista di dapur (biasanya dengan layar Landscape/Tablet).

| URL Path | Nama File Valid | Deksripsi & Alur |
| --- | --- | --- |
| `/kitchen` | `(kds)/kitchen/page.tsx` | **Dashboard Dapur.** Menarik daftar pesanan yang statusnya `PENDING` atau `PREPARING`. <br/><br/>Barista membaca tiket (termasuk catatan seperti Addon, Sugar Level, Ice Level). <br/><br/>Alur Tombol: <br/>1. Klik "Mulai Proses" → Berubah menjadi *Preparing* <br/>2. Klik "Selesai" → Berubah menjadi *Ready* (Muncul di layar `status` milik pelanggan). |

---

## 3. 👨‍💻 ADMIN BACKOFFICE (Manajemen Lokal)
Berada di dalam folder `src/app/(admin)/`. Digunakan oleh Manajer/Owner. 

| URL Path | Nama File Valid | Deksripsi & Alur |
| --- | --- | --- |
| `/admin` | `(admin)/admin/page.tsx` | **Halaman Login Admin.** Untuk menjaga keamanan (meskipun tanpa *auth* kompleks, di sini titik masuknya). |
| `/admin/dashboard` | `(admin)/admin/dashboard/page.tsx` | **Panel Kendali.** Menampilkan: <br/>- Statistik Penjualan hari ini. <br/>- Sinkronisasi Menu (Refresh paksa database PRISMA dengan Olsera). <br/>- Mengedit status produk lokal (opsional). |

---

## 4. 🔌 REST API ENDPOINTS (Back-End)
Semua rute API ini merespons dengan JSON (tanpa antarmuka visual). Berada di bawah `src/app/api/`.

### 📚 Menu & Sinkronisasi
| Endpoint | Method | Deskripsi |
| --- | --- | --- |
| `/api/categories` | `GET` | Memanggil Adapter (`pos.adapter.ts`), lalu menarik data Kategori Produk secara dinamis dari **Olsera Open API**. |
| `/api/menu` | `GET` | Menarik daftar menu (Katalog) dari **Olsera API**. Terdapat sistem *parameter URL* untuk *search* dan filter (`?category=...&search=...`). |
| `/api/menu/[id]` | `PUT` / `DELETE` | Digunakan Admin untuk operasi CRUD Database Lokal (Jika Olsera dimatikan). |
| `/api/toppings` | `GET`| Menarik daftar topping standar (Meskipun kini topping digantikan dengan *hardcode React Logic*). |

### 💱 Sistem Transaksi (Order & Pembayaran)
| Endpoint | Method | Deskripsi |
| --- | --- | --- |
| `/api/payment/create` | `POST` | **Jantung Pembayaran.** Menerima total keranjang, menembak server *Midtrans* diam-diam, dan merespons "*Snap Token*" ke klien. |
| `/api/payment/webhook` | `POST` | **Jalur Notifikasi Midtrans.** Setelah Midtrans sukses menagih saldo GoPay/QRIS pelanggan, server Midtrans akan mengetuk *Endpoint* ini. Lalu webhook ini akan memicu `/api/orders` (Olsera Sinkronisasi). |
| `/api/orders` | `GET` | Mendapatkan rekapan Database Order hari ini (digunakan oleh Admin Dashboard dan Kitchen). |
| `/api/orders` | `POST` | Menyimpan order ke **Database Prisma Lokal** dan meneruskan/membuat *Open Order* di **Olsera POS** via `olsera.service.ts` agar Struk Penjualannya legal. |
| `/api/orders/[id]`| `PATCH`| Digunakan Barista di `/kitchen` untuk mengubah progress order (`PENDING` -> `PREPARING` -> `READY`). |
| `/api/orders/stream` | `GET` | **Socket Event.** Membuka terowongan real-time. Jika status order di-*update* Barista, layar Kiosk `/status` akan otomatis berubah tanpa *refresh*. |

---

## 🛠️ Peta Jalan Arsitektur (The Flow)

```text
[📱 PELANGGAN DI KIOSK]
       │
     (Klik Pesan)
       ▼
[Menyusun Cart di /menu & /cart] ──▶ (React Context State Lokal)
       │
     (Pay / Checkout)
       ▼
[Minta Token ke /api/payment/create] ──▶ ✨ MIDTRANS BALAS TOKEN
       │
     (Scan QRIS di Layar Pop-Up)
       ▼
[MIDTRANS MENAGIH UANG PELANGGAN]
       │
     (Saldo Sukses Terpotong)
       ▼
[MIDTRANS Mengirim Webhook Rahasia] ──▶ /api/payment/webhook (Backend)
                                                │
                                            (Validasi OK)
                                                ▼
                                    [Memanggil POST /api/orders]
                                     ├──▶ 1. Simpan Transaksi di Database Lokal (Prisma)
                                     ├──▶ 2. Notifikasi SSE ke Layar Dapur (/kitchen)
                                     └──▶ 3. Tembak Data Order ke Server OLSERA (Unpaid)
                                                │
                                    [👨‍🍳 BARISTA MELIHAT TIKET MASUK]
                                                │
                                    (Barista Buat Kopi & Tekan Selesai)
                                                ▼
[🎉 PESANAN SELESAI & KASIR MENYELESAIKAN DI TABLET OLSERA TOKO]
```
