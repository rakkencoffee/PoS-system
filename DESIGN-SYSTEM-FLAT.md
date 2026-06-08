# RAKKEN POS KIOSK — DESIGN SYSTEM v3.0 (NEO-FLAT)
### For Claude Design / Google Stitch Implementation

---

## 0. INSTRUKSI UNTUK AI DESIGN TOOL

Dokumen ini adalah design system **Neo-flat / Flat 2.0** untuk **redesign total** Web POS Kiosk brand **RAKKEN** (StartFriday Coffee). Buatkan desain **6 halaman kiosk customer-facing** beserta versi **mobile responsive**-nya.

**Perbedaan KRITIS dari versi sebelumnya (v2.0 Warm Premium):**
- Background: **putih murni (#FFFFFF)**, bukan warm cream
- Style: **Neo-flat** — solid color fills, hampir zero shadow, bold color blocking
- Warna primer dan sekunder digunakan **jauh lebih dominan** sebagai elemen visual utama (bukan hanya aksen)
- **Tidak ada** gradients, glass-morphism, atau efek transparansi
- Depth hanya melalui **perbedaan warna**, bukan shadow

**Target output:** High-fidelity mockup semua halaman dalam 2 ukuran: **Kiosk (1080×1920px portrait)** dan **Mobile (390×844px)**.

---

## 1. BRAND CONTEXT

| | |
|---|---|
| **Brand** | RAKKEN by StartFriday |
| **Industri** | Specialty Coffee Shop / F&B |
| **Tone** | Bold, Modern, Clean, Confident |
| **Positioning** | Coffee brand dengan identitas visual yang tegas dan mudah dikenali |
| **Bahasa UI** | Indonesia + English (bilingual) |

---

## 2. USER PERSONA & KONTEKS PENGGUNAAN

| Atribut | Detail |
|---|---|
| **Pengguna** | Customer usia 18–40 tahun |
| **Perangkat** | Layar sentuh (touchscreen), tidak ada keyboard fisik |
| **Lingkungan** | Indoor — coffee shop, pencahayaan hangat |
| **Posisi** | Berdiri, jarak 30–60cm dari layar |
| **Durasi** | 1–3 menit per sesi |
| **Level tech** | Semua kalangan |

**Prinsip UX:**
1. Touch-first — minimum 56px touch target
2. Readable from distance — teks minimal 18px untuk konten utama
3. Bold & Clear — flat design harus kompensasi ketiadaan shadow dengan kontras warna yang kuat
4. Fast feedback — setiap interaksi langsung ada perubahan warna/state

---

## 3. DESIGN PRINCIPLES (NEO-FLAT)

1. **Color Does the Work** — Warna solid menggantikan shadow dan gradients untuk menciptakan hierarki.
2. **Primary Leads** — Merah (#9F131E) mendominasi sebagai warna utama: header, CTA, active state, highlight section.
3. **Pure White Base** — Background putih bersih sebagai kanvas. Tidak ada cream, beige, atau warm tint di background halaman.
4. **Almost-Flat Depth** — Shadow maksimal `0 1px 3px rgba(0,0,0,0.08)`. Tidak lebih. Kedalaman diciptakan via perbedaan warna antar layer.
5. **Solid Fills** — Semua elemen menggunakan warna solid. Tidak ada gradient, tidak ada opacity blur.
6. **Typography as Structure** — Bold type hierarchy menggantikan dekoratif visual. Judul besar, kontras tinggi.

---

## 4. COLOR SYSTEM

### 4.1 Brand Palette (7 Warna PANTONE — Hierarki Penggunaan)

| Prioritas | Token | Hex | PANTONE | Porsi Penggunaan |
|---|---|---|---|---|
| ★★★★★ | `--color-primary` | `#9F131E` | 7427 C | **Dominan** — header block, CTA, active fill, highlight section |
| ★★★★☆ | `--color-secondary-olive` | `#737C45` | 5763 C | **Signifikan** — status ready, badge positif, secondary CTA |
| ★★★★☆ | `--color-secondary-brown` | `#533F36` | 7617 C | **Signifikan** — teks body, icon, secondary surface block |
| ★★★☆☆ | `--color-neutral-dark` | `#323131` | 412 C | **Moderat** — heading utama, teks primer |
| ★★★☆☆ | `--color-neutral-white` | `#FFFFFF` | 663 C | **Moderat** — background page, card surface, teks di atas merah |
| ★★☆☆☆ | `--color-accent-beige` | `#D9C7A6` | 468 C | **Minimal** — divider, border subtle, tag background |
| ★★☆☆☆ | `--color-accent-taupe` | `#998075` | 7614 C | **Minimal** — placeholder, helper text, icon disabled |

### 4.2 Semantic Tokens

```css
/* ── BACKGROUND ── */
--bg-page:          #FFFFFF          /* Halaman utama — putih bersih */
--bg-section:       #F7F7F7          /* Section alternating — hampir tidak berbeda */
--bg-card:          #FFFFFF          /* Card surface */
--bg-primary-block: #9F131E          /* Section header merah solid */
--bg-secondary-block: #533F36        /* Section block coklat (alternatif) */
--bg-olive-block:   #737C45          /* Status block hijau */
--bg-primary-soft:  #F5E6E8          /* Red tint sangat ringan — hover, selected row */
--bg-olive-soft:    #EFF1E6          /* Olive tint ringan */
--bg-input:         #FFFFFF          /* Input background */
--bg-overlay:       rgba(50,49,49,0.65) /* Modal backdrop */

/* ── TEXT ── */
--text-primary:     #323131          /* Heading, label utama */
--text-secondary:   #533F36          /* Body text, deskripsi */
--text-muted:       #998075          /* Placeholder, helper, caption */
--text-inverted:    #FFFFFF          /* Text di atas surface merah/gelap */
--text-price:       #9F131E          /* Harga, total */
--text-discount:    #737C45          /* Potongan harga */
--text-error:       #9F131E          /* Error (pakai primary) */
--text-success:     #737C45          /* Success (pakai olive) */

/* ── BORDER ── */
--border-subtle:    #EBEBEB          /* Divider sangat halus */
--border-default:   #D9C7A6          /* Border default — beige */
--border-focus:     #9F131E          /* Input focus */
--border-strong:    #533F36          /* Emphasis, strong separation */
--border-primary:   #9F131E          /* Active card border */

/* ── INTERACTIVE STATES ── */
--state-hover:      #F5E6E8          /* Hover row / card — red tint */
--state-active:     #EDCFCF          /* Pressed state */
--state-selected:   #9F131E          /* Selected fill (teks jadi white) */
--state-disabled-bg: #F0EDED         /* Disabled background */
--state-disabled-text: #C4B5B5       /* Disabled text */

/* ── SHADOW (Neo-flat — sangat minimal) ── */
--shadow-card:  0 1px 2px rgba(50,49,49,0.06)    /* Card default */
--shadow-input: 0 1px 3px rgba(50,49,49,0.08)    /* Input focus */
--shadow-modal: 0 4px 16px rgba(50,49,49,0.14)   /* Modal / bottom sheet */
--shadow-bar:   0 -1px 4px rgba(50,49,49,0.08)   /* Bottom bar lift */

/* ── STATUS ── */
--status-success-bg:  #737C45        /* Solid olive untuk success block */
--status-warning-bg:  #C17D2B        /* Amber warm */
--status-error-bg:    #9F131E        /* Primary red */
--status-info-bg:     #2D5A8E        /* Biru netral */
```

### 4.3 Color Blocking Rules (Neo-flat Spesifik)

Hierarki visual diciptakan lewat **solid color fills**, bukan shadows:

| Layer | Warna | Contoh Penggunaan |
|---|---|---|
| **Page** | `#FFFFFF` | Background semua halaman |
| **Section block** | `#9F131E` | Header page, hero area, accent section |
| **Card** | `#FFFFFF` + 1px border | Kartu produk, form section |
| **Active/Selected** | `#9F131E` fill | Tombol aktif, kategori terpilih, payment method selected |
| **Muted surface** | `#F7F7F7` | Row alternating, input disabled |
| **Secondary block** | `#533F36` atau `#737C45` | Status bar, badge, secondary section |

---

## 5. TYPOGRAPHY

### 5.1 Font Family

**Primary: Plus Jakarta Sans**
- Google Fonts: `Plus Jakarta Sans`
- Weights digunakan: 400, 500, 600, 700, 800

**Monospace: JetBrains Mono**
- Digunakan hanya untuk: nomor antrian, Order ID, kode voucher

```css
--font-primary: 'Plus Jakarta Sans', system-ui, sans-serif;
--font-mono:    'JetBrains Mono', monospace;
```

### 5.2 Type Scale

| Token | Size | Weight | Line Height | Penggunaan |
|---|---|---|---|---|
| `display-2xl` | 80px | 800 | 1.0 | Nomor antrian hero (kiosk) |
| `display-xl` | 64px | 800 | 1.1 | Nomor antrian hero (mobile), success hero |
| `display-lg` | 48px | 800 | 1.15 | Welcome headline |
| `heading-xl` | 36px | 700 | 1.2 | Page title |
| `heading-lg` | 28px | 700 | 1.25 | Section heading |
| `heading-md` | 22px | 700 | 1.3 | Card title, item name |
| `heading-sm` | 18px | 600 | 1.35 | Sub-heading |
| `body-lg` | 17px | 500 | 1.5 | Body utama |
| `body-md` | 15px | 400 | 1.5 | Deskripsi |
| `body-sm` | 13px | 400 | 1.5 | Caption, hint |
| `label` | 12px | 700 | 1.0 | Badge, tag, label uppercase |
| `price-lg` | 32px | 700 | 1.0 | Harga total |
| `price-md` | 22px | 700 | 1.0 | Harga item |

**Neo-flat Typography Rule:** Heading di atas background merah selalu putih (#FFFFFF). Heading di atas putih selalu `--text-primary` (#323131). Tidak ada teks abu-abu di atas background berwarna.

---

## 6. SPACING SYSTEM

**Base: 4px**

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
```

**Touch target minimum:** 56px tinggi, 48px lebar

---

## 7. BORDER RADIUS

Tetap rounded (sama seperti v2.0) — neo-flat tidak identik dengan sharp corners:

```
--radius-xs:   4px    /* Tag, badge kecil */
--radius-sm:   8px    /* Input, chip */
--radius-md:   12px   /* Kartu, modal inner */
--radius-lg:   16px   /* Kartu standar */
--radius-xl:   24px   /* Section card besar */
--radius-2xl:  32px   /* Tombol pill, bottom sheet */
--radius-full: 9999px /* Badge bulat, avatar */
```

---

## 8. ICONOGRAPHY

- **Library:** Material Symbols Outlined (style: `FILL 0`, weight 400) — bersih dan flat
- **Alternatif:** Lucide React (stroke 1.5px)
- **Jangan:** Emoji sebagai ikon UI
- **Sizes:** 20px (button), 24px (nav/feature), 32px (hero section)
- **Warna:** Mengikuti konteks — putih di atas surface merah, `--color-primary` untuk CTA area, `--text-muted` untuk disabled

---

## 9. ANIMATION & MOTION

**Neo-flat: sama minimal dengan v2.0 — flat design tidak perlu elaborate animation**

```css
--ease-standard:   cubic-bezier(0.4, 0.0, 0.2, 1)
--ease-decelerate: cubic-bezier(0.0, 0.0, 0.2, 1)

--duration-fast:   100ms  /* State change (hover, active) */
--duration-normal: 200ms  /* Fade, slide */
--duration-slow:   300ms  /* Modal, page transition */
```

**Allowed:**
- `fadeIn` — 200ms (page load)
- `slideUp` — 200ms (card, modal masuk dari bawah)
- `scaleIn` — 150ms (tombol press)
- Color transition pada state change — 100ms

**Tidak digunakan:** gradient animation, blur, parallax, bounce, spring.

---

## 10. COMPONENT LIBRARY (NEO-FLAT)

---

### 10.1 Button

#### Primary Button
- Background: `#9F131E` solid — **tidak ada gradient**
- Text: putih (#FFFFFF), 17px weight 700
- Height: 60px kiosk / 56px mobile
- Padding: 0 32px
- Border Radius: `--radius-2xl` (32px)
- Shadow: `--shadow-card` (0 1px 2px — hampir tidak terlihat)
- **Tidak ada inner glow, tidak ada gradient overlay**

**States:**
| State | Background | Border | Text | Shadow |
|---|---|---|---|---|
| `default` | `#9F131E` | none | white | 0 1px 2px |
| `hover` | `#8A1019` | none | white | 0 1px 3px |
| `active/pressed` | `#780D15` | none | white | none |
| `loading` | `#9F131E` | none | white (spinner kiri) | 0 1px 2px |
| `disabled` | `#F0EDED` | none | `#C4B5B5` | none |
| `success` | `#737C45` | none | white | 0 1px 2px |

#### Secondary Button
- Background: `#FFFFFF`
- Border: 2px solid `#9F131E`
- Text: `#9F131E`, weight 700
- Height sama
- Border Radius: `--radius-2xl`

**States:**
| State | Background | Border | Text |
|---|---|---|---|
| `default` | white | 2px `#9F131E` | `#9F131E` |
| `hover` | `#F5E6E8` | 2px `#9F131E` | `#9F131E` |
| `active` | `#EDCFCF` | 2px `#780D15` | `#780D15` |
| `disabled` | white | 2px `#C4B5B5` | `#C4B5B5` |

#### Tertiary / Ghost Button
- Background: transparent
- Border: 1.5px solid `#D9C7A6` (beige)
- Text: `#533F36`
- Hover: bg `#F7F7F7`

#### Icon Button
- Shape: rounded-xl (12px) atau circle
- Size: 48×48px minimum
- Background: `#F7F7F7`
- Icon: 22px, `#533F36`
- Hover: bg `#F0EDED`
- Active: bg `#EDCFCF`

---

### 10.2 Input Field

- Label atas: 12px weight 700 uppercase, `#998075`, letter-spacing 0.06em
- Container: bg `#FFFFFF`, border 1.5px `--border-default` (#D9C7A6), radius `--radius-md` (12px)
- Teks input: 16px weight 400, `#323131`
- Height: 56px
- Shadow: none (flat!)

**States:**
| State | Border | Background | Shadow |
|---|---|---|---|
| `default` | 1.5px `#D9C7A6` | white | none |
| `focus` | 2px `#9F131E` | white | `--shadow-input` |
| `filled/valid` | 1.5px `#737C45` | white | none |
| `error` | 2px `#9F131E` | `#FFF8F8` | none |
| `disabled` | 1.5px `#EBEBEB` | `#F7F7F7` | none |

**Voucher Input (variant):**
- Font mono di dalam input
- Button embedded di kanan: background `#533F36` (tertiary/brown), text white
- Applied state: border `#737C45`, text hijau olive di bawah
- Error state: helper text `#9F131E`

---

### 10.3 Product Card (Menu)

**Kiosk:** 3 kolom | **Mobile:** 2 kolom

- Container: bg `#FFFFFF`, border 1px `#EBEBEB`, radius `--radius-lg` (16px), shadow `--shadow-card`
- Image: aspect 4:3, full width, object-cover, radius atas saja (16px atas, 0 bawah)
- Body: padding 14px
- Nama: 17px weight 700, `#323131`
- Harga: 20px weight 700, `#9F131E`
- Tombol "Tambah": `width: 100%`, height 40px, bg `#9F131E` solid, text putih, radius `--radius-sm`, 14px weight 700

**Badge (pojok kiri atas gambar):**
- "Best Seller": bg `#737C45` solid, text white, 11px weight 700 uppercase, radius-full, padding 4px 10px
- "Baru": bg `#9F131E` solid, text white

**States:**
| State | Border | Shadow | Scale |
|---|---|---|---|
| `default` | 1px `#EBEBEB` | 0 1px 2px | 1 |
| `hover` | 1px `#D9C7A6` | 0 1px 3px | 1.01 |
| `active` | 1px `#9F131E` | none | 0.99 |
| `sold out` | 1px `#EBEBEB` | none | 1 |

**Sold out:** Label overlay "Habis" — bg `#323131` opacity 70%, text white, center gambar. Tombol tambah: disabled state.

---

### 10.4 Cart Item Row

- Container: bg white, border-bottom 1px `#EBEBEB`, padding 16px
- Thumbnail: 72×72px, radius `--radius-sm`, bg `#F7F7F7`
- Nama: 16px weight 700, `#323131`
- Detail customization: 13px `#998075`
- Subtotal: 18px weight 700, `#9F131E`
- Quantity control:
  - Tombol `-`: 36×36px, bg `#F7F7F7`, border 1px `#EBEBEB`, radius `--radius-sm`, icon `#533F36`
  - Angka: 18px weight 700, `#323131`
  - Tombol `+`: 36×36px, bg `#9F131E` solid, icon putih, radius `--radius-sm`
- Tombol hapus: "Hapus" — 13px weight 600, `#9F131E`, kanan atas
- Tombol edit: "Edit" — 13px weight 500, `#533F36`, di bawah chips

---

### 10.5 Customization Chip

- Background: `#F7F7F7` (flat, no border)
- Text: 12px weight 500, `#533F36`
- Padding: 4px 10px, radius `--radius-full`
- **Tidak ada border** — flat style, warna bg sudah cukup untuk separation

---

### 10.6 Category Pill (Navigation)

- Height: 44px, padding: 0 20px, radius `--radius-full`
- **Inactive:** bg `#F7F7F7`, text `#533F36`, weight 500 — tidak ada border
- **Active:** bg `#9F131E` solid, text white, weight 700
- Transition: color + bg 100ms

---

### 10.7 Payment Method Card

- Container: bg white, border 1.5px `#EBEBEB`, radius `--radius-lg`, padding 16px
- Ikon box: 44×44px, bg `#F7F7F7`, radius `--radius-sm`
- Judul: 16px weight 600, `#323131`
- Sub: 13px `#998075`

**States:**
| State | Background | Border | Radio | Shadow |
|---|---|---|---|---|
| `inactive` | white | 1.5px `#EBEBEB` | empty circle | none |
| `hover` | `#F7F7F7` | 1.5px `#D9C7A6` | — | none |
| `selected` | `#F5E6E8` | 2px `#9F131E` | filled red dot | `0 1px 2px` |

---

### 10.8 Order Summary Row (Checkout)

- Qty: 22×22px pill, bg `#9F131E`, text white, 12px weight 700
- Nama item: 15px weight 500, `#323131`
- Detail: 12px `#998075`
- Harga: 15px weight 700, `#323131`, kanan
- Diskon: 12px `#737C45`

---

### 10.9 Status Progress Steps

3 step: **Diterima → Disiapkan → Siap Diambil**

| State | Circle | Text |
|---|---|---|
| Completed | Bg `#737C45` solid, icon ✓ putih | `#737C45` |
| Current | Bg `#9F131E` solid, angka putih | `#9F131E` weight 700 |
| Upcoming | Bg `#F7F7F7`, border 1.5px `#EBEBEB`, angka `#998075` | `#998075` |

Connector line: height 3px, completed segment bg `#737C45`, incomplete bg `#EBEBEB`

---

### 10.10 Toast / Notification

- Posisi: top-center, z-top
- Width: max 400px / full mobile
- Animasi: slideDown + fadeIn (200ms)
- Auto-dismiss: 3500ms

**Variants (semua solid fill — flat style):**

| Type | Background | Text | Icon |
|---|---|---|---|
| `success` | `#737C45` | white | CheckCircle |
| `error` | `#9F131E` | white | XCircle |
| `warning` | `#C17D2B` | white | AlertCircle |
| `info` | `#323131` | white | Info |

- Border-left tidak digunakan (v2.0 style). Gantinya: solid bg warna penuh
- Padding: 14px 20px, radius `--radius-lg`, shadow `--shadow-modal`
- Ikon: 20px putih kiri, teks 14px weight 600 putih, dismiss X pojok kanan

---

### 10.11 Badge

| Variant | Background | Text |
|---|---|---|
| `best-seller` | `#737C45` solid | white |
| `new` | `#9F131E` solid | white |
| `recommended` | `#EFF1E6` | `#737C45` |
| `pending` | `#FEF3DC` | `#C17D2B` |
| `preparing` | `#DCE8F5` | `#2D5A8E` |
| `ready` | `#737C45` solid | white |

Format: 12px weight 700 uppercase, padding 4px 10px, radius-full

---

### 10.12 Skeleton Loader

- Background dasar: `#F7F7F7`
- Shimmer: gradient `#F7F7F7` → `#EBEBEB` → `#F7F7F7`, 1.5s infinite
- Radius: sama dengan elemen aslinya
- **Tidak ada** warna brand di skeleton — pure gray/neutral

---

### 10.13 Empty State

- Ikon Lucide besar: 72px, warna `#D9C7A6`
- Judul: 20px weight 700, `#323131`
- Deskripsi: 14px `#998075`
- CTA: primary button

---

### 10.14 Error State

- Ikon: AlertTriangle atau WifiOff, 64px, `#9F131E`
- Judul: "Ada Masalah" — 20px weight 700
- Deskripsi: 14px `#998075`
- Retry: secondary button "Coba Lagi"

---

## 11. PAGE-BY-PAGE SPECIFICATIONS (NEO-FLAT)

---

### PAGE 1: WELCOME SCREEN (`/`)

**Konsep visual:** Dua blok — **atas merah bold** + **bawah putih bersih**. Sangat graphic, instant brand recognition.

#### Kiosk (1080×1920px):

**Blok Atas (60% layar):**
- Background: `#9F131E` solid — full bleed, tidak ada gambar/tekstur
- Konten (center vertikal):
  - Logo RAKKEN: putih, 220px wide
  - Tagline di bawah logo: "Specialty Coffee & More" — 16px uppercase, letter-spacing 0.12em, putih opacity 70%
  - Divider: 80px horizontal line, putih opacity 30%, margin vertikal 32px
  - Headline: "Selamat Datang" — 52px weight 800, putih

**Blok Bawah (40% layar):**
- Background: `#FFFFFF`
- Konten (center vertikal):
  - CTA button: "Mulai Pesan" — primary button full width (max 400px), height 72px, teks 22px weight 700
  - Sub-teks di bawah tombol: "atau sentuh layar di mana saja" — 14px `#998075`
  - Footer kecil: "Self-service · Bayar di sini" — 12px `#D9C7A6`, bottom

**Interaksi:** Seluruh layar clickable → `/menu`

#### Mobile (390×844px):
- Blok atas: 55% layar, konten proporsional
- Logo: 160px
- Headline: 38px
- CTA button: height 60px

---

### PAGE 2: MENU BROWSING (`/menu`)

**Header (sticky, height 68px kiosk / 60px mobile):**
- Background: `#FFFFFF`
- Border-bottom: 1px `#EBEBEB` (tidak ada shadow — flat)
- Kiri: Icon button back (ArrowLeft)
- Tengah: "RAKKEN" — 20px weight 800, `#9F131E`
- Kanan: Cart button — icon ShoppingBag + badge `#9F131E` solid (angka putih)

**Search Bar (sticky, di bawah header, bg `#FFFFFF`, padding 0 24px 12px):**
- Input: height 52px, radius `--radius-xl` (24px)
- Background: `#F7F7F7` (flat — tidak ada border)
- Search icon kiri: 20px `#998075`
- Placeholder: "Cari menu..." — `#998075`
- Focus state: bg white + border 1.5px `#9F131E`

**Category Pills (horizontal scroll, padding 0 24px 16px, gap 8px):**
- Inactive: bg `#F7F7F7`, text `#533F36` — tidak ada border
- Active: bg `#9F131E` solid, text white
- Height: 44px

**Section Header (tiap kategori):**
- Background: **`#9F131E` solid** — full width strip, height 40px
- Teks kategori: 14px weight 700 uppercase, letter-spacing 0.08em, **putih**
- Padding: 0 24px
- *Ini yang membedakan dari v2.0 — section header sekarang jadi red block bukan garis tipis*

**Product Grid:**
- Kiosk: 3 kolom, gap 16px, padding horizontal 24px
- Mobile: 2 kolom, gap 12px, padding horizontal 16px

**Floating Cart Bar (muncul saat ada item):**
- Fixed bottom, full width
- Background: `#9F131E` solid
- Kiri: icon ShoppingBag putih + "[N] item" putih
- Kanan: "Lihat Keranjang →" putih weight 700
- Height: 64px, tanpa radius (full width flat bar)

**Customize Modal:**
- Overlay: `rgba(50,49,49,0.65)`
- Modal: bg `#FFFFFF`, radius 24px atas saja, slide up dari bawah
- Header modal: bg `#9F131E`, padding 20px, teks putih — flat colored header
  - Nama produk: 20px weight 700 putih
  - Tombol close (X): icon button putih kanan atas
- Body: putih, scroll
- Tiap option group:
  - Label: 12px uppercase weight 700, `#998075`
  - Opsi chips: inactive = `#F7F7F7` bg (no border), active = `#9F131E` solid putih
- Footer: bg white, border-top 1px `#EBEBEB`
  - Total harga: 22px bold `#9F131E`
  - Tombol "Tambah ke Keranjang": primary full width

---

### PAGE 3: CART (`/cart`)

**Header:** sama dengan menu — "Keranjang" + count + back

**Section nama pelanggan (di atas list item):**
- Background: `#9F131E` solid — full width card/strip
- Label: "Nama Pesanan" — 12px uppercase `rgba(255,255,255,0.7)`
- Input: bg `rgba(255,255,255,0.15)`, border 1.5px `rgba(255,255,255,0.35)`, text putih, placeholder putih 60%
- Radius input: `--radius-md`
- *Input di atas background merah — kontras putih on red*
- Error (nama < 2 char): border `rgba(255,200,200,0.8)`, helper teks putih kecil
- Valid: border `rgba(255,255,255,0.6)`, tick icon putih

**Empty Cart State:**
- Center page
- Ikon ShoppingCart: 72px, `#D9C7A6`
- "Keranjang Kosong": 22px weight 700 `#323131`
- Sub: 14px `#998075`
- Tombol "Lihat Menu": primary button

**Item List:**
- bg `#FFFFFF`, border-bottom 1px `#EBEBEB` tiap item
- Lihat spec Cart Item Row

**Order Summary (di bawah list):**
- Background: `#F7F7F7` — flat, no border needed
- Radius: `--radius-lg`
- Rows: Subtotal, Diskon (jika ada — `#737C45`), Total
- Total: 28px weight 700 `#9F131E`

**Bottom Action Bar (sticky, bg `#FFFFFF`, border-top 1px `#EBEBEB`, shadow `--shadow-bar`):**
- 2 tombol: secondary "Tambah Item" (kiri, 45%) + primary "Checkout" (kanan, 55%)
- Checkout disabled jika nama belum valid

---

### PAGE 4: CHECKOUT (`/checkout`)

**Header:** "Checkout" + back

**Layout Kiosk: Split 2 kolom (55% kiri / 45% kanan)**

**Kolom Kiri — Ringkasan & Voucher:**
- Background: `#FFFFFF`
- Padding: 48px

Section header strip "Review Pesanan Anda":
- **Background: `#9F131E` solid** — strip penuh, height 48px
- Teks: 16px uppercase weight 700, putih
- Margin bottom: 24px

Item list:
- Tiap item: lihat Order Summary Row spec
- Separator: 1px `#EBEBEB`

Voucher area:
- Di bawah list, push to bottom
- Label: 12px uppercase `#998075`
- Input + Apply button (lihat Voucher Input spec)

**Kolom Kanan — Pembayaran:**
- Background: `#F7F7F7` — satu shade dari putih untuk separasi
- Border-left: 1px `#EBEBEB`
- Padding: 48px
- Max content width: 480px, centered

Nama pelanggan block:
- Background: `#FFFFFF`, border 1px `#EBEBEB`, radius `--radius-lg`
- Label: 12px `#998075`
- Nama: 20px weight 700 `#323131`
- Avatar: 36×36px circle, bg `#9F131E`, initial putih

Payment Summary card:
- Background: `#FFFFFF`, border 1px `#EBEBEB`, radius `--radius-xl`, shadow `--shadow-card`
- "Payment Summary": 20px weight 700
- Rows subtotal/diskon/total: lihat spec

Select Method label + 2 payment cards

Pay button: primary full width, height 60px

**Layout Mobile: Single column scroll + sticky bottom**

Sama dengan v2.0 structure tapi flat style — section headers jadi red strips.

Sticky bottom: bg `#FFFFFF`, border-top 1px `#EBEBEB`, total + pay button.

---

### PAGE 5: ORDER STATUS (`/status`)

#### Mode A: Status Publik (Dark board, dari jauh)

- Background: `#323131` solid — near-black, high contrast
- 3 kolom status:
  - "Menunggu": bg `#533F36` solid, teks putih — coklat warm
  - "Disiapkan": bg `#2D5A8E` solid, teks putih — biru
  - "Siap Diambil": bg `#737C45` solid, teks putih — olive green
- Nomor antrian tiap kolom: card `rgba(255,255,255,0.12)`, angka 28px bold font-mono putih
- Header kolom: 18px weight 700 uppercase putih

#### Mode B: Status Personal

- Background: `#FFFFFF`
- Header: "Status Pesanan" + back

**Queue Number Hero:**
- Container: **bg `#9F131E` solid**, full width strip, padding 48px 24px, radius `--radius-xl`
- Label: "Nomor Antrian Anda" — 12px uppercase, putih 70%
- Nomor: **80px weight 800 font-mono putih** (kiosk) / 64px (mobile)
- Order ID: 13px font-mono `rgba(255,255,255,0.6)`

**Status Badge:**
- Pending: bg `#FEF3DC`, text `#C17D2B`, border 1.5px `#C17D2B`
- Preparing: bg `#DCE8F5`, text `#2D5A8E`
- Ready: bg `#737C45` solid, text white — solid fill karena ini momen penting

**Progress Steps:** lihat spec di atas (flat solid circles)

**Ringkasan Pesanan:**
- Card: bg `#F7F7F7`, radius `--radius-lg`, padding 20px
- Header: "Pesanan Anda" 16px bold

**Footer:** "Kembali ke Beranda" — ghost button center

---

### PAGE 6: SUCCESS (`/success`)

**Konsep visual:** Hero block merah besar di atas, putih di bawah. Nomor antrian jadi protagonis utama.

**Hero Block (50% layar atas):**
- Background: `#9F131E` solid — full width
- Isi center:
  - Icon: CheckCircle — 64px, putih (kiosk) / 52px (mobile)
  - "Pembayaran Berhasil!" — 32px weight 800, putih
  - Sub: "Pesanan diterima oleh dapur kami" — 15px, `rgba(255,255,255,0.75)`

**Nomor Antrian (tumpang tindih hero dan white section — card elevated sedikit):**
- Card: bg `#FFFFFF`, radius `--radius-2xl`, shadow `--shadow-modal`
- Margin: -48px dari batas hero block, horizontal padding 24px
- Label: "Nomor Antrian" — 12px uppercase weight 700 `#998075`
- **Nomor: 80px weight 800 font-mono `#9F131E`** (kiosk) / 64px (mobile)
- Est. waktu: 14px `#998075`
- Order ID: 12px font-mono `#D9C7A6`

**Body Putih:**
- Background: `#FFFFFF`
- Padding atas: 80px (untuk ruang card antrian)

**Instruksi (3 langkah):**
- Container: bg `#F7F7F7`, radius `--radius-lg`, padding 24px
- Header "Selanjutnya": 16px weight 700 `#323131`
- Tiap langkah: circle 28px bg `#9F131E` solid + angka putih + teks 14px `#533F36`

**Action Buttons:**
- Primary: "Lacak Pesanan" → `/status`
- Secondary: "Cetak Struk"
- Ghost: "Pesan Lagi" + countdown

**Countdown Progress Bar:**
- Bottom fixed, full width, height 4px
- Background: `#EBEBEB`
- Fill: `#9F131E`, mengecil dari kanan dalam 15 detik

**Mode Offline:**
- Hero block: `#533F36` (coklat) bukan merah
- Icon: Clock putih bukan CheckCircle
- Teks "Pesanan Tersimpan" bukan "Pembayaran Berhasil"

---

## 12. RESPONSIVE & MOBILE GUIDELINES

| Element | Kiosk | Mobile |
|---|---|---|
| Product grid | 3 kolom | 2 kolom |
| Hero block (welcome) | 60% / 40% | 55% / 45% |
| Success hero | 50% layar | 45% layar |
| Font heading page | 36px | 26px |
| Button height | 60–72px | 52–60px |
| Card padding | 24px | 16px |
| Page padding | 40–48px | 16–20px |
| Header height | 68px | 60px |
| Touch target min | 56px | 48px |
| Category pill height | 44px | 40px |
| Red section header strip | height 48px | height 40px |

**Mobile spesifik:**
- Bottom bar always sticky dengan shadow `--shadow-bar`
- Modal selalu bottom sheet (85vh max-height)
- Section header strips tetap ada — tetap merah, hanya height sedikit lebih kecil
- Checkout: single column (tidak split 2 kolom)

---

## 13. NEO-FLAT ANTI-PATTERNS

- **Jangan** pakai shadow lebih dari `0 2px 4px` — ini flat design, bukan material
- **Jangan** pakai gradient sama sekali (background, tombol, apapun)
- **Jangan** pakai glass-morphism atau backdrop-blur
- **Jangan** teks warna abu-abu di atas background berwarna — selalu white on color
- **Jangan** border + shadow sekaligus di komponen yang sama — pilih salah satu
- **Jangan** warna beige/taupe sebagai background halaman — background harus putih atau solid color
- **Jangan** kategori section header pakai garis tipis (v2.0 style) — harus red strip block
- **Jangan** emoji sebagai ikon UI
- **Jangan** animasi elaborate — minimal only

---

## 14. PERBEDAAN UTAMA vs DESIGN-SYSTEM v2.0 (WARM PREMIUM)

| Aspek | v2.0 Warm Premium | v3.0 Neo-flat |
|---|---|---|
| Background | Warm cream `#F5ECD9` | Pure white `#FFFFFF` |
| Section headers | Garis tipis + teks | **Red solid block strip** |
| Card depth | Shadow `0 4px 16px` | Shadow `0 1px 2px` max |
| Button style | Gradient possible | **Solid flat only** |
| Toast style | Border-left colored | **Solid bg full** |
| Welcome page | Warm gradient | **Red block + white block** |
| Success page | Centered icon + card | **Red hero block + white body** |
| Color dominance | Merah sebagai aksen CTA | **Merah sebagai elemen struktural** |
| Customize modal | Neutral white header | **Red solid header block** |
| Category section | Subtle divider + icon | **Bold red strip full-width** |

---

## 15. REFERENSI VISUAL

**Feel yang diinginkan:**
- Seperti: Stripe dashboard (bold type, flat color), Linear app (clean solid colors), point-of-sale system modern (Shopify POS, Toast POS UI baru)
- Bold color blocking — tidak takut pakai warna
- Setiap section "tahu tempatnya" karena warna solid yang tegas
- Tidak perlu ornamen — struktur IS the design

**Mood:** Confident coffee brand. Tegas, bersih, mudah dibaca. Lebih bold dari v2.0.

---

*RAKKEN POS Design System v3.0 (Neo-flat) — prepared for Claude Design / Google Stitch*
*Scope: 6 Kiosk Customer-facing Pages + Mobile Responsive*
*Color palette: PANTONE brand official — Primary & Secondary dominant*
*Font: Plus Jakarta Sans + JetBrains Mono*
*Style: Neo-flat / Flat 2.0 — solid fills, minimal shadow, color blocking*
