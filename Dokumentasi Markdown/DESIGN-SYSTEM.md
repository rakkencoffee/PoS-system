# RAKKEN POS KIOSK — DESIGN SYSTEM v2.0
### For Claude Design / Google Stitch Implementation

---

## 0. INSTRUKSI UNTUK AI DESIGN TOOL

Dokumen ini adalah design system lengkap untuk **redesign total** Web POS Kiosk brand **RAKKEN** (StartFriday Coffee). Buatkan desain **6 halaman kiosk customer-facing** beserta versi **mobile responsive**-nya. Setiap halaman harus terasa **berbeda secara signifikan** dari desain sebelumnya — dari layout, hierarki visual, sampai tone dan feel-nya. Gunakan semua token, komponen, dan spec yang ada di dokumen ini secara konsisten.

**Target output:** High-fidelity mockup semua halaman dalam 2 ukuran: **Kiosk (1080×1920px portrait)** dan **Mobile (390×844px)**.

---

## 1. BRAND CONTEXT

| | |
|---|---|
| **Brand** | RAKKEN by StartFriday |
| **Industri** | Specialty Coffee Shop / F&B |
| **Tone** | Warm, Premium, Inviting, Modern |
| **Positioning** | Coffee experience berkualitas dengan sentuhan hangat dan autentik |
| **Bahasa UI** | Indonesia + English (bilingual) |

---

## 2. USER PERSONA & KONTEKS PENGGUNAAN

### Persona: Pelanggan Kiosk

| Atribut | Detail |
|---|---|
| **Nama** | Coffee Enjoyer — usia 18–40 tahun |
| **Perangkat** | Layar sentuh (touchscreen), tidak ada keyboard fisik, tidak ada mouse |
| **Lingkungan** | Indoor — coffee shop, pencahayaan hangat/ambient, mungkin ramai |
| **Posisi** | Berdiri di depan kiosk, jarak pandang 30–60cm dari layar |
| **Durasi interaksi** | 1–3 menit per sesi (ordering flow cepat) |
| **Level tech** | Semua kalangan, termasuk yang tidak tech-savvy |
| **Motivasi** | Memesan minuman/makanan dengan cepat, tanpa antri ke kasir |
| **Hambatan** | Layar terlalu kecil, teks sulit dibaca, tombol susah dipencet, flow membingungkan |

### Prinsip UX untuk Kiosk

1. **Touch-first** — Semua elemen interaktif minimal 56px height, 48px width
2. **Readable from distance** — Teks utama minimal 18px, heading besar
3. **Clear affordance** — Tombol harus jelas terlihat sebagai tombol
4. **Forgiving** — Mudah undo (hapus item, edit pesanan)
5. **Fast feedback** — Setiap interaksi langsung ada visual response
6. **Progress clarity** — User selalu tahu sedang di tahap mana

---

## 3. DESIGN PRINCIPLES

1. **Warm Premium** — Bukan cold/clinical. Background hangat, tipografi tebal, aksen merah berani.
2. **Clean Elevation** — Tidak ada glass-morphism. Kartu putih bersih dengan shadow halus di atas background warm beige.
3. **Bold Hierarchy** — Heading besar dan tegas. Informasi penting mendapat bobot visual lebih.
4. **Purposeful Color** — Merah (#9F131E) hanya untuk CTA utama dan highlight kritis. Warna lain sebagai pendukung.
5. **Zero Friction** — Navigasi intuitif, tombol selalu terlihat, tidak ada dead-end.

---

## 4. COLOR SYSTEM

### 4.1 Brand Palette (dari PANTONE)

| Token Name | Hex | PANTONE | Peran |
|---|---|---|---|
| `--color-primary` | `#9F131E` | 7427 C | CTA utama, aksen kritis, active state |
| `--color-secondary-olive` | `#737C45` | 5763 C | Badge "best seller", status, highlight positif |
| `--color-secondary-brown` | `#533F36` | 7617 C | Teks sekunder, ikon, border aktif |
| `--color-neutral-white` | `#FFFFFF` | 663 C | Surface kartu, input background |
| `--color-neutral-dark` | `#323131` | 412 C | Teks primer, heading, label |
| `--color-accent-beige` | `#D9C7A6` | 468 C | Background page, surface warm, disabled state |
| `--color-accent-taupe` | `#998075` | 7614 C | Placeholder, teks muted, icon disabled |

### 4.2 Semantic Tokens (turunan dari brand palette)

```css
/* Background */
--bg-page:          #F5ECD9   /* Warm cream — background utama semua halaman */
--bg-surface:       #FAF5EE   /* Sedikit lebih terang untuk section areas */
--bg-card:          #FFFFFF   /* Kartu produk, kartu form */
--bg-input:         #FFFFFF   /* Input field background */
--bg-overlay:       rgba(50, 49, 49, 0.60)   /* Modal overlay */
--bg-primary-soft:  rgba(159, 19, 30, 0.08)  /* Red tint ringan untuk highlight */
--bg-olive-soft:    rgba(115, 124, 69, 0.10) /* Green tint untuk badge */

/* Text */
--text-primary:     #323131   /* Heading, label, teks utama */
--text-secondary:   #533F36   /* Deskripsi, sub-label */
--text-muted:       #998075   /* Placeholder, helper text, disabled label */
--text-inverted:    #FFFFFF   /* Teks di atas tombol merah */
--text-price:       #9F131E   /* Harga, total amount */
--text-discount:    #737C45   /* Potongan harga, voucher applied */
--text-error:       #C0392B   /* Error message */

/* Border */
--border-subtle:    rgba(217, 199, 166, 0.60)  /* Kartu, section divider */
--border-default:   rgba(153, 128, 117, 0.35)  /* Input default state */
--border-focus:     #9F131E                     /* Input focused, selected */
--border-strong:    #533F36                     /* Emphasis */

/* Interactive States */
--state-hover:      rgba(159, 19, 30, 0.06)   /* Hover background on cards */
--state-active:     rgba(159, 19, 30, 0.12)   /* Active/pressed state */
--state-disabled:   rgba(217, 199, 166, 0.80) /* Disabled background */
--state-disabled-text: #998075                 /* Disabled text */

/* Status */
--status-success:   #2D7A4F   /* Hijau deep untuk kesesuaian dengan palette warm */
--status-warning:   #C17D2B   /* Amber warm */
--status-error:     #9F131E   /* Pakai primary merah */
--status-info:      #2D5A8E   /* Biru netral */

/* Shadows */
--shadow-xs:  0 1px 4px rgba(83, 63, 54, 0.08)
--shadow-sm:  0 2px 8px rgba(83, 63, 54, 0.10)
--shadow-md:  0 4px 16px rgba(83, 63, 54, 0.12)
--shadow-lg:  0 8px 32px rgba(83, 63, 54, 0.14)
--shadow-xl:  0 16px 48px rgba(83, 63, 54, 0.16)
--shadow-cta: 0 4px 20px rgba(159, 19, 30, 0.30)  /* Shadow tombol merah */
```

---

## 5. TYPOGRAPHY

### 5.1 Font Family

**Primary Font: Plus Jakarta Sans**
- Google Fonts: `https://fonts.google.com/specimen/Plus+Jakarta+Sans`
- Digunakan untuk semua teks UI
- Mengapa: Modern, premium, legible dari jarak jauh, karakter yang tegas, variable font support

**Monospace Font: JetBrains Mono** (atau `font-mono` fallback)
- Digunakan hanya untuk: Nomor antrian, Order ID, kode voucher

```css
--font-primary: 'Plus Jakarta Sans', system-ui, sans-serif;
--font-mono: 'JetBrains Mono', 'Courier New', monospace;
```

### 5.2 Type Scale

| Token | Size | Weight | Line Height | Letter Spacing | Penggunaan |
|---|---|---|---|---|---|
| `--text-display-2xl` | 72px | 800 ExtraBold | 1.1 | -0.03em | Nomor antrian hero |
| `--text-display-xl` | 56px | 800 ExtraBold | 1.1 | -0.02em | Queue number, success hero |
| `--text-display-lg` | 48px | 700 Bold | 1.2 | -0.02em | Welcome headline |
| `--text-heading-xl` | 36px | 700 Bold | 1.25 | -0.01em | Page title |
| `--text-heading-lg` | 28px | 700 Bold | 1.3 | -0.01em | Section heading |
| `--text-heading-md` | 22px | 600 SemiBold | 1.35 | 0 | Card title, item name |
| `--text-heading-sm` | 18px | 600 SemiBold | 1.4 | 0 | Sub-heading, label besar |
| `--text-body-lg` | 17px | 500 Medium | 1.5 | 0 | Body text utama |
| `--text-body-md` | 15px | 400 Regular | 1.5 | 0 | Deskripsi, helper |
| `--text-body-sm` | 13px | 400 Regular | 1.5 | 0.01em | Caption, hint |
| `--text-label` | 12px | 600 SemiBold | 1 | 0.06em | Label chip, badge, tag |
| `--text-price-lg` | 28px | 700 Bold | 1 | -0.01em | Harga total |
| `--text-price-md` | 20px | 700 Bold | 1 | -0.01em | Harga item |
| `--text-price-sm` | 15px | 600 SemiBold | 1 | 0 | Harga kecil, diskon |

---

## 6. SPACING SYSTEM

**Base unit: 4px**

```
--space-1:   4px
--space-2:   8px
--space-3:   12px
--space-4:   16px
--space-5:   20px
--space-6:   24px
--space-8:   32px
--space-10:  40px
--space-12:  48px
--space-16:  64px
--space-20:  80px
--space-24:  96px
```

**Touch targets:** Semua elemen interaktif minimum `56px × 48px`

### Layout Grid

| Context | Kolom | Gutter | Padding |
|---|---|---|---|
| Kiosk (1080px) | 12 kolom | 24px | 40px |
| Tablet (768px) | 8 kolom | 20px | 32px |
| Mobile (390px) | 4 kolom | 16px | 20px |

---

## 7. BORDER RADIUS

```
--radius-xs:  4px    /* Badge, tag kecil */
--radius-sm:  8px    /* Input, button kecil */
--radius-md:  12px   /* Kartu, modal */
--radius-lg:  16px   /* Kartu besar, section */
--radius-xl:  24px   /* Bottom sheet, hero section */
--radius-2xl: 32px   /* Tombol pill besar */
--radius-full: 9999px /* Chip, avatar, badge bulat */
```

---

## 8. ICONOGRAPHY

- **Library:** Lucide React (sudah terpasang di project)
- **Stroke width:** 1.5px (default Lucide) — jangan gunakan emoji sebagai icon UI
- **Sizes:** 16px (inline), 20px (button), 24px (nav), 32px (featured)
- **Color:** Ikuti konteks — `--text-primary` untuk neutral, `--color-primary` untuk active/CTA, `--text-muted` untuk disabled

---

## 9. ANIMATION & MOTION

**Prinsip:** Minimal, purposeful, tidak mengganggu kecepatan ordering.

```css
/* Easing */
--ease-standard:  cubic-bezier(0.4, 0.0, 0.2, 1)   /* Masuk/keluar elemen */
--ease-decelerate: cubic-bezier(0.0, 0.0, 0.2, 1)  /* Elemen masuk dari bawah */
--ease-accelerate: cubic-bezier(0.4, 0.0, 1, 1)    /* Elemen keluar */

/* Durasi */
--duration-fast:   120ms  /* Hover, color change, state toggle */
--duration-normal: 220ms  /* Fade in/out, scale, position */
--duration-slow:   350ms  /* Page transition, modal open */
```

**Allowed animations:**
- `fadeIn` — opacity 0 → 1 (220ms, ease-standard)
- `slideUp` — translateY(16px) + opacity 0 → translateY(0) + opacity 1 (220ms, ease-decelerate)
- `scaleIn` — scale(0.96) + opacity 0 → scale(1) + opacity 1 (220ms, ease-decelerate)
- `pulse` — scale(1) → scale(1.02) → scale(1) (1200ms infinite, untuk queue number)

**Tidak digunakan:** parallax, rotation, bounce, spring complex, blur animation, 3D transform.

---

## 10. COMPONENT LIBRARY

### 10.1 Button

#### Primary Button (CTA Utama)
- Background: `--color-primary` (#9F131E)
- Text: `--text-inverted` (#FFFFFF), `--text-body-lg`, weight 600
- Height: 56px kiosk / 52px mobile
- Padding: 0 32px
- Border Radius: `--radius-2xl` (32px)
- Shadow: `--shadow-cta`

**States:**
- `default` — bg: #9F131E, text: white, shadow: cta
- `hover` — bg: #8A1019, shadow lebih besar (lift effect)
- `active/pressed` — bg: #780D15, shadow: none, scale(0.98)
- `loading` — bg: #9F131E (50% opacity), spinner icon (white, 20px) kiri teks, teks berubah sesuai konteks
- `disabled` — bg: #D9C7A6, text: #998075, shadow: none, cursor: not-allowed
- `success` — bg: #2D7A4F, icon check di kiri, teks "Berhasil"

#### Secondary Button
- Background: transparent
- Border: 2px solid `--color-primary`
- Text: `--color-primary`, weight 600
- Height: 56px kiosk / 52px mobile
- Border Radius: `--radius-2xl`

**States:**
- `default` — transparent bg, red border, red text
- `hover` — bg: `--bg-primary-soft`, border tetap
- `active` — bg: `--state-active`
- `disabled` — border: #D9C7A6, text: #998075

#### Ghost Button
- Background: transparent
- Border: none
- Text: `--text-secondary`, weight 500
- Underline on hover

#### Icon Button
- Shape: circle (48×48px minimum)
- Background: `--bg-card`
- Border: 1px solid `--border-subtle`
- Icon: 20px, `--text-secondary`
- Shadow: `--shadow-xs`
- Hover: bg `--state-hover`, border `--border-default`

---

### 10.2 Input Field

**Anatomi:**
- Label (atas): 13px, weight 600, color `--text-secondary`, letter-spacing 0.06em, UPPERCASE
- Input container: bg white, border 1.5px `--border-default`, radius `--radius-md`
- Input text: 16px (hindari zoom di iOS), weight 400, color `--text-primary`
- Helper text (bawah): 13px, `--text-muted`
- Height: 56px

**States:**
- `default` — border: `--border-default` (#998075 at 35%)
- `focus` — border: `--border-focus` (#9F131E), outline: 3px rgba(159,19,30,0.12)
- `filled/valid` — border: `--border-default`, slight tick icon di kanan (opsional)
- `error` — border: #C0392B, helper text merah, icon X di kanan
- `disabled` — bg: #F5ECD9, border: `--border-subtle`, text: `--text-muted`, cursor: not-allowed

**Voucher Input (variant):**
- Font mono untuk input value
- "Apply" / "Hapus" button embedded di kanan
- Uppercase auto-transform
- Success state: border hijau, icon check, text hijau di bawah

---

### 10.3 Product Card (Menu)

**Kiosk layout:** 3 kolom grid
**Mobile layout:** 2 kolom grid

**Anatomi:**
- Container: bg white, radius `--radius-lg` (16px), shadow `--shadow-sm`, overflow hidden
- Image area: aspect ratio 4:3, full width, object-fit cover
- Body padding: 16px
- Nama produk: `--text-heading-md` (22px), weight 600, color `--text-primary`, max 2 baris
- Deskripsi: `--text-body-sm` (13px), color `--text-muted`, max 2 baris (hidden jika panjang)
- Harga: `--text-price-md` (20px), weight 700, color `--color-primary`
- Tombol "Tambah": Full width, height 44px, bg `--color-primary`, text white, radius `--radius-sm`, di bawah harga

**Badge overlay (atas gambar, pojok kiri):**
- "Best Seller" — bg `--color-secondary-olive`, text white, radius full, padding 4px 10px, text 11px weight 700 uppercase
- "Baru" — bg `--color-primary`, text white (sama format)

**States:**
- `default` — shadow-sm, scale 1
- `hover/touch` — shadow-md, scale(1.02), transition 220ms
- `active` — scale(0.98), shadow-xs
- `sold out` — gambar grayscale 30%, overlay "Habis" semi-transparent di gambar, tombol disabled

---

### 10.4 Cart Item Row

**Anatomi:**
- Container: bg white, border bawah 1px `--border-subtle`, padding 16px
- Thumbnail: 72×72px, radius `--radius-sm`, bg `--bg-surface` (fallback jika no image)
- Nama + customization info di kanan thumbnail
- Nama: 16px, weight 600, `--text-primary`
- Customization chips: baris chip kecil di bawah nama (lihat komponen Chip)
- Quantity control: 3 elemen horizontal — tombol minus (circle 36px), angka (20px bold), tombol plus (circle 36px, bg merah)
- Subtotal: pojok kanan bawah, 18px bold, `--color-primary`
- Tombol hapus: icon Trash2, 20px, `--text-muted`, di pojok kanan atas
- Tombol edit: link teks "Edit", 13px, `--color-primary`, di bawah chips

**States:**
- `default` — statis
- `deleting` — slide ke kanan + fade out
- `quantity zero` — row fade out

---

### 10.5 Customization Chip

- Background: `--bg-surface` (#FAF5EE)
- Border: 1px solid `--border-subtle`
- Text: 12px, weight 500, `--text-secondary`
- Padding: 3px 10px
- Radius: `--radius-full`
- Icon (opsional): 12px di kiri teks

---

### 10.6 Category Pill (Navigation)

**Kiosk:** Horizontal scroll row
**Mobile:** Horizontal scroll row

- Pill: padding 10px 20px, radius `--radius-full`, height 44px
- Inactive: bg `--bg-card`, border 1px `--border-subtle`, text `--text-secondary`, weight 500
- Active: bg `--color-primary`, border transparent, text white, weight 600, shadow `--shadow-sm`
- Transition: 150ms ease

---

### 10.7 Order Summary Row (Checkout)

- Qty badge: 22×22px circle, bg `--bg-primary-soft`, text `--color-primary`, 12px bold
- Nama item: 15px, weight 500, `--text-primary`
- Customization: 12px, `--text-muted`, italic, indent kiri
- Harga: 15px, weight 600, `--text-primary`, kanan
- Diskon: 12px, `--text-discount` (olive), coret harga asli jika ada

---

### 10.8 Status Progress Steps

3 step: **Diterima** → **Disiapkan** → **Siap Diambil**

Tiap step:
- Circle: 40×40px
  - Completed: bg `--color-secondary-olive`, icon Check putih
  - Current: bg `--color-primary`, angka putih, pulse animation
  - Upcoming: bg `--bg-surface`, border 2px `--border-subtle`, angka `--text-muted`
- Label di bawah circle: 12px, weight 600
  - Completed: `--text-discount`
  - Current: `--text-price`
  - Upcoming: `--text-muted`
- Connector line antar step:
  - Completed segment: bg `--color-secondary-olive`
  - Incomplete segment: bg `--border-subtle`
  - Height: 3px
  - Fills dari kiri ke kanan seiring progress

---

### 10.9 Toast / Notification

Posisi: Top-center, margin-top 80px (di bawah header)
Width: max 400px kiosk / full width mobile
Animasi: slideDown + fadeIn (220ms), auto-dismiss 3500ms

**Variants:**
- `success` — border-left 4px `--status-success`, bg white, icon CheckCircle hijau, teks `--text-primary`
- `error` — border-left 4px `--status-error`, bg white, icon XCircle merah
- `warning` — border-left 4px `--status-warning`, bg white, icon AlertCircle amber
- `info` — border-left 4px #2D5A8E, bg white, icon Info biru

Anatomi tiap toast:
- Radius: `--radius-md`
- Shadow: `--shadow-lg`
- Padding: 16px
- Icon: 20px kiri
- Teks judul: 14px weight 600
- Teks deskripsi (opsional): 13px weight 400, `--text-muted`
- Tombol dismiss (X): 16px, pojok kanan

---

### 10.10 Badge

| Variant | BG | Text | Border |
|---|---|---|---|
| `best-seller` | `--color-secondary-olive` | white | none |
| `new` | `--color-primary` | white | none |
| `recommended` | `--bg-olive-soft` | `--color-secondary-olive` | 1px olive |
| `pending` | amber 10% | amber dark | 1px amber |
| `preparing` | blue 10% | blue dark | 1px blue |
| `ready` | green 10% | green dark | 1px green |

Ukuran: padding 4px 10px, radius full, 11px weight 700 uppercase

---

### 10.11 Skeleton Loader

- Background: linear-gradient `--bg-surface` → `--accent-beige` → `--bg-surface` (shimmer kiri ke kanan)
- Animation: shimmer 1.5s infinite
- Radius: sama dengan elemen aslinya
- Tidak perlu teks placeholder

**Skeleton Product Card:**
- Image area: persegi panjang 100%×180px, shimmer
- Title bar: 70% width, 20px height, shimmer
- Subtitle bar: 50% width, 14px height, shimmer
- Price bar: 40% width, 24px height, shimmer

---

### 10.12 Empty State

Digunakan di: Cart kosong, hasil pencarian kosong, order tidak ditemukan

Anatomi (center aligned):
- Ilustrasi: ikon Lucide besar (80px), color `--accent-beige` (pakai ikon relevan: ShoppingCart, Search, FileX)
- Judul: 20px, weight 600, `--text-primary`
- Deskripsi: 14px, `--text-muted`
- CTA button (opsional): primary button

---

### 10.13 Error State

Digunakan di: Network error, payment gagal, order not found

Anatomi:
- Ikon: AlertTriangle atau WifiOff (80px, `--color-primary`)
- Judul: "Oops, ada yang salah" atau sesuai konteks
- Deskripsi: penjelasan dan saran tindakan
- Tombol retry: secondary button "Coba Lagi"
- Tombol kembali: ghost button

---

### 10.14 Payment Method Card (Checkout)

Kartu pilihan metode bayar:
- Container: bg white, border 2px solid `--border-default`, radius `--radius-md`, padding 20px
- Layout: ikon 40px kiri, info kanan
- Judul: 16px weight 600
- Sub: 13px `--text-muted`
- Selected state: border 2px `--color-primary`, bg `--bg-primary-soft`, icon check di pojok kanan

---

## 11. PAGE-BY-PAGE SPECIFICATIONS

---

### PAGE 1: WELCOME SCREEN (`/`)

**Tujuan:** First impression, invite to order, branding moment.
**Layout:** Full screen, portrait. Tidak ada navigasi.

#### Kiosk (1080×1920px):

**Background:**
- Full-page bg: Warm gradient dari `#F5ECD9` (atas) ke `#EDD9B5` (bawah)
- Optional: subtle tekstur/grain overlay (opacity 4%) untuk premium feel

**Layout (dari atas ke bawah, vertikal centered):**
1. **Logo area** (top 30% dari layar)
   - Logo RAKKEN — centered, 200px wide
   - Tagline di bawah logo: "Specialty Coffee & More" — 18px, weight 500, `--text-muted`, letter-spacing 0.1em, uppercase

2. **Divider dekoratif** — horizontal line tipis, 120px wide, centered, warna `--accent-taupe` (#998075), opacity 40%

3. **Headline** (center layar)
   - Teks: "Selamat Datang"
   - Size: `--text-display-lg` (48px), weight 800, color `--text-primary`

4. **CTA Area** (bawah headline, gap 48px)
   - Tombol besar: **"Mulai Pesan"**
   - Style: primary button full-width (max 420px), height 72px, text 22px weight 700
   - Di bawah tombol: teks hint "atau sentuh di mana saja untuk memulai" — 14px, `--text-muted`

5. **Footer** (bottom 8%)
   - Ikon informasi kecil + "Pemesanan mandiri · Bayar di sini"
   - 13px, `--text-muted`

**Interaksi:** Entire screen clickable → `/menu`. Tombol "Mulai Pesan" lebih prominent.

#### Mobile (390×844px):
- Semua elemen sama, ukuran font proporsional lebih kecil
- Logo: 140px
- Headline: 36px
- CTA button: height 60px, text 18px
- Lebih banyak whitespace vertikal

---

### PAGE 2: MENU BROWSING (`/menu`)

**Tujuan:** Temukan dan pilih produk dengan cepat.

#### Layout Utama:

**Header (sticky, height 72px kiosk / 60px mobile):**
- Kiri: Back button (icon button, `<- ArrowLeft`)
- Tengah: "Menu Kami" — 22px weight 700
- Kanan: Cart button — icon ShoppingBag 24px + badge merah (angka item) pojok kanan atas badge
- Background: `--bg-card` (#FFFFFF), border-bottom 1px `--border-subtle`
- Shadow: `--shadow-sm` saat scroll

**Search Bar (di bawah header, sticky, padding horizontal 24px, padding vertical 12px, bg `--bg-page`):**
- Input: full width, height 52px, radius `--radius-xl` (24px), bg white
- Left icon: Search 20px, `--text-muted`
- Right icon (saat ada teks): X button clear 20px
- Placeholder: "Cari minuman atau makanan..."
- Focus: border 1.5px `--color-primary`

**Category Pills (di bawah search, horizontal scroll, padding 0 24px 16px, gap 8px):**
- Row pill-pill-pill, horizontal scroll tanpa scrollbar visible
- Semua kategori dari API
- Pill "Semua" sebagai opsi pertama (selalu ada)
- Active pill: merah. Inactive: putih/beige

**Content Area (scrollable):**

*Mode normal (per kategori):*
- Section header tiap kategori:
  - Ikon kategori (opsional) + nama kategori — 20px weight 700 `--text-primary`
  - Garis tipis kanan (hr)
  - Background: `--bg-page`

- Grid produk di bawah section header:
  - Kiosk: 3 kolom, gap 16px
  - Mobile: 2 kolom, gap 12px
  - Padding horizontal: 24px kiosk / 20px mobile

*Mode search:*
- Tidak ada section header
- Flat grid semua hasil
- Empty state jika tidak ada hasil

**Bottom Bar / Floating Cart (muncul saat cart tidak kosong):**
- Fixed di bottom, full width
- Background: `--color-primary` (#9F131E)
- Isi (horizontal): ikon ShoppingBag putih + "[N] item" | "Lihat Keranjang" + ikon ArrowRight
- Height: 64px kiosk / 60px mobile
- Shadow: `--shadow-xl` ke atas
- Tap → navigasi ke `/cart`

#### Customize Modal (overlay saat tap produk):

- Overlay: `--bg-overlay` rgba(50,49,49,0.60)
- Modal container: bg white, radius-xl di atas (24px), radius 0 di bawah — muncul dari bawah (slide up animation)
- Handle bar: 40×4px, bg `--border-subtle`, centered di atas
- Kiosk: max-height 75vh, overflow-y scroll
- Mobile: max-height 85vh

**Modal content:**
1. Image produk: 100% width, height 200px, object-fit cover
2. Nama + harga: padding 20px
3. Deskripsi (jika ada): 14px, `--text-muted`
4. Divider
5. Tiap opsi group (Ukuran, Gula, Es, dll):
   - Label group: 14px weight 600 uppercase letter-spaced
   - Opsi: radio style — card kecil, 3-4 per baris
   - Selected: border primary, bg primary-soft, text primary
6. Toppings: checkbox style (multiple select)
7. Notes input: textarea 80px height, 14px
8. Footer sticky: total harga + tombol "Tambah ke Keranjang" (primary, full width)

---

### PAGE 3: CART (`/cart`)

**Tujuan:** Review pesanan, edit, konfirmasi nama.

**Header:** Sama dengan menu — "Keranjang" + item count badge + back button

#### Empty Cart State:
- Center screen
- Ikon ShoppingCart — 80px, `--accent-beige`
- Teks: "Keranjang Kosong" 22px bold
- Sub: "Belum ada item yang dipilih" 15px muted
- Tombol: "Lihat Menu" — primary button, 280px wide

#### Filled Cart:

**Customer Name Section (PROMINENT — di atas daftar item):**
- Card putih dengan border-left 4px `--color-primary`
- Label: "Nama Pesanan" — 12px weight 700 uppercase, `--text-muted`
- Input: 56px height, required (bintang merah di label)
- Helper: "Nama ini akan dipanggil saat pesanan siap"
- State:
  - Empty + belum diisi: border normal
  - Typed valid: border hijau, icon Check kanan
  - Error (< 2 char): border merah, helper merah

**Item List:**
- Tiap item: card putih, shadow-xs, radius-md, margin-bottom 12px
- Lihat spec Cart Item Row di atas
- Staggered slideUp animation (delay 50ms per item)

**Order Summary Card (sticky atau di bawah list):**
- Background: `--bg-surface`
- Border: 1px `--border-subtle`
- Radius: `--radius-lg`
- Rows: Subtotal, Diskon item (jika ada, teks hijau), Total
- Total: 24px bold `--color-primary`

**Bottom Action Bar (sticky bottom, bg white, border-top 1px border-subtle, padding 16px 24px):**
- 2 tombol:
  - Kiri: "+ Tambah Item" — secondary button, 45% width
  - Kanan: "Lanjut ke Checkout" — primary button, 55% width
  - Disabled jika nama belum valid: primary jadi disabled style, tooltip/hint di bawah

---

### PAGE 4: CHECKOUT (`/checkout`)

**Tujuan:** Konfirmasi, voucher, pilih bayar, bayar.

**Header:** "Checkout" + back button

**Layout (single column scroll):**

#### Section 1: Ringkasan Pesanan
- Card putih, shadow-sm, radius-lg
- Header card: ikon ClipboardList 20px + "Ringkasan Pesanan" 18px bold
- Daftar item (lihat Order Summary Row spec)
- Collapsed saat banyak item (max 3 terlihat + "Lihat semua X item" expand link)

#### Section 2: Info Pemesan
- Card putih, shadow-sm
- Avatar circle 40px (initial huruf pertama nama), bg `--bg-primary-soft`, text `--color-primary`, weight 700
- Di sebelah kanan: nama pelanggan 17px bold, label "Pemesan" 12px muted

#### Section 3: Kode Voucher
- Card putih, shadow-sm
- Header: ikon Tag + "Kode Voucher" 18px bold
- Input + button (lihat spec Voucher Input di komponen)
- Success state: card border hijau, row "Diskon: -Rp X.xxx" warna hijau
- Error state: helper text merah di bawah input

#### Section 4: Pilih Pembayaran
- Header: "Metode Pembayaran" 18px bold
- 2 card opsi (lihat Payment Method Card):
  - Online (Midtrans): ikon CreditCard, "Bayar Online", "QRIS, Transfer, e-Wallet"
  - EDC: ikon Banknote, "Kartu Debit/Kredit", "Visa, Mastercard"

#### Section 5: Rincian Pembayaran
- Card `--bg-surface`, radius-lg
- Rows: Subtotal, Voucher (hijau, jika ada), Total Bayar (besar, merah)
- Divider sebelum total

**Bottom CTA (fixed bottom, full width, bg white, padding 16px 24px, border-top):**
- Tombol "Bayar Sekarang — Rp X.xxx.xxx"
  - Primary, full width, height 60px, text 18px bold
- Loading state: spinner kiri + teks status ("Memproses...", "Menghubungkan EDC...", dll)
- Sub-teks di bawah: ikon Shield 12px + "Pembayaran aman & terenkripsi" — 12px `--text-muted`

---

### PAGE 5: ORDER STATUS (`/status`)

**Tujuan:** Tracking real-time status pesanan.

**Dua mode:**

#### Mode A: Status Publik (tanpa orderId — papan antrian)

Full screen, no header.
Background: `--text-primary` (#323131) — DARK mode untuk visibility dari jauh.

Layout 3 kolom:
- Kolom kiri: **Menunggu** (latar amber-soft, teks dark)
- Kolom tengah: **Sedang Disiapkan** (latar blue-soft)
- Kolom kanan: **Siap Diambil** (latar green-soft)

Tiap kolom:
- Header: ikon relevan 28px + label besar 22px bold
- Nomor antrian list: tiap nomor dalam card kecil putih, teks 24px bold font-mono, center
- Background kolom: opacity layer di atas dark bg

#### Mode B: Status Personal (dengan orderId)

Background: `--bg-page` (warm cream)

**Header:** "Status Pesanan" + back button (→ home)

**Queue Number Hero:**
- Container: card putih, shadow-xl, radius-2xl, padding 40px 24px
- Label: "Nomor Antrian Anda" — 14px, weight 600, uppercase, letter-spaced, `--text-muted`
- Nomor: **`#001`** — `--text-display-xl` (56px), weight 800, `--color-primary`, font-mono
- Animasi: pulse saat status "Siap Diambil"
- Order ID: di bawah nomor, 13px font-mono `--text-muted`

**Status Current:**
- Badge besar: rounded-xl, bg sesuai status, icon + teks 18px bold
  - Pending: amber bg, clock icon, "Pesanan Diterima"
  - Preparing: blue bg, utensils icon, "Sedang Disiapkan"
  - Ready: green bg, check icon, "Siap Diambil! 🎉"

**Progress Steps:**
- Tiga step (lihat spec Status Progress Steps)
- Animasi step current: pulse-glow pada circle

**Ringkasan Pesanan:**
- Card lipat: header "Pesanan Anda" + expand/collapse
- List item ringkas

**Footer Actions:**
- "Kembali ke Beranda" — ghost button, centered

---

### PAGE 6: SUCCESS / CONFIRMATION (`/success`)

**Tujuan:** Konfirmasi pembayaran berhasil, tampilkan nomor antrian, instruksi.

Background: `--bg-page`

**Layout (top → bottom, semua centered):**

#### 1. Success Icon (animated, delay 0)
- Circle 120px, bg gradient dari `--color-primary` ke `--color-secondary-brown`
- Ikon CheckCircle putih 56px di dalam circle
- Ring luar: 140px, border 4px `--color-primary` opacity 20%, animate-pulse
- Untuk mode offline: circle amber gradient, ikon Clock

#### 2. Judul & Deskripsi (delay 1 — 100ms)
- Judul: "Pembayaran Berhasil!" — 32px weight 800 `--text-primary`
- Sub: "Pesanan Anda sedang diproses" — 16px `--text-muted`

#### 3. Queue Number Card (delay 2 — 200ms)
- Card putih, shadow-xl, radius-2xl, padding 32px
- Label atas: "Nomor Antrian" — 12px uppercase weight 700 `--text-muted`
- **Nomor: `#001`** — 72px weight 800 font-mono `--color-primary`, pulse animation
- Label bawah: "Estimasi selesai ~5-10 menit" — 14px `--text-muted`
- Order ID: 12px font-mono `--text-muted`

#### 4. Instruksi (delay 3 — 300ms)
- Card bg `--bg-surface`, radius-lg, padding 24px
- Title: "Selanjutnya" 16px bold
- 3 step list:
  1. Ikon Ear (atau Speaker) + "Tunggu nama kamu dipanggil"
  2. Ikon Monitor + "Cek layar untuk update status"
  3. Ikon Package + "Ambil pesanan saat siap"
- Tiap step: circle kecil merah + teks, spacing 16px

#### 5. Action Buttons (delay 4 — 400ms)
- Primary: "Lacak Status Pesanan" → `/status?orderId=...`
- Secondary: "Cetak Struk" (jika tidak offline)
- Ghost: "Pesan Lagi" dengan countdown timer "(15)"

**Countdown auto-redirect:**
- Teks kecil di bawah: "Kembali ke beranda dalam 15 detik..."
- Progress bar tipis di bottom page: memendek dari kanan ke kiri selama 15 detik, warna `--color-primary`

---

## 12. RESPONSIVE & MOBILE GUIDELINES

### Breakpoints

| Name | Width | Contoh Device |
|---|---|---|
| `kiosk` | 1080px | Kiosk portrait touchscreen |
| `desktop` | 1280px+ | Tablet landscape |
| `tablet` | 768px–1079px | iPad, tablet |
| `mobile` | 320px–767px | Smartphone |

### Adaptasi per Breakpoint

| Element | Kiosk | Tablet | Mobile |
|---|---|---|---|
| Product grid | 3 kolom | 2–3 kolom | 2 kolom |
| Font heading page | 36px | 28px | 24px |
| Button height | 60–72px | 56px | 52px |
| Card padding | 24px | 20px | 16px |
| Page padding | 40px | 32px | 20px |
| Header height | 72px | 64px | 60px |
| Touch target min | 56px | 52px | 48px |
| Category pill height | 44px | 40px | 36px |

### Perbedaan Mobile vs Kiosk

- **Mobile:** Bottom sheet lebih tinggi (85vh vs 75vh), font sedikit lebih kecil, lebih banyak scroll
- **Mobile:** Cart floating bar tetap ada, posisi fixed bottom
- **Mobile:** Checkout sections full width (tidak grid 2 kolom)
- **Mobile:** Success page queue number lebih kecil (56px vs 72px)
- **Kiosk:** Lebih sedikit scroll karena layar besar, konten lebih "above the fold"
- **Kiosk:** Tap target lebih besar (orang pakai jari dari jarak)

---

## 13. DESAIN YANG HARUS DIHINDARI (Anti-patterns)

- **Jangan** pakai glass-morphism / backdrop-blur effect (desain lama)
- **Jangan** pakai emoji sebagai ikon UI utama (ganti dengan Lucide icons)
- **Jangan** pakai gradient merah di tombol (pakai flat red #9F131E solid)
- **Jangan** teks terlalu kecil (< 13px) kecuali caption
- **Jangan** warna yang tidak ada di design system
- **Jangan** terlalu banyak animasi — minimal dan purposeful
- **Jangan** layout yang membuat user harus banyak scroll di halaman welcome
- **Jangan** tombol yang terlalu kecil (< 48px height)

---

## 14. REFERENSI VISUAL INSPIRASI

**Feel yang diinginkan:**
- Warm, premium, artisanal coffee brand
- Seperti: Toast POS, Square POS (UI clean), Coffee shop kiosk modern
- Clean white cards di atas warm beige background
- Typography yang tegas dan dibaca dari jauh
- Warna merah yang berani tapi tidak agresif, diimbangi beige dan coklat

**Mood:** Cozy coffee shop modern, bukan fast food. Premium tapi accessible.

---

*RAKKEN POS Design System v2.0 — prepared for Claude Design / Google Stitch*
*Scope: 6 Kiosk Customer-facing Pages + Mobile Responsive*
*Color palette: PANTONE brand official*
*Font: Plus Jakarta Sans*
