# 🖨️ PRINT-BRIDGE.md — Dokumentasi Print Bridge & Auto-Reconnect

> **Dokumen ini menjelaskan cara kerja Print Bridge, mekanisme auto-reconnect Bluetooth, dan command PM2 yang sering digunakan.**
> Ditujukan untuk developer & staff teknis yang mengelola PC Kasir/Pusat.

---

## Daftar Isi

1. [Apa itu Print Bridge?](#1-apa-itu-print-bridge)
2. [Arsitektur Koneksi Printer](#2-arsitektur-koneksi-printer)
3. [Auto-Reconnect: Cara Kerja](#3-auto-reconnect-cara-kerja)
4. [Startup Otomatis (Windows)](#4-startup-otomatis-windows)
5. [Health Check & Monitoring](#5-health-check--monitoring)
6. [Command PM2 yang Sering Digunakan](#6-command-pm2-yang-sering-digunakan)
7. [Troubleshooting](#7-troubleshooting)
8. [Konfigurasi (.env)](#8-konfigurasi-env)

---

## 1. Apa itu Print Bridge?

Print Bridge adalah server lokal (Express.js) yang berjalan di **PC Kasir/Pusat** pada port `3001`. Tugasnya menjembatani antara aplikasi web POS (Next.js di Vercel cloud) dengan **printer struk thermal** (RPP02N 58mm) yang terhubung via **Bluetooth Serial (COM port)**.

```
┌────────────────────┐          ┌──────────────────┐         ┌──────────────┐
│  Tablet / Browser  │──HTTP──▶ │  Print Bridge    │──COM7──▶│ Printer 🖨️   │
│  (Kiosk / KDS)     │          │  localhost:3001   │  (BT)   │ RPP02N 58mm  │
└────────────────────┘          └──────────────────┘         └──────────────┘
```

### Dua Mode Cetak:

| Mode | Cara Kerja | Kapan Digunakan |
|------|-----------|-----------------|
| **Direct Print** | Browser tablet mengirim `POST /print` ke IP lokal Print Bridge | Tablet & PC dalam satu LAN |
| **Cloud Print Queue** | POS Cloud menyimpan print job ke database, Print Bridge melakukan polling `GET /api/print-jobs` setiap 3 detik | Tablet mengakses via internet (beda jaringan) |

---

## 2. Arsitektur Koneksi Printer

```
PC Menyala
    │
    ▼
Windows Login
    │
    ├─── PM2 auto-start (via pm2-windows-startup)
    │         │
    │         ▼
    │    Print Bridge (index.js) start
    │         │
    │         ├─── Coba buka COM7 (Bluetooth Serial)
    │         │         │
    │         │    ┌────┴────────────────────────┐
    │         │    │ Berhasil?                    │
    │         │    │  ✅ Ya → Printer connected   │
    │         │    │  ❌ Tidak → Start reconnect  │
    │         │    └─────────────────────────────┘
    │         │
    │         ▼
    │    Auto-reconnect loop (setiap 5 detik)
    │         │
    │         └─── Terus coba sampai printer terhubung
    │
    ├─── start-rakken-printer.bat (15 detik delay)
    │         │
    │         ▼
    │    Restart PM2 → Cek Health → Selesai
    │
    └─── Bluetooth Windows siap (10-30 detik setelah login)
              │
              ▼
         COM7 tersedia → Auto-reconnect berhasil ✅
```

---

## 3. Auto-Reconnect: Cara Kerja

Print Bridge memiliki mekanisme **self-healing** yang membuatnya **tidak perlu restart manual** dalam sebagian besar kasus.

### Skenario yang Ditangani Otomatis:

| Skenario | Apa yang Terjadi |
|----------|-----------------|
| PM2 start **sebelum** Bluetooth siap | `openPrinter()` gagal → reconnect loop aktif → coba ulang tiap 5 detik → berhasil saat BT siap |
| Printer **dimatikan** saat operasional | Event `close` terdeteksi → reconnect loop aktif otomatis |
| Printer **keluar jangkauan** Bluetooth | Event `error` terdeteksi → reconnect loop aktif otomatis |
| Printer **dinyalakan kembali** | Reconnect loop mendeteksi COM port tersedia → koneksi pulih |

### Kode Inti (index.js)

```javascript
// Saat startup gagal connect:
openPrinter().catch(() => {
  console.log('⚠️  Printer not connected yet. Starting auto-reconnect loop...');
  startReconnectLoop(); // Coba ulang tiap 5 detik
});

// Saat printer terputus di tengah operasional:
printerPort.on('close', () => {
  isPortOpen = false;
  startReconnectLoop(); // Otomatis coba reconnect
});
```

### Status di /health

```json
// Printer terhubung normal:
{ "status": "ok", "printer": "COM7", "connected": true,  "reconnecting": false }

// Sedang mencoba reconnect:
{ "status": "ok", "printer": "COM7", "connected": false, "reconnecting": true }
```

---

## 4. Startup Otomatis (Windows)

Terdapat **2 layer** startup otomatis agar printer selalu terhubung setelah PC dinyalakan:

### Layer 1: PM2 Auto-Start
PM2 terdaftar sebagai Windows startup service via `pm2-windows-startup`. PM2 akan otomatis menjalankan `rakken-print-bridge` setiap kali Windows login.

```
📦 pm2-windows-startup
└── Menjalankan PM2 → Menjalankan rakken-print-bridge
```

### Layer 2: Startup Script (Backup/Pengaman)
File `start-rakken-printer.bat` terdaftar di folder **Windows Startup** sebagai jaring pengaman:

```
📂 %APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\
└── RAKKEN Print Bridge.lnk → start-rakken-printer.bat
```

**Yang dilakukan script ini:**
1. Tunggu **15 detik** (agar Bluetooth Windows siap)
2. Restart PM2 process dengan `--update-env`
3. Cek health endpoint untuk verifikasi

### Kenapa Perlu Dua Layer?

| Layer | Fungsi | Kelemahan yang Ditutupi Layer Lain |
|-------|--------|------------------------------------|
| PM2 auto-start | Menyalakan service secepat mungkin | BT belum siap → reconnect loop menangani |
| BAT script | Restart PM2 setelah BT siap (15 detik delay) | Jika PM2 gagal start awal, script ini membuat fresh process |
| Auto-reconnect (kode) | Menangani BT yang lambat | Backup jika PM2 dan BAT sudah jalan tapi BT baru siap 30 detik kemudian |

---

## 5. Health Check & Monitoring

### Endpoint Health (tanpa API key)

```
GET http://localhost:3001/health
```

**Response:**
```json
{
  "status": "ok",
  "printer": "COM7",
  "connected": true,
  "reconnecting": false,
  "timestamp": "2026-05-25T02:54:46.811Z"
}
```

### Endpoint List Printer (perlu API key)

```
GET http://localhost:3001/printers
Header: x-api-key: <API_KEY>
```

### Test Print (perlu API key)

```powershell
Invoke-RestMethod -Method POST -Uri "http://localhost:3001/test" -Headers @{"x-api-key"="rakken-print-bridge-secret-key-123"} | ConvertTo-Json
```

---

## 6. Command PM2 yang Sering Digunakan

> **Catatan:** Semua command dijalankan di terminal/PowerShell dari folder `print-bridge/`.
> Tambahkan `npx` di depan jika PM2 tidak di-install global.

### Status & Monitoring

| Command | Deskripsi |
|---------|-----------|
| `npx pm2 status` | Lihat status semua proses PM2 (online/stopped/errored) |
| `npx pm2 logs rakken-print-bridge` | Tampilkan log output realtime (Ctrl+C untuk keluar) |
| `npx pm2 logs rakken-print-bridge --lines 50` | Tampilkan 50 baris log terakhir |
| `npx pm2 monit` | Dashboard monitoring interaktif (CPU, Memory, Logs) |

### Kontrol Proses

| Command | Deskripsi |
|---------|-----------|
| `npx pm2 restart rakken-print-bridge` | Restart proses (reload kode terbaru) |
| `npx pm2 restart rakken-print-bridge --update-env` | Restart + muat ulang variabel `.env` |
| `npx pm2 stop rakken-print-bridge` | Hentikan proses (printer terputus) |
| `npx pm2 start rakken-print-bridge` | Jalankan kembali proses yang dihentikan |
| `npx pm2 delete rakken-print-bridge` | Hapus proses dari daftar PM2 |

### Setup & Persistensi

| Command | Deskripsi |
|---------|-----------|
| `npx pm2 start src/index.js --name "rakken-print-bridge"` | Daftarkan proses baru ke PM2 |
| `npx pm2 save` | Simpan daftar proses aktif agar auto-start saat boot |
| `pm2-startup install` | Register PM2 sebagai Windows startup service |

### Diagnostik Printer

| Command | Deskripsi |
|---------|-----------|
| `npm run scan` | Scan semua COM port Bluetooth yang tersedia |
| `node src/test-print.js COM7` | Kirim test print ke port tertentu (harus stop PM2 dulu!) |

### ⚠️ Penting: Test Print Manual

Sebelum menjalankan `node src/test-print.js`, **wajib** stop PM2 terlebih dahulu karena Windows hanya mengizinkan satu aplikasi mengakses COM port secara bersamaan:

```powershell
# 1. Stop PM2
npx pm2 stop rakken-print-bridge

# 2. Scan port
npm run scan

# 3. Test print
node src/test-print.js COM7

# 4. Start kembali PM2 (JANGAN LUPA!)
npx pm2 restart rakken-print-bridge
```

---

## 7. Troubleshooting

### Printer Tidak Terdeteksi / Access Denied

| Gejala | Penyebab | Solusi |
|--------|----------|-------|
| `Access denied` saat test print | PM2 sedang menggunakan port | Stop PM2 dulu: `npx pm2 stop rakken-print-bridge` |
| Port COM7 tidak muncul di scan | Bluetooth belum paired/mati | Buka Settings > Bluetooth, pair ulang printer RPP02N |
| `connected: false` terus-menerus | Printer mati / kehabisan baterai | Nyalakan printer, tunggu auto-reconnect (5 detik) |
| PM2 status `errored` | Crash pada kode index.js | Cek log: `npx pm2 logs rakken-print-bridge --lines 30` |

### Cara Reset Total (Jika Semua Gagal)

```powershell
# 1. Hapus proses PM2 lama
npx pm2 delete rakken-print-bridge

# 2. Pastikan printer paired di Windows Bluetooth
# (Settings > Bluetooth & devices > Pair RPP02N)

# 3. Scan port
npm run scan

# 4. Test print manual
node src/test-print.js COM7

# 5. Daftarkan ulang ke PM2
npx pm2 start src/index.js --name "rakken-print-bridge"
npx pm2 save
```

---

## 8. Konfigurasi (.env)

File: `print-bridge/.env`

```env
# Server
PORT=3001

# Printer Bluetooth Serial
PRINTER_PORT=COM7
BAUD_RATE=9600

# Cloud Print Queue
CLOUD_API_URL=https://menu.rakkencoffee.com
NEXT_PUBLIC_PRINT_BRIDGE_API_KEY=rakken-print-bridge-secret-key-123
CLOUD_POLLING_INTERVAL=3000

# EDC Config (Opsional)
EDC_HOST=192.168.1.100
EDC_PORT=7000
```

| Variabel | Deskripsi | Default |
|----------|-----------|---------|
| `PORT` | Port HTTP server Print Bridge | `3001` |
| `PRINTER_PORT` | COM port Bluetooth printer | `COM7` |
| `BAUD_RATE` | Kecepatan serial communication | `9600` |
| `CLOUD_API_URL` | URL cloud POS untuk polling print jobs | - |
| `NEXT_PUBLIC_PRINT_BRIDGE_API_KEY` | API key untuk autentikasi endpoint | - |
| `CLOUD_POLLING_INTERVAL` | Interval polling cloud print queue (ms) | `3000` |

---

## File Terkait dalam Project

| File | Lokasi | Fungsi |
|------|--------|--------|
| `index.js` | `print-bridge/src/` | Server utama Print Bridge + auto-reconnect |
| `format-receipt.js` | `print-bridge/src/` | Formatter ESC/POS untuk struk & label |
| `test-print.js` | `print-bridge/src/` | Script diagnostik manual (scan & test) |
| `start-rakken-printer.bat` | `print-bridge/` | Script startup otomatis Windows |
| `.env` | `print-bridge/` | Konfigurasi port & API key |

---

*Versi: 1.0.0 | Terakhir diupdate: 25 Mei 2026*
