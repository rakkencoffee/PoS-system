# 📋 SETUP-DEVICE.md — Panduan Setup Perangkat POS Rakken Coffee

> **Dokumen ini berisi panduan lengkap dari NOL untuk menyiapkan seluruh perangkat sistem POS Kiosk Rakken Coffee.**
> Ditujukan untuk staff IT / teknisi agar proses setup di outlet baru dapat dilakukan secara mandiri.

---

## Daftar Isi

1. [Arsitektur Sistem](#1-arsitektur-sistem)
2. [Langkah 1: Setup Server Cloud (Vercel)](#2-langkah-1-setup-server-cloud-vercel)
3. [Langkah 2: Setup PC Kasir Utama (Host Printer)](#3-langkah-2-setup-pc-kasir-utama-host-printer)
   - [Opsi A: Printer via USB](#opsi-a-printer-via-usb)
   - [Opsi B: Printer via Bluetooth](#opsi-b-printer-via-bluetooth)
4. [Langkah 3: Setup Tablet / Laptop Kiosk](#4-langkah-3-setup-tablet--laptop-kiosk)
5. [Verifikasi & Troubleshooting](#5-verifikasi--troubleshooting)

---

## 1. Arsitektur Sistem

Sistem POS ini terdiri dari **3 komponen utama** yang saling terhubung melalui internet:

```
┌─────────────────────────────────────────────────────────┐
│                   ☁️  CLOUD (Vercel)                     │
│                                                         │
│   Next.js App  ←→  Database PostgreSQL (Neon)           │
│   https://menu.rakkencoffee.com                         │
│                                                         │
│   Fungsi:                                               │
│   • Menyajikan halaman web kiosk untuk pelanggan        │
│   • Menyimpan antrian cetak struk (PrintJob)            │
│   • Sinkronisasi order ke Olsera POS                    │
└────────────┬──────────────────────┬─────────────────────┘
             │ HTTPS                │ HTTPS
             ▼                      ▼
┌────────────────────┐   ┌────────────────────────────────┐
│  📱 TABLET KIOSK    │   │  🖥️  PC KASIR UTAMA             │
│                    │   │                                │
│  Browser Chrome    │   │  Print Bridge (daemon)         │
│  WiFi / Internet   │   │  ↓ polling setiap 3 detik     │
│                    │   │  🧾 Printer Thermal (USB/BT)   │
│  Fungsi:           │   │  💳 Mesin EDC (opsional)       │
│  • Pelanggan pesan │   │                                │
│  • Pilih menu      │   │  Fungsi:                       │
│  • Bayar           │   │  • Mencetak struk otomatis     │
│  • Kirim ke cloud  │   │  • Proses pembayaran EDC       │
└────────────────────┘   └────────────────────────────────┘
```

**Penting:** Tablet dan PC Kasir **tidak perlu** berada di jaringan WiFi yang sama. Keduanya berkomunikasi melalui server cloud.

---

## 2. Langkah 1: Setup Server Cloud (Vercel)

> Langkah ini hanya dilakukan **sekali** saat pertama kali men-deploy aplikasi ke internet. Jika aplikasi sudah live di `https://menu.rakkencoffee.com`, langkah ini bisa dilewati.

### 2.1 Prasyarat

- Akun [Vercel](https://vercel.com) (gratis / Hobby plan)
- Akun [Neon](https://neon.tech) untuk database PostgreSQL (gratis)
- Repository GitHub berisi source code project `pos-system`

### 2.2 Deploy ke Vercel

1. Login ke [vercel.com](https://vercel.com).
2. Klik **"Add New Project"**.
3. Pilih repository GitHub `pos-system`.
4. Vercel akan otomatis mendeteksi bahwa ini project Next.js.
5. Klik **Deploy** dan tunggu hingga selesai.
6. Setelah berhasil, Vercel memberikan URL seperti `pos-system-xxx.vercel.app`.

### 2.3 Konfigurasi Custom Domain (Opsional)

1. Di dashboard Vercel, masuk ke **Settings > Domains**.
2. Tambahkan domain `menu.rakkencoffee.com`.
3. Ikuti instruksi Vercel untuk mengatur DNS (biasanya menambah CNAME record di registrar domain Anda).

### 2.4 Konfigurasi Environment Variables

Di dashboard Vercel, masuk ke **Settings > Environment Variables**, lalu tambahkan variabel berikut:

| Variable | Contoh Nilai | Keterangan |
|----------|-------------|------------|
| `DATABASE_URL` | `postgresql://user:pass@host/db?sslmode=require` | Connection string Neon PostgreSQL |
| `DIRECT_DATABASE_URL` | *(sama dengan di atas)* | Direct connection untuk Prisma |
| `NEXT_PUBLIC_BASE_URL` | `https://menu.rakkencoffee.com` | URL publik aplikasi |
| `AUTH_SECRET` | `sf_pos_secret_random-string` | Secret key untuk autentikasi |
| `NEXT_PUBLIC_PRINT_BRIDGE_API_KEY` | `rakken-print-bridge-secret-key-123` | Shared key antara cloud & PC kasir |
| `OLSERA_WEBHOOK_SECRET` | `rakken-olsera-webhook-secret-key-9988` | Key verifikasi webhook Olsera |
| `OLSERA_APP_ID` | *(dari dashboard Olsera)* | Kredensial API Olsera |
| `OLSERA_SECRET_KEY` | *(dari dashboard Olsera)* | Kredensial API Olsera |
| `UPSTASH_REDIS_REST_URL` | *(dari dashboard Upstash)* | URL Redis untuk rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | *(dari dashboard Upstash)* | Token Redis |
| `QSTASH_TOKEN` | *(dari dashboard Upstash)* | Token QStash untuk background jobs |
| `PUSHER_APP_ID` | *(dari dashboard Pusher)* | Realtime updates (KDS) |
| `NEXT_PUBLIC_PUSHER_KEY` | *(dari dashboard Pusher)* | Public key Pusher |
| `PUSHER_SECRET` | *(dari dashboard Pusher)* | Secret Pusher |

> **Catatan:** Pastikan variabel `NEXT_PUBLIC_PRINT_BRIDGE_API_KEY` di Vercel **identik** dengan yang dikonfigurasi di PC Kasir. Jika berbeda, Print Bridge daemon tidak akan bisa mengambil antrian cetak.

### 2.5 Sinkronisasi Database

Setelah environment variables terkonfigurasi, jalankan migrasi database:

```bash
# Di komputer developer (bukan di Vercel)
cd pos-system
npx prisma db push
```

Ini akan membuat semua tabel yang diperlukan di database Neon PostgreSQL termasuk tabel `PrintJob` untuk antrian cetak cloud.

---

## 3. Langkah 2: Setup PC Kasir Utama (Host Printer)

> PC Kasir adalah komputer Windows yang terhubung langsung ke printer thermal. Program **Print Bridge** berjalan di PC ini sebagai background service yang otomatis menarik antrian cetak dari cloud dan mengirimkannya ke printer.

### 3.1 Prasyarat (Wajib untuk Kedua Opsi)

1. **Komputer Windows** (Windows 10/11) dengan koneksi internet stabil.
2. **Printer Thermal 58mm** — Contoh: RPP02N, QPOS EPM58UB, atau printer ESC/POS compatible lainnya.
3. **Node.js** versi 18 atau lebih baru.

### 3.2 Install Node.js

1. Buka browser, akses [https://nodejs.org](https://nodejs.org).
2. Download versi **LTS** (Long Term Support) — tombol hijau besar.
3. Jalankan installer, klik **Next** terus hingga selesai.
4. Verifikasi instalasi — buka **Command Prompt** atau **PowerShell**, ketik:
   ```
   node --version
   ```
   Jika muncul `v18.x.x` atau lebih baru, instalasi berhasil.

### 3.3 Download & Install Print Bridge

1. Copy folder `print-bridge` dari project ke PC Kasir. Anda bisa:
   - Copy via USB flashdisk dari komputer developer, **atau**
   - Clone repository: `git clone <repo-url>`, lalu masuk ke folder `print-bridge`.

2. Buka **Command Prompt** atau **PowerShell** di folder `print-bridge`:
   ```
   cd C:\path\ke\print-bridge
   ```

3. Install dependensi:
   ```
   npm install
   ```
   Tunggu hingga selesai (mungkin 1-2 menit).

---

### Opsi A: Printer via USB

#### A1. Hubungkan Printer

1. **Nyalakan** printer thermal.
2. Sambungkan kabel USB dari printer ke PC Kasir.
3. Windows biasanya akan otomatis mengenali printer dan menginstall driver.

#### A2. Cari Nomor COM Port

1. Klik kanan tombol **Start** → pilih **Device Manager**.
2. Expand bagian **Ports (COM & LPT)**.
3. Cari nama printer Anda, misalnya:
   ```
   USB-SERIAL CH340 (COM3)
   ```
   Catat nomor COM-nya (contoh: **COM3**).

> **Tidak muncul?** Jika printer tidak muncul di Device Manager:
> - Coba cabut dan colok ulang kabel USB.
> - Download dan install driver CH340/CH341 dari: [https://www.wch-ic.com/downloads/CH341SER_EXE.html](https://www.wch-ic.com/downloads/CH341SER_EXE.html)
> - Restart PC setelah install driver, lalu cek ulang Device Manager.

#### A3. Konfigurasi File `.env`

Buka file `.env` di dalam folder `print-bridge` menggunakan Notepad, lalu isi:

```env
PORT=3001
PRINTER_PORT=COM3
BAUD_RATE=9600

# Konfigurasi Cloud
CLOUD_API_URL=https://menu.rakkencoffee.com
NEXT_PUBLIC_PRINT_BRIDGE_API_KEY=rakken-print-bridge-secret-key-123
CLOUD_POLLING_INTERVAL=3000

# EDC Config (kosongkan jika belum ada mesin EDC)
EDC_HOST=192.168.1.100
EDC_PORT=7000
```

> ⚠️ **Ganti `COM3`** dengan nomor COM port yang Anda temukan di Device Manager.

Lanjut ke **[Langkah 3.4: Jalankan Print Bridge](#34-jalankan-print-bridge-sebagai-background-service)**.

---

### Opsi B: Printer via Bluetooth

#### B1. Nyalakan & Pairing Printer

1. **Nyalakan** printer thermal Bluetooth (contoh: RPP02N).
2. Di PC Kasir Windows, buka **Settings > Bluetooth & devices**.
3. Pastikan Bluetooth dalam keadaan **ON**.
4. Klik **Add device** → pilih **Bluetooth**.
5. Tunggu hingga nama printer muncul (contoh: `RPP02N`), lalu klik untuk pairing.
6. Jika diminta PIN, masukkan `1234` atau `0000` (PIN default printer thermal pada umumnya).

#### B2. Cari Nomor COM Port Bluetooth

1. Di Settings Windows, cari **"Bluetooth settings"** di search bar.
2. Klik **More Bluetooth settings** (link kecil di bawah).
3. Akan muncul jendela **Bluetooth Settings** → klik tab **COM Ports**.
4. Cari baris dengan nama printer Anda:

   | Port | Direction | Name |
   |------|-----------|------|
   | COM7 | Outgoing | RPP02N 'SPP slave' |
   | COM8 | Incoming | RPP02N |

5. **Pilih yang `Outgoing`** — ini adalah port untuk mengirim data ke printer.
   Dalam contoh di atas: **COM7**.

> ⚠️ **Penting:** Selalu pilih port **Outgoing**, bukan Incoming. Port Incoming adalah untuk menerima data dari printer (tidak digunakan).

#### B3. Konfigurasi File `.env`

Buka file `.env` di dalam folder `print-bridge` menggunakan Notepad, lalu isi:

```env
PORT=3001
PRINTER_PORT=COM7
BAUD_RATE=9600

# Konfigurasi Cloud
CLOUD_API_URL=https://menu.rakkencoffee.com
NEXT_PUBLIC_PRINT_BRIDGE_API_KEY=rakken-print-bridge-secret-key-123
CLOUD_POLLING_INTERVAL=3000

# EDC Config (kosongkan jika belum ada mesin EDC)
EDC_HOST=192.168.1.100
EDC_PORT=7000
```

> ⚠️ **Ganti `COM7`** dengan nomor COM port Outgoing yang Anda temukan di langkah B2.

Lanjut ke **[Langkah 3.4: Jalankan Print Bridge](#34-jalankan-print-bridge-sebagai-background-service)**.

---

### 3.4 Jalankan Print Bridge sebagai Background Service

Agar Print Bridge **selalu berjalan di latar belakang** (bahkan setelah PC di-restart), kita menggunakan **PM2** — sebuah process manager untuk Node.js.

#### Install PM2

```bash
npm install -g pm2
```

#### Jalankan Print Bridge

```bash
cd C:\path\ke\print-bridge
pm2 start src/index.js --name "rakken-print-bridge"
```

Jika berhasil, akan muncul tabel seperti ini:

```
┌────┬────────────────────────┬──────┬────────┬───────────┐
│ id │ name                   │ pid  │ status │ cpu       │
├────┼────────────────────────┼──────┼────────┼───────────┤
│ 0  │ rakken-print-bridge    │ 3384 │ online │ 0%        │
└────┴────────────────────────┴──────┴────────┴───────────┘
```

#### Simpan Agar Otomatis Menyala Saat PC Restart

```bash
pm2 save
pm2 startup
```

> PM2 akan memberikan perintah tambahan yang perlu dijalankan. Copy-paste dan jalankan perintah tersebut.

#### Verifikasi Print Bridge Berjalan

Buka browser di PC Kasir, akses:
```
http://localhost:3001/health
```

Jika muncul respons JSON seperti ini, berarti Print Bridge sudah aktif:
```json
{
  "status": "ok",
  "printer": "COM7",
  "connected": true,
  "timestamp": "2026-05-21T06:30:00.000Z"
}
```

#### Test Cetak Struk

Untuk menguji apakah printer benar-benar bisa mencetak, jalankan:
```bash
cd C:\path\ke\print-bridge
npm run test-print
```

Jika printer mencetak struk percobaan, maka koneksi ke printer sudah benar.

---

### 3.5 Perintah PM2 yang Sering Digunakan

| Perintah | Fungsi |
|----------|--------|
| `pm2 list` | Lihat status semua proses |
| `pm2 logs rakken-print-bridge` | Lihat log realtime |
| `pm2 restart rakken-print-bridge` | Restart Print Bridge |
| `pm2 stop rakken-print-bridge` | Hentikan Print Bridge |
| `pm2 delete rakken-print-bridge` | Hapus dari PM2 |

---

## 4. Langkah 3: Setup Tablet / Laptop Kiosk

> Tablet kiosk diletakkan di area pelanggan agar mereka bisa memesan secara mandiri (self-service). Tidak perlu install aplikasi apapun — cukup menggunakan browser bawaan.

### 4.1 Prasyarat

- Tablet Android / iPad / Laptop dengan browser modern (Chrome, Safari, Edge).
- Koneksi WiFi / internet yang stabil.

### 4.2 Hubungkan ke Internet

1. Buka **Settings > WiFi** di tablet.
2. Sambungkan ke jaringan WiFi outlet (atau hotspot apapun yang tersedia).
3. Pastikan internet berfungsi dengan membuka situs apapun (contoh: google.com).

> **Catatan:** Tablet **tidak harus** terhubung ke WiFi yang sama dengan PC Kasir. Yang penting tablet bisa mengakses internet.

### 4.3 Buka Aplikasi POS

1. Buka browser **Chrome** (direkomendasikan) atau **Safari** (untuk iPad).
2. Ketik URL di address bar:
   ```
   https://menu.rakkencoffee.com
   ```
3. Halaman menu Kiosk akan muncul.
4. **(Opsional)** Tambahkan ke Home Screen:
   - **Android Chrome:** Tap titik tiga (⋮) > **"Add to Home screen"** > **Add**
   - **iPad Safari:** Tap ikon Share (⬆️) > **"Add to Home Screen"** > **Add**
   
   Ini membuat ikon shortcut di layar home tablet seperti aplikasi biasa.

### 4.4 Aktifkan Kiosk Mode (Mengunci Layar)

Agar pelanggan tidak bisa keluar dari aplikasi POS, browsing situs lain, atau mengubah settings, aktifkan mode kunci layar:

#### Untuk Android:

**Cara 1 — Pin App (Bawaan Android):**
1. Buka **Settings > Security > App pinning** (atau **Screen pinning**).
2. Aktifkan fitur ini.
3. Buka Chrome dengan URL POS.
4. Buka **Recent Apps** (tombol kotak / gesture swipe up).
5. Tap ikon Chrome di atas > pilih **Pin**.
6. Layar sekarang terkunci di Chrome. Untuk membuka kunci: tekan dan tahan tombol **Back + Recent Apps** bersamaan.

**Cara 2 — Fully Kiosk Browser (Rekomendasi untuk produksi):**
1. Download **Fully Kiosk Browser** dari Google Play Store.
2. Buka aplikasi, masukkan URL: `https://menu.rakkencoffee.com`
3. Masuk ke **Settings** di Fully Kiosk:
   - **Web Auto Reload** > ON (reload otomatis jika error)
   - **Kiosk Mode** > ON (sembunyikan navigation bar & status bar)
   - **Screen Saver** > Atur screensaver saat idle
   - **Maintenance Password** > Atur password agar staff bisa masuk ke settings
4. Kembali ke halaman utama. Tablet sekarang benar-benar terkunci sebagai kiosk.

#### Untuk iPad / iOS:

1. Buka **Settings > Accessibility > Guided Access**.
2. Aktifkan **Guided Access**.
3. Atur **Passcode** (PIN untuk keluar dari mode ini).
4. Buka Safari/Chrome dengan URL POS.
5. **Triple-click** tombol Home (atau tombol Power untuk iPad tanpa Home button).
6. Tap **Start** untuk mengaktifkan Guided Access.
7. Layar terkunci di aplikasi browser. Untuk keluar: **Triple-click** lagi > masukkan passcode > **End**.

### 4.5 Tips Penempatan Tablet

- Gunakan **tablet stand** atau **wall mount** yang kokoh agar tablet tidak mudah jatuh.
- Posisikan tablet di ketinggian yang nyaman untuk pelanggan (~120-140cm dari lantai).
- Sambungkan kabel charger secara permanen agar baterai tablet tidak habis.
- Pastikan layar tablet tidak menghadap jendela yang menerima sinar matahari langsung (mengurangi visibilitas layar).

---

## 5. Verifikasi & Troubleshooting

### 5.1 Checklist Verifikasi

Lakukan pengecekan berikut setelah semua perangkat di-setup:

| # | Cek | Cara Verifikasi | ✅ |
|---|-----|----------------|---|
| 1 | Web POS bisa diakses | Buka `https://menu.rakkencoffee.com` dari tablet | ☐ |
| 2 | Menu produk muncul | Scroll halaman, pastikan gambar & harga tampil | ☐ |
| 3 | Print Bridge online | Akses `http://localhost:3001/health` di PC Kasir | ☐ |
| 4 | Daemon polling aktif | Cek log: `pm2 logs rakken-print-bridge` — cari teks `[Daemon] 🔄 Starting print queue poller` | ☐ |
| 5 | Test cetak struk | Jalankan `npm run test-print` di folder print-bridge | ☐ |
| 6 | E2E: pesan dari tablet | Pesan 1 item dari tablet, checkout, verifikasi struk tercetak otomatis | ☐ |

### 5.2 Troubleshooting Umum

#### ❌ Printer tidak mencetak

| Kemungkinan Masalah | Solusi |
|---------------------|--------|
| COM port salah | Cek ulang di Device Manager (USB) atau Bluetooth Settings > COM Ports (Bluetooth). Update `.env` |
| Printer belum menyala | Nyalakan printer, pastikan lampu indikator aktif |
| Bluetooth terputus | Buka Settings > Bluetooth, pastikan printer masih terpasang. Jika tidak, pairing ulang |
| PM2 tidak jalan | Jalankan `pm2 list`. Jika kosong, start ulang: `pm2 start src/index.js --name "rakken-print-bridge"` |
| Kertas habis | Buka tutup printer, ganti roll kertas thermal 58mm |

#### ❌ Tablet tidak bisa mengakses web POS

| Kemungkinan Masalah | Solusi |
|---------------------|--------|
| WiFi tidak terhubung | Cek Settings > WiFi di tablet |
| Internet mati | Coba buka google.com. Jika tidak bisa, cek router WiFi |
| URL salah | Pastikan URL benar: `https://menu.rakkencoffee.com` (dengan `https`) |
| Cache browser | Clear cache Chrome: Settings > Privacy > Clear browsing data |

#### ❌ Struk tidak tercetak setelah checkout

| Kemungkinan Masalah | Solusi |
|---------------------|--------|
| Daemon tidak berjalan | `pm2 logs rakken-print-bridge` — cek apakah ada error |
| API key tidak cocok | Pastikan `NEXT_PUBLIC_PRINT_BRIDGE_API_KEY` di `.env` PC Kasir **sama persis** dengan yang di Vercel |
| CLOUD_API_URL salah | Pastikan `CLOUD_API_URL` di `.env` mengarah ke `https://menu.rakkencoffee.com` |
| Internet PC Kasir mati | Cek koneksi internet PC Kasir |

#### ❌ PM2 tidak auto-start setelah PC restart

```bash
pm2 save
pm2 startup
```

Jalankan perintah yang diberikan oleh PM2, lalu restart PC untuk memverifikasi.

---

> **Dokumen ini terakhir diupdate:** 21 Mei 2026
> **Versi Aplikasi:** POS System v0.1.0 (Next.js 16.1.6)
> **Kontak IT:** [Sesuaikan dengan kontak IT outlet Anda]
