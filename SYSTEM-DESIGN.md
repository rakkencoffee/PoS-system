# RAKKEN COFFEE — POS Kiosk System Design Specification
## For Google Stitch UI Generation

---

> **Language / Bahasa:** This document is written in **bilingual (English + Indonesian)** format.
> Each section provides both versions for use in Google Stitch prompt input.

---

## 1. PROJECT OVERVIEW / GAMBARAN PROYEK

### English
A self-service kiosk POS (Point of Sale) web application for **RAKKEN COFFEE**, a specialty coffee brand. Customers can browse the menu, customize their drinks (sugar level, ice level, milk type, bean origin, cream toppings), add to cart, and pay via digital payment or card terminal — all without a cashier. The app runs on a tablet/kiosk in landscape orientation (1024×768 minimum), but also has a mobile-friendly version for customer use on their own phones.

### Indonesian
Aplikasi POS self-service berbasis web untuk **RAKKEN COFFEE**, brand kopi spesialti. Pelanggan bisa browse menu, kustomisasi minuman (level gula, level es, jenis susu, origin biji kopi, topping krim), tambah ke keranjang, dan bayar via pembayaran digital atau terminal kartu — semua tanpa kasir. App berjalan di tablet/kiosk landscape (minimum 1024×768), namun juga memiliki versi mobile-friendly untuk penggunaan di smartphone pelanggan.

---

## 2. DESIGN SYSTEM / SISTEM DESAIN

### 2.1 Color Palette / Palet Warna

```
PRIMARY COLORS (Warna Utama)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Brand Red / Merah Utama
  PANTONE 7427 C
  HEX: #9F131E
  RGB: R:159, G:19, B:30
  Usage: CTA buttons, active states, brand accents, highlights

SECONDARY COLORS (Warna Sekunder)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Olive Green / Hijau Zaitun
  PANTONE 5763 C
  HEX: #737C45
  RGB: R:115, G:124, B:69
  Usage: Success states, badges, seasonal highlights

Dark Brown / Coklat Tua
  PANTONE 7617 C
  HEX: #533F36
  RGB: R:83, G:63, B:54
  Usage: Secondary headings, dark elements, rich accents

NEUTRAL COLORS (Warna Netral)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Pure White / Putih Murni
  PANTONE 663 C
  HEX: #FFFFFF
  RGB: R:255, G:255, B:255
  Usage: Card backgrounds, text on dark, main backgrounds

Near Black / Hampir Hitam
  PANTONE 412 C
  HEX: #323131
  RGB: R:50, G:49, B:49
  Usage: Primary text, dark backgrounds (KDS), strong contrast

ACCENT COLORS (Warna Aksen)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Warm Sand / Pasir Hangat
  PANTONE 468 C
  HEX: #D9C7A6
  RGB: R:217, G:199, B:166
  Usage: Background wash, warm overlays, dividers, decorative elements

Muted Taupe / Taupe Lembut
  PANTONE 7614 C
  HEX: #998075
  RGB: R:153, G:128, B:117
  Usage: Secondary text, placeholders, subtle borders, muted states

EXTENDED PALETTE (for UI states)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Background Soft     : #FDFAF6  (page background — warm off-white)
Background Secondary: #F5EDE0  (section backgrounds — warm sand)
Card Surface        : rgba(255, 255, 255, 0.95)
Glass Surface       : rgba(255, 255, 255, 0.85)
Border Subtle       : rgba(217, 199, 166, 0.4)  (#D9C7A6 @ 40%)
Border Default      : rgba(217, 199, 166, 0.7)  (#D9C7A6 @ 70%)
Shadow Color        : rgba(83, 63, 54, 0.08)    (#533F36 @ 8%)

STATUS COLORS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Success   : #22c55e  (order ready, payment confirmed)
Warning   : #f59e0b  (order pending, preparing)
Error     : #ef4444  (payment failed, error state)
Info/Live : #3b82f6  (real-time tracking, info banners)
```

### 2.2 Typography / Tipografi

```
FONT FAMILY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Primary   : "Plus Jakarta Sans", Inter, -apple-system, sans-serif
Monospace : "Courier New", Courier, monospace  (receipt, queue numbers)

FONT SCALE (Kiosk/Tablet — 1024px+)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Display XL  : 64px / 900 weight  (queue number, hero text)
Display L   : 48px / 800 weight  (page titles)
Display M   : 36px / 700 weight  (section headings)
Heading L   : 28px / 700 weight  (card titles, modal headings)
Heading M   : 22px / 600 weight  (item names, category labels)
Heading S   : 18px / 600 weight  (sub-headings, labels)
Body L      : 16px / 400 weight  (descriptions, body text)
Body M      : 14px / 400 weight  (secondary info, captions)
Caption     : 12px / 400 weight  (metadata, small labels)

FONT SCALE (Mobile — 375px–767px)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Display XL  : 40px / 900 weight
Display L   : 32px / 800 weight
Heading L   : 24px / 700 weight
Heading M   : 18px / 600 weight
Body L      : 15px / 400 weight
Body M      : 13px / 400 weight
```

### 2.3 Spacing & Grid / Spasi & Grid

```
SPACING SCALE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4px   xs    (tight icon gaps, inline spacing)
8px   sm    (compact element spacing)
12px  md    (standard inner padding)
16px  lg    (section padding, card padding)
24px  xl    (generous spacing, between sections)
32px  2xl   (large section gaps)
48px  3xl   (page-level padding)
64px  4xl   (hero sections, full-page margins)

BORDER RADIUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4px   xs   (small buttons, tags)
8px   sm   (inputs, small cards)
12px  md   (standard buttons, chips)
16px  lg   (cards, modals)
24px  xl   (large cards, panels)
9999px full (pills, circular badges)

GRID LAYOUT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Mobile     : 1 column  (375px–639px)
Tablet     : 2 columns (640px–1023px)
Kiosk/Desk : 3–4 columns (1024px+)
Max width  : 1440px centered
Gutter     : 16px (mobile), 24px (tablet+)
```

### 2.4 Elevation & Shadows / Elevasi & Bayangan

```
shadow-xs  : 0 1px 3px rgba(83,63,54,0.06)
shadow-sm  : 0 2px 8px rgba(83,63,54,0.08)
shadow-md  : 0 4px 16px rgba(83,63,54,0.10)
shadow-lg  : 0 8px 32px rgba(83,63,54,0.12)
shadow-xl  : 0 16px 48px rgba(83,63,54,0.15)
shadow-glow: 0 4px 24px rgba(159,19,30,0.25)  (brand red glow)
```

### 2.5 Component Design Tokens / Token Desain Komponen

```
BUTTONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
btn-primary
  Background  : linear-gradient(135deg, #C41525, #9F131E, #7D0F18)
  Text        : #FFFFFF
  Padding     : 14px 28px
  Radius      : 14px
  Font        : 600 / 16px
  Min-height  : 52px (touch-friendly)
  Hover       : brighten 10%, lift -2px, shadow-glow
  Active      : scale(0.96)
  Disabled    : opacity 0.5, cursor not-allowed

btn-secondary
  Background  : #FFFFFF
  Text        : #323131
  Border      : 1.5px solid #D9C7A6
  Padding     : 12px 24px
  Radius      : 12px
  Hover       : background #F5EDE0, border #998075

btn-ghost
  Background  : transparent
  Text        : #998075
  Padding     : 10px 20px
  Radius      : 10px
  Hover       : background rgba(217,199,166,0.2), text #533F36

btn-danger
  Background  : linear-gradient(135deg, #DC2626, #B91C1C)
  Text        : #FFFFFF
  Same shape as btn-primary

CARDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
glass-card
  Background  : rgba(255,255,255,0.95)
  Backdrop    : blur(12px)
  Border      : 1px solid rgba(217,199,166,0.4)
  Radius      : 24px
  Shadow      : shadow-sm
  Hover       : shadow-md, lift -3px, border rgba(217,199,166,0.7)
  Transition  : all 0.2s ease

INPUTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
input-default
  Background  : #FFFFFF
  Border      : 1.5px solid rgba(217,199,166,0.6)
  Radius      : 12px
  Padding     : 12px 16px
  Font        : 15px / 400
  Focus       : border #9F131E, ring 3px rgba(159,19,30,0.15)
  Placeholder : #998075

BADGES / TAGS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
badge-bestseller: background #FEF3C7, text #92400E, emoji 🔥
badge-recommended: background #DBEAFE, text #1E40AF, emoji ⭐
badge-hot: background #FEE2E2, text #991B1B
badge-iced: background #DBEAFE, text #1E40AF
badge-success: background #DCFCE7, text #166534
badge-warning: background #FEF3C7, text #92400E
badge-pending: background #FEF3C7, text #92400E
badge-preparing: background #DBEAFE, text #1E40AF
badge-ready: background #DCFCE7, text #166534
```

### 2.6 Animations / Animasi

```
ENTRANCE ANIMATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
fadeIn      : opacity 0→1, 500ms ease
fadeInUp    : opacity 0→1 + translateY(20px→0), 600ms ease
slideUp     : translateY(100%→0), 400ms cubic-bezier(0.32, 0.72, 0, 1)
slideDown   : translateY(-100%→0), 300ms ease
scaleIn     : scale(0.8→1) + opacity 0→1, 300ms ease
stagger     : each child delays by 100ms (max 5 children)

INTERACTION ANIMATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
tap-feedback  : scale(0.96), 100ms
hover-lift    : translateY(-2px) + shadow, 150ms
card-hover    : translateY(-3px) + brighten + shadow-md, 200ms
button-glow   : pulse glow aura (red), 2s loop

LOADING ANIMATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
shimmer     : gradient sweep left→right, 1.5s loop (skeleton loading)
spin-slow   : 360deg rotation, 20s linear loop (decorative background)
float       : translateY(-8px→0→-8px), 3s ease-in-out loop

PAGE TRANSITIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Route change: fadeIn 300ms
Modal open  : scaleIn from bottom, slideUp
Modal close : fadeOut + slideDown, 200ms
```

---

## 3. APP FLOW / ALUR APLIKASI

### English — User Journey Map
```
[Landing/Welcome] ──tap anywhere──▶ [Menu Page]
                                         │
                              ┌──────────┴──────────┐
                              │   Browse & Search    │
                              │   Filter by Category │
                              └──────────┬──────────┘
                                         │
                              [Click menu item]
                                         │
                              [Customize Modal]
                              │  - Select size      │
                              │  - Sugar level      │
                              │  - Ice level        │
                              │  - Milk type        │
                              │  - Bean origin      │
                              │  - Extra shots      │
                              │  - Cream topping    │
                              │  - Quantity         │
                              └──────────┬──────────┘
                                         │
                                 [Add to Cart]
                                         │
                              ┌──────────┴──────────┐
                              │  Continue Shopping   │
                              │  OR go to Cart ───▶  │
                              └──────────────────────┘
                                         │
                                    [Cart Page]
                              │  - Review items      │
                              │  - Edit/remove items │
                              │  - Enter customer    │
                              │    name              │
                              └──────────┬──────────┘
                                         │
                                  [Checkout Page]
                              │  - Order summary     │
                              │  - Apply voucher     │
                              │  - Select payment    │
                              │    (Online / EDC)    │
                              └──────────┬──────────┘
                                         │
                               ┌─────────┴────────┐
                          [Online Pay]        [EDC/Card]
                         Midtrans popup    Terminal prompt
                               └─────────┬────────┘
                                         │
                                   [Success Page]
                              │  - Queue number      │
                              │  - Print receipt     │
                              │  - Track order ───▶  │
                              └──────────┬──────────┘
                                         │
                                  [Status/Track Page]
                              │  - Order progress    │
                              │  - Real-time update  │
                              └──────────────────────┘
```

### Indonesian — Peta Perjalanan Pengguna
```
[Halaman Sambutan] ──tap di mana saja──▶ [Halaman Menu]
                                               │
                                  ┌────────────┴───────────┐
                                  │ Browse & Cari Menu     │
                                  │ Filter berdasar Kategori│
                                  └────────────┬───────────┘
                                               │
                                    [Klik item menu]
                                               │
                                    [Modal Kustomisasi]
                                    │ - Pilih ukuran         │
                                    │ - Level gula           │
                                    │ - Level es             │
                                    │ - Jenis susu           │
                                    │ - Asal biji kopi       │
                                    │ - Extra shot espresso  │
                                    │ - Topping krim         │
                                    │ - Jumlah               │
                                    └────────────┬───────────┘
                                               │
                                      [Tambah ke Keranjang]
                                               │
                                  ┌────────────┴───────────┐
                                  │  Lanjut Belanja        │
                                  │  ATAU pergi ke Keranjang│
                                  └────────────────────────┘
                                               │
                                      [Halaman Keranjang]
                                    │ - Review item          │
                                    │ - Edit/hapus item      │
                                    │ - Masukkan nama        │
                                    └────────────┬───────────┘
                                               │
                                     [Halaman Checkout]
                                    │ - Ringkasan pesanan    │
                                    │ - Pakai voucher        │
                                    │ - Pilih pembayaran     │
                                    │   (Online / EDC)       │
                                    └────────────┬───────────┘
                                               │
                                    ┌──────────┴──────────┐
                               [Bayar Online]       [EDC/Kartu]
                               Popup Midtrans    Instruksi terminal
                                    └──────────┬──────────┘
                                               │
                                      [Halaman Sukses]
                                    │ - Nomor antrean        │
                                    │ - Cetak struk          │
                                    │ - Lacak pesanan ───▶   │
                                    └────────────┬───────────┘
                                               │
                                    [Halaman Status/Lacak]
                                    │ - Progress pesanan     │
                                    │ - Update real-time     │
                                    └────────────────────────┘
```

---

## 4. SCREEN SPECIFICATIONS / SPESIFIKASI LAYAR

---

### 4.1 SCREEN 1: Landing / Welcome Page
**Route:** `/`

#### English Description
Full-screen welcome page. Background is the warm off-white (#FDFAF6) with subtle decorative coffee-related pattern or grain texture. Centered content with RAKKEN COFFEE logo at top, a welcoming headline ("Welcome to RAKKEN"), a subheadline in Indonesian ("Sentuh di mana saja untuk memulai pesanan Anda"), and a large pulsing "Touch to Start" button. Decorative coffee steam or ring elements float gently in background. Auto-redirects to menu if idle for 30 seconds.

**Kiosk Layout (1024×768+, landscape):**
- Full-screen hero with centered vertical alignment
- Logo: 120×120px centered top, brand red emblem
- Headline: 64px / 900 weight, #323131
- Subheadline: 24px / 400 weight, #998075
- CTA: Large pill button (280px × 64px), brand red gradient, white text "Mulai Pesan / Start Order"
- Pulsing glow animation on CTA button
- Bottom left: Store name & address in small text
- Bottom right: Current time display (HH:MM)

**Mobile Layout (375px–639px):**
- Same layout but stacked vertically
- Logo: 80px
- Headline: 40px
- Subheadline: 16px
- CTA: Full-width button

#### Indonesian Description
Halaman sambutan layar penuh. Background berwarna putih warm (#FDFAF6) dengan tekstur grain tipis atau pola kopi dekoratif. Konten terpusat dengan logo RAKKEN COFFEE di atas, judul yang hangat, sub-judul dalam bahasa Indonesia, dan tombol "Touch to Start" besar yang berdenyut. Elemen dekoratif seperti asap kopi atau cincin kopi mengambang lembut di background. Auto-redirect ke menu jika idle 30 detik.

---

### 4.2 SCREEN 2: Menu Page
**Route:** `/menu`

#### English Description
The main browsing experience. Sticky top header with logo + cart button. Below header: horizontal scrollable category tabs (category bar). Main content: responsive grid of menu item cards. Floating cart summary bar at bottom when cart has items.

**Kiosk Layout (1024px+):**
- **Header** (sticky, 72px height):
  - Left: RAKKEN COFFEE logo (small, 40px)
  - Center: Search bar (500px wide, rounded, placeholder "Search menu...")
  - Right: Cart button with item count badge (red dot)
  
- **Category Bar** (sticky below header, 80px height):
  - Horizontal scroll with arrow buttons
  - Categories as rounded pill tabs: inactive = white bg + #533F36 text, active = #9F131E bg + white text
  - Each tab: emoji icon + category name
  - Smooth scroll with active tab always in view
  - Tabs: "All Menu", "Rakken Signature", "Rakken Style", "Non Coffee", "Dessert", "Snack", "Bites", "Main Course"

- **Menu Grid** (main scrollable area):
  - 4 columns on 1280px+, 3 columns on 1024px
  - Grid gap: 20px
  - Padding: 24px horizontal, 16px top

- **Menu Card** (glass-card):
  - Size: ~240px × 320px
  - Top 60%: Product image (rounded top corners), fills width
  - Badge overlay top-left: "BEST SELLER 🔥" (amber) or "RECOMMENDED ⭐" (blue) — pill badge
  - Badge overlay top-right: "HOT ☕" / "ICED 🧊" / "HOT & ICED"
  - Bottom 40% white area:
    - Product name: 18px / 600, #323131
    - Short description: 13px / 400, #998075 (1 line, truncated)
    - Price: 20px / 700, #9F131E "Rp 38.000"
    - "Pilih / Select" button: brand red, full width, 44px height
  - Hover: lift + shadow glow
  - Out of stock: grayscale filter + "Habis / Unavailable" overlay

- **Cart Summary Bar** (sticky bottom, 72px):
  - Background: brand red gradient
  - Left: Cart icon + item count badge
  - Center: "{N} items" text
  - Right: Total price + "View Cart →" text
  - Appears with slideUp animation when cart has items
  - Only visible when cart is non-empty

**Mobile Layout:**
- Header: Logo + hamburger menu OR just Logo + Cart icon
- Category bar: Full-width horizontal scroll (no arrows)
- Menu grid: 2 columns (375px), gap 12px
- Card: simplified — image top, name + price + select button
- Cart bar: Same sticky bottom behavior

---

### 4.3 SCREEN 3: Customization Modal
**Route:** `/menu` (modal overlay)

#### English Description
Full-screen modal (or bottom sheet on mobile) that appears over the menu when user taps a menu item. Shows product image at top, product details, then customization options organized in sections. Sticky footer with quantity control and "Add to Cart" button.

**Kiosk Layout:**
- **Overlay:** semi-transparent black backdrop (rgba(0,0,0,0.5))
- **Modal Container:** centered card, max-width 680px, max-height 85vh, scrollable content
- **Top section (inside modal):**
  - Product hero image: full width, 200px height, object-cover
  - Close (X) button: top-right corner
  - Product name: 28px / 700
  - Description: 14px / 400, #998075
  - Base price: 24px / 700, #9F131E

- **Options Sections** (each collapsible with smooth expand):

  *SIZE SELECTION* (always shown for coffee):
  - Grid: 2–3 columns
  - Each option: white card, radio-style selection
  - Selected: border #9F131E, light red bg tint
  - Shows: size name + price adjustment ("Hot", "Ice +0", "Upsize +5.000")

  *SUGAR LEVEL* (shown for drinks):
  - Label: "Tingkat Gula / Sugar Level"
  - 4 options in row: "Tanpa Gula / None", "Kurang / Less", "Normal", "Lebih / More"
  - Pill-style selector (border highlight when active)

  *ICE LEVEL* (shown for iced drinks):
  - Label: "Tingkat Es / Ice Level"
  - 4 options: "Tanpa Es / No Ice ❄️", "Kurang / Less", "Normal", "Banyak / More"
  - Same pill-style

  *MILK TYPE* (shown for applicable drinks):
  - Label: "Pilihan Susu / Milk Choice"
  - 3 options: "Dairy 🥛 (Free)", "Skim Milk (+6.000)", "Oat Milk 🌾 (+6.000)"
  - Card-style with price badge

  *BEAN ORIGIN* (shown for coffee):
  - Label: "Pilihan Biji Kopi / Bean Choice"
  - 2 options: "RAKKEN Blend (Free)", "PNG Signature (+6.000)"
  - Card-style with origin info

  *EXTRA SHOT* (shown for coffee):
  - Label: "Extra Espresso"
  - 3 options: "Normal (Free)", "+1 Shot (+6.000)", "+2 Shots (+12.000)"

  *CREAM TOPPING* (shown for applicable drinks):
  - Label: "Krim Tambahan / Cream Add-on"
  - Toggle cards: "Sea Salt Cream", "Cheese Cream"
  - Shows price or "FREE" badge

- **Sticky Footer (modal bottom):**
  - Quantity control: "–" / number / "+" buttons (large, touch-friendly, 52px each)
  - Right side: Dynamic total price (updates with options)
  - Full-width "Tambah ke Keranjang / Add to Cart" button (#9F131E)
  - If editing existing item: "Update Pesanan / Update Order" text

**Mobile Layout:**
- Modal becomes bottom sheet (slides from bottom, 85% viewport height)
- Swipe down to close
- Sticky top: product name + close button
- Scrollable body

---

### 4.4 SCREEN 4: Cart Page
**Route:** `/cart`

#### English Description
Review all items in cart before proceeding to checkout. Shows each item with customization details, individual prices, quantity controls, and edit/delete options. Bottom section has order summary with subtotal and checkout button.

**Kiosk Layout:**
- **Header:** Back arrow ("← Menu") + "Keranjang / Cart" title + item count
- **Two-column layout (split view):**

  *Left Column (60% width) — Cart Items:*
  - Each cart item as a card:
    - Left: Product thumbnail (64×64px, rounded)
    - Middle: Product name (bold), size tag (pill badge), customization summary (small text, #998075)
      - e.g., "Sugar: Normal • Ice: Less • Oat Milk • +1 Shot"
    - Right: Subtotal price (bold, #9F131E)
    - Bottom row: Quantity control ("–" / count / "+") + Edit icon button + Delete icon button
  - Empty state: Coffee cup illustration + "Keranjang kosong / Your cart is empty" + "Back to Menu" button

  *Right Column (40% width) — Order Summary Panel:*
  - Customer name input (required, "Nama kamu / Your name"):
    - Red asterisk on label
    - Character limit: 30
    - Large input, 56px height
  - Divider
  - "Ringkasan Pesanan / Order Summary"
  - Line items: each item × qty = price
  - Subtotal row (bold)
  - Promo note: "Voucher bisa dimasukkan di checkout"
  - "Lanjut ke Checkout / Proceed to Checkout" button:
    - Brand red, full width, 64px height, 700 weight
    - Disabled until customer name is filled
    - Shows disabled state clearly (opacity + text "Masukkan nama dulu")

**Mobile Layout:**
- Single column
- Cart items list (full width)
- Customer name input below list
- Order summary card at bottom
- Sticky "Checkout" button at very bottom

---

### 4.5 SCREEN 5: Checkout Page
**Route:** `/checkout`

#### English Description
Final review and payment. Shows itemized order with potential discounts, voucher input, and payment method selection.

**Kiosk Layout:**
- **Header:** Back arrow + "Checkout" title
- **Two-column layout:**

  *Left Column (55%) — Order Details:*
  - Customer name badge: "👤 {Name}"
  - Section: "Pesanan Kamu / Your Order"
  - Each item:
    - Name + size (bold)
    - Customization tags (small colored pills)
    - Quantity × unit price
    - If discounted: strikethrough original + discounted price (green)
  - Divider line

  - Section: "Kode Voucher / Voucher Code"
  - Input field + "Pakai / Apply" button side by side
  - Success state: green check + discount amount
  - Error state: red X + error message
  - "Hapus / Remove" button if voucher applied

  *Right Column (45%) — Payment Panel:*
  - "Rincian Pembayaran / Payment Details" card
  - Subtotal row
  - Discount row (green, if applicable)
  - Separator
  - Total row: 28px / 800, #9F131E
  
  - "Metode Pembayaran / Payment Method"
  - Two large option cards:
    - Card 1: "💳 Online (QRIS / Transfer)"
      - Subtitle: "Scan QR Code atau transfer bank"
      - Selected: red border + light tint
    - Card 2: "🏧 EDC (Kartu Debit/Kredit)"
      - Subtitle: "Tap atau gesek kartu di terminal"
  
  - "Bayar Sekarang / Pay Now" button:
    - Brand red, full width, 68px height
    - Loading state: spinner + "Memproses / Processing..."
    - Disabled if no payment method selected

**Mobile Layout:**
- Single column scroll
- Order details first
- Voucher input below
- Payment panel at bottom (sticky)

---

### 4.6 SCREEN 6: Success Page
**Route:** `/success`

#### English Description
Post-payment confirmation. Shows queue number prominently with order ID, step-by-step instructions, receipt print button, and auto-countdown back to home.

**Kiosk Layout — Full-screen celebratory:**
- **Background:** Soft confetti animation OR subtle particle effect
- **Center Card (max 560px wide, centered):**

  - **Success Icon:**
    - Circle badge: green bg + white checkmark (for online)
    - OR amber bg + hourglass (for offline/pending)
    - 100px diameter, with pulsing glow ring
    - Scale-up entrance animation

  - **Headline:** "Pesanan Diterima! / Order Placed!"
  - **Sub:** "Nomor Antrean Kamu / Your Queue Number"

  - **Queue Number Block:**
    - Giant monospace text: "#042" (64–72px)
    - Soft red tinted background box
    - Label below: "Order ID: OL26051500000205" (small, #998075)

  - **Steps (3-step guide):**
    - Step 1: 🕐 "Tunggu nomormu dipanggil"
    - Step 2: 📺 "Pantau status di layar display"
    - Step 3: ☕ "Ambil pesananmu saat sudah siap"
    - Each as a horizontal card with icon + text

  - **Action Buttons:**
    - Primary: "🧾 Cetak Struk / Print Receipt" (white bg, brand red border + text)
    - Secondary: "📍 Lacak Pesananku / Track My Order" (ghost button)
    
  - **Auto-Redirect Counter:**
    - "Kembali ke menu dalam {N} detik / Back to menu in {N}s"
    - Circular progress indicator around countdown number
    - "Batalkan / Cancel" link to stop redirect

**Mobile Layout:**
- Same but more compact
- Countdown less prominent
- Receipt button full-width

---

### 4.7 SCREEN 7: Order Status / Tracking Page
**Route:** `/status?orderId=...`

#### English Description
Real-time order tracking page. Shows current order status with progress bar, order items list, and estimated wait time. Updates automatically via WebSocket (Pusher) or SSE.

**Kiosk Layout:**
- **Header:**
  - Back to Home link
  - "🔴 LIVE" badge (pulsing red dot when connected)
  - Queue number: "#042"

- **Progress Tracker:**
  - 3-step horizontal progress bar:
    - Step 1: "Diterima / Received" ✓ (green when passed)
    - Step 2: "Sedang Dibuat / Preparing" ⏳ (amber when current, pulsing)
    - Step 3: "Siap Diambil / Ready" ☕ (green when reached)
  - Connecting line between steps, fills with color as status advances
  - Current step label pulses softly

- **Status Card:**
  - Large status icon (changes per state)
  - PENDING: ⏳ amber — "Pesanan sedang diproses"
  - PREPARING: 👨‍🍳 blue — "Barista sedang menyiapkan pesananmu"
  - READY: ☕ green — "Pesananmu siap! Silakan ambil"
  - Estimated wait: "~5–10 menit"

- **Order Items Summary:**
  - List of ordered items (quantity × name × size)
  - Compact card style

- **Customer Name Display:**
  - "Pesanan untuk: {Name}"

- **Public Board Mode** (no orderId param):
  - 3 columns full-width: Pending | Preparing | Ready
  - Each column shows queue numbers as large number chips
  - Numbers slide in when added, animate out when removed
  - Designed for TV/monitor in waiting area
  - Dark background option for this mode

**Mobile Layout:**
- Same but single-column
- Large queue number at top
- Progress bar below
- Status card below progress

---

### 4.8 SCREEN 8: Kitchen Display System (KDS)
**Route:** `/kitchen` (staff-only)

#### English Description
Two-column real-time order management screen for kitchen staff. Left column shows pending orders (not yet started), right column shows orders currently being prepared. Dark theme, large readable text, minimal distraction.

**Full-Screen Dark Layout:**
- **Background:** #0F0F0F (near black)
- **Page Header (40px):**
  - Left: "🍳 KITCHEN" or "☕ BARISTA" station name (white, 20px/600)
  - Right: Time + date + "LIVE" indicator
  
- **Search Bar** (below header):
  - Full-width, dark bg (#1A1A1A), white text
  - Placeholder: "Cari nomor antrean, nama pelanggan, atau item..."

- **Two-Column Grid:**

  *Left Column — PENDING (yellow theme):*
  - Column header: "🕐 Menunggu / Pending" + count badge (amber pill)
  - Order Cards (each ~300px wide):
    - Top: Queue number large (40px, #F59E0B amber) + "PENDING" badge
    - Sub: Order ID + timestamp (small, #6B7280)
    - Customer name badge (amber bg, 👤 icon)
    - Item list (dark box, #1C1C1C):
      - Each item: quantity + name + size (white, 15px)
      - Customization pills below item:
        - Sugar: amber pill "Gula: Normal"
        - Ice: blue pill "Es: Less"
        - Milk: gray pill "Oat Milk"
        - Other notes: gray pill
    - Action button: "👨‍🍳 Mulai Buat / Start Making" (blue, full-width, 52px)
  
  *Right Column — PREPARING (blue theme):*
  - Column header: "👨‍🍳 Sedang Dibuat / Preparing" + count badge (blue pill)
  - Same order card structure
  - Queue number color: #3B82F6 blue
  - "PREPARING" badge
  - Action button: "🎉 Selesai / Complete" (green, full-width, 52px)

- **Empty State per column:** Subtle icon + text "Tidak ada pesanan / No orders"
- **Order card entrance:** slideIn from top, stagger by index
- **Completion animation:** card slides out/fades when completed

---

## 5. COMPONENT LIBRARY / LIBRARY KOMPONEN

### 5.1 Reusable Components / Komponen yang Bisa Dipakai Ulang

```
NAVIGATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TopNavBar        - Logo + search + cart icon + time display
CategoryBar      - Horizontal scrollable category tabs with emoji icons
BackHeader       - Back arrow + page title + optional right action
BottomCartBar    - Floating sticky bar showing cart summary

CARDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MenuCard         - Product image + badges + name + price + CTA
CartItemCard     - Thumbnail + details + quantity control + actions
OrderSummaryCard - Itemized order with subtotals
KdsOrderCard     - Kitchen display order card (dark theme)
PaymentMethodCard - Payment option selection card

MODALS & OVERLAYS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CustomizeModal   - Full customization options for a menu item
ConfirmModal     - Generic confirmation dialog (delete, etc.)
LoadingOverlay   - Full-screen loading with spinner

FORMS & INPUTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TextInput        - Standard text input with label + error state
VoucherInput     - Input + apply button combination
SearchInput      - Search with icon + clear button

SELECTORS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SizeSelector     - Grid of size option cards (radio-style)
LevelSelector    - 4-option pill row (sugar, ice levels)
ToggleCard       - On/off toggleable card (cream toppings)
QuantityControl  - Minus / Number / Plus stepper

FEEDBACK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ProgressStepper  - 3-step horizontal progress tracker
StatusBadge      - Color-coded status chip
QueueNumberDisplay - Large monospace queue number display
LiveIndicator    - Pulsing red dot + "LIVE" text
CountdownTimer   - Circular progress countdown

LOADING STATES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MenuCardSkeleton    - Shimmer skeleton for menu card
CartItemSkeleton    - Shimmer skeleton for cart item
InlineSpinner       - Small spinner for button loading states
PageLoader          - Full page loading state with RAKKEN logo

EMPTY STATES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EmptyCart        - Illustration + message + back button
EmptySearch      - Search no results state
EmptyKds         - No orders for kitchen station
```

---

## 6. INTERACTIVE STATES / STATUS INTERAKTIF

### For Every Interactive Element:

```
BUTTON STATES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Default   → Hover (desktop: brighten, lift) → Active (scale 0.96) → Disabled
Loading   → shows spinner, disabled interaction, opacity maintained

INPUT STATES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Default → Focus (red border + ring) → Filled → Error (red border + message)
→ Success (green border + checkmark)

CARD STATES (Menu cards, option cards)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Default → Hover (lift + shadow) → Selected (red border + tint) → Disabled (grayscale)

OPTION SELECTOR STATES (Size, sugar, ice)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Unselected → Hover → Selected (red border, #9F131E outline, light tint fill)
→ Unavailable (strikethrough, opacity 0.4)
```

---

## 7. RESPONSIVE BEHAVIOR / PERILAKU RESPONSIF

### Breakpoints

```
Mobile     : 375px – 639px
Mobile L   : 640px – 767px
Tablet     : 768px – 1023px
Kiosk/Desk : 1024px – 1440px
Wide       : 1440px+
```

### Behavior Per Screen

| Screen | Mobile | Tablet | Kiosk |
|--------|--------|--------|-------|
| Landing | Stacked center, full-screen CTA | Same | Full landscape hero |
| Menu | 2-col grid, bottom cart bar | 3-col grid | 4-col grid, sticky sidebar option |
| Customize | Bottom sheet modal | Center modal | Center modal |
| Cart | Single col stacked | Split (70/30) | Split (60/40) |
| Checkout | Single col scroll | Split (55/45) | Split (55/45) |
| Success | Centered card | Centered card | Full center, larger number |
| Status | Single col | Centered card | Centered card, public board multi-col |
| KDS | N/A (staff tablet) | 2-col | 2-col dark |

---

## 8. BRANDING ELEMENTS / ELEMEN BRANDING

### Logo Usage
- **Light backgrounds:** Full-color RAKKEN COFFEE logo (dark text + brand red emblem)
- **Dark backgrounds:** White/light version
- **Favicon/App icon:** Red emblem only (square, rounded 12px)
- **Clearspace:** At least 16px padding around logo

### Voice & Tone / Suara & Nada
- **Warm, friendly, casual** — not formal corporate
- **Bilingual:** Indonesian primary, English secondary (in parentheses or smaller)
- **Action words:** "Pilih" (Select), "Tambah" (Add), "Bayar" (Pay), "Lacak" (Track)
- **Encouragement:** "Yuk mulai pesan!", "Pesananmu segera siap!"

### Brand Personality
- Modern specialty coffee aesthetic
- Indonesian local pride (biji kopi lokal, brand Rakken)
- Clean, minimal, not cluttered
- Warm earth tones + bold red accents
- Photography: real coffee shots, bokeh bg, warm lighting

---

## 9. ACCESSIBILITY & TOUCH / AKSESIBILITAS & SENTUH

### Touch Target Requirements (Kiosk)
- All tap targets minimum **52×52px**
- Quantity steppers (+/–): minimum **56×56px**
- Option selectors: minimum **80px wide, 52px tall**
- CTA buttons: minimum **64px tall**

### Touch Feedback
- Every tappable element: scale(0.96) on `active`
- Hold/long press: subtle background darkening
- No hover-only interactions
- Tap = immediate response (no 300ms delay)

### Color Contrast
- All body text: minimum **4.5:1** contrast ratio
- Large text/buttons: minimum **3:1** ratio
- Status indicators: never rely on color alone — use icon + label

### Language Support
- Primary: Indonesian (Bahasa Indonesia)
- Secondary: English in parentheses or italics
- Numbers: Indonesian format (Rp 38.000 not Rp 38,000)
- Currency: Always "Rp" prefix, no decimal for whole amounts

---

## 10. SPECIAL STATES / STATUS KHUSUS

### Offline Mode / Mode Offline
- Amber banner at top: "⚠️ Tidak ada koneksi — Pesananmu akan disimpan sementara"
- Cart still functional
- Payment shows "Offline Mode: Pesanan akan diproses saat koneksi pulih"
- Success page shows amber (not green) icon + "Pesanan dalam antrean offline"

### Loading States
- Menu skeleton: shimmer cards in grid (same count as expected items)
- Category bar skeleton: shimmer pills
- Checkout payment loading: full overlay spinner with "Memuat gateway pembayaran..."
- Order submission: button spinner + disabled state
- Status page refresh: subtle top progress bar (not blocking)

### Error States
- API failure: red banner + retry button
- Payment failed: modal with error message + "Coba Lagi / Try Again" button
- Invalid voucher: red input border + "Kode voucher tidak valid" message
- Out of stock item in cart: amber warning + "Item habis, mohon hapus dari keranjang"

### Success Animations
- Add to cart: item "flies" to cart icon (arc animation)
- Cart icon: bounces + count badge pops
- Payment success: confetti burst OR ripple animation from center
- Order complete (KDS): card slides out to the right

---

## 11. GOOGLE STITCH PROMPT — ENGLISH VERSION

### Copy this prompt into Google Stitch:

---

**PROMPT (English):**

Design a modern, warm self-service coffee kiosk UI for a brand called **RAKKEN COFFEE**. This is a web-based POS kiosk app that runs on tablets (landscape 1024×768) and smartphones.

**Brand Identity:**
- Brand red: #9F131E (primary CTA, active states, brand accents)
- Warm off-white background: #FDFAF6
- Near-black text: #323131
- Warm sand accent: #D9C7A6
- Olive green: #737C45 (secondary)
- Dark brown: #533F36 (secondary)
- Muted taupe: #998075 (secondary text)
- Card bg: white with glass morphism effect, subtle warm border

**Design Style:**
- Modern specialty coffee aesthetic
- Warm and inviting, not clinical
- Glass morphism cards with subtle shadow
- Generous white space
- Smooth animations (slide-up, fade-in, scale)
- Bilingual (Indonesian + English)
- Touch-optimized (min 52px tap targets)

**Screens to Design:**

**Screen 1 — Welcome/Landing:**
Full-screen warm white (#FDFAF6) page. Centered RAKKEN COFFEE logo (120px). Headline "Selamat Datang di RAKKEN / Welcome to RAKKEN" in 64px bold #323131. Subtitle "Sentuh di mana saja untuk memulai" in 24px #998075. Large pulsing pill CTA button in brand red gradient (#9F131E) "Mulai Pesan / Start Order" (280×64px). Decorative subtle grain texture in background. Bottom: store name + current time.

**Screen 2 — Menu Page:**
Sticky top header (72px): left logo, center search bar (rounded, warm border), right cart icon with red count badge. Below: sticky category tabs (horizontal scroll, pill style, active=red, inactive=white/brown). Main: 4-column grid of product cards. Each card (glass, 24px radius): product image top 60%, bottom 40% white: name bold, description small gray, price red bold, "Pilih" button red full-width. Floating sticky bottom cart bar (red gradient) showing item count + total. Bottom bar only shows when cart has items.

**Screen 3 — Customization Modal:**
Centered modal overlay (max 680px). Top: full-width product image (200px), product name (28px bold), description, base price (red). Scrollable body with sections: SIZE (grid of cards, radio select), SUGAR LEVEL (4 pill options in row), ICE LEVEL (4 pill options), MILK TYPE (3 cards with prices), BEAN ORIGIN (2 cards), EXTRA SHOT (3 options), CREAM TOPPINGS (2 toggle cards). Sticky footer: quantity stepper (–/number/+) left + dynamic total price + "Tambah ke Keranjang" red button full-width right.

**Screen 4 — Cart Page:**
Two-column layout. Left (60%): list of cart items as cards — thumbnail + name + customization tags (small pills) + subtotal + qty stepper + edit/delete icons. Right (40%): sticky summary panel — customer name input (required, large), divider, item subtotals, "Lanjut Checkout" red button full-width bottom (disabled when no name). Mobile: single column stacked.

**Screen 5 — Checkout Page:**
Two-column. Left (55%): order summary list with customer name badge, items with customization tags, voucher code input + "Pakai" button. Right (45%): payment details card — subtotal + discount + bold total in red, two large payment method cards (Online QRIS / EDC Card), "Bayar Sekarang" red button (68px). Loading state on button.

**Screen 6 — Success Page:**
Centered card on full-screen. Top: pulsing green circle badge with ✓ icon (100px, glow effect). Headline "Pesanan Diterima!" Large monospace queue number "#042" (72px) in red-tinted box. 3-step instructions in horizontal cards (icon + text). Buttons: "Cetak Struk" (secondary) + "Lacak Pesanan" (ghost). Bottom: auto-countdown timer with circular progress "Kembali ke menu dalam 10s".

**Screen 7 — Order Status:**
Queue number at top (#042 large bold). "🔴 LIVE" badge. 3-step horizontal progress tracker (filled/pulsing per status: Received → Preparing → Ready). Status card: large icon + status title + description. Items list compact. Mobile-friendly, single column.

**Screen 8 — Kitchen Display (KDS):**
Dark theme (#0F0F0F background). Two-column: Left=PENDING (amber accents), Right=PREPARING (blue accents). Each order card: large queue number (amber/blue), "Start Making" or "Complete" CTA button, item list with colored customization tags. Search bar full-width below header. Clean, legible, no decorative elements — functional dark UI.

---

## 12. GOOGLE STITCH PROMPT — INDONESIAN VERSION

### Copy ini ke Google Stitch:

---

**PROMPT (Indonesian):**

Desainkan UI kiosk kopi self-service yang modern dan hangat untuk brand bernama **RAKKEN COFFEE**. Ini adalah aplikasi POS berbasis web yang berjalan di tablet (landscape 1024×768) dan smartphone.

**Identitas Brand:**
- Merah brand: #9F131E (CTA utama, state aktif, aksen brand)
- Background putih warm: #FDFAF6
- Teks near-black: #323131
- Aksen pasir hangat: #D9C7A6
- Hijau zaitun: #737C45 (sekunder)
- Coklat tua: #533F36 (sekunder)
- Taupe lembut: #998075 (teks sekunder)
- Background card: putih dengan efek glass morphism, border warm tipis

**Gaya Desain:**
- Estetika kopi spesialti modern
- Hangat dan mengundang, bukan klinisatau dingin
- Card glass morphism dengan shadow tipis
- White space yang lega
- Animasi halus (slide-up, fade-in, scale)
- Dwibahasa (Bahasa Indonesia + Inggris)
- Dioptimalkan untuk sentuh (min 52px tap target)

**Layar yang Harus Didesain:**

**Layar 1 — Halaman Sambutan/Welcome:**
Halaman putih warm (#FDFAF6) layar penuh. Logo RAKKEN COFFEE terpusat (120px). Judul "Selamat Datang di RAKKEN / Welcome to RAKKEN" 64px bold #323131. Subtitle "Sentuh di mana saja untuk memulai" 24px #998075. Tombol CTA pill berdenyut besar dengan gradien merah brand (#9F131E) "Mulai Pesan / Start Order" (280×64px). Tekstur grain tipis dekoratif di background. Bawah: nama toko + waktu saat ini.

**Layar 2 — Halaman Menu:**
Header sticky atas (72px): kiri logo, tengah search bar (rounded, border warm), kanan ikon keranjang dengan badge merah penghitung. Di bawahnya: tab kategori sticky (scroll horizontal, pill style, aktif=merah, non-aktif=putih/coklat). Konten utama: grid 4 kolom kartu produk. Setiap card (glass, radius 24px): gambar produk 60% atas, 40% bawah putih: nama bold, deskripsi abu kecil, harga merah bold, tombol "Pilih" merah full-width. Sticky bottom bar keranjang (gradien merah) menampilkan jumlah item + total. Bottom bar hanya muncul saat keranjang tidak kosong.

**Layar 3 — Modal Kustomisasi:**
Modal terpusat overlay (max 680px). Atas: gambar produk full-width (200px), nama produk (28px bold), deskripsi, harga dasar (merah). Body scrollable dengan seksi: UKURAN (grid card, pilihan radio), TINGKAT GULA (4 opsi pill dalam baris), TINGKAT ES (4 opsi pill), JENIS SUSU (3 card dengan harga), ASAL BIJI KOPI (2 card), EXTRA SHOT (3 opsi), TOPPING KRIM (2 toggle card). Footer sticky: stepper jumlah (–/angka/+) kiri + total dinamis + tombol "Tambah ke Keranjang" merah full-width kanan.

**Layar 4 — Halaman Keranjang:**
Layout dua kolom. Kiri (60%): daftar item keranjang sebagai card — thumbnail + nama + tag kustomisasi (pill kecil) + subtotal + stepper qty + ikon edit/hapus. Kanan (40%): panel summary sticky — input nama pelanggan (wajib, besar), pemisah, subtotal item, tombol "Lanjut Checkout" merah full-width bawah (disabled jika belum ada nama). Mobile: satu kolom ditumpuk.

**Layar 5 — Halaman Checkout:**
Dua kolom. Kiri (55%): ringkasan pesanan dengan badge nama pelanggan, item dengan tag kustomisasi, input kode voucher + tombol "Pakai". Kanan (45%): card detail pembayaran — subtotal + diskon + total bold merah, dua card metode pembayaran besar (Online QRIS / EDC Kartu), tombol "Bayar Sekarang" merah (68px). State loading pada tombol.

**Layar 6 — Halaman Sukses:**
Card terpusat di layar penuh. Atas: badge lingkaran hijau berdenyut dengan ikon ✓ (100px, efek glow). Judul "Pesanan Diterima!" Nomor antrean monospace besar "#042" (72px) dalam kotak bernuansa merah. Petunjuk 3 langkah dalam card horizontal (ikon + teks). Tombol: "Cetak Struk" (sekunder) + "Lacak Pesanan" (ghost). Bawah: timer countdown otomatis dengan progress lingkaran "Kembali ke menu dalam 10s".

**Layar 7 — Status Pesanan:**
Nomor antrean di atas (#042 besar bold). Badge "🔴 LIVE". Progress tracker 3 langkah horizontal (terisi/berdenyut per status: Diterima → Sedang Dibuat → Siap). Card status: ikon besar + judul status + deskripsi. Daftar item compact. Mobile-friendly, satu kolom.

**Layar 8 — Tampilan Dapur (KDS):**
Tema gelap (#0F0F0F background). Dua kolom: Kiri=PENDING (aksen amber), Kanan=PREPARING (aksen biru). Setiap card pesanan: nomor antrean besar (amber/biru), tombol CTA "Start Making" atau "Complete", daftar item dengan tag kustomisasi berwarna. Search bar full-width di bawah header. UI gelap fungsional, bersih, mudah dibaca, tanpa elemen dekoratif berlebih.

---

## 13. ADDITIONAL DESIGN NOTES / CATATAN DESAIN TAMBAHAN

### Do / Lakukan:
- Use warm, earthy tones consistently across all screens
- Make queue number the hero element on Success and Status pages
- Ensure customization modal is never overwhelming — group options clearly with headers
- Use emoji generously for icons (no need for custom SVG for most cases)
- Show real-time "LIVE" indicator when WebSocket is connected
- Keep KDS clean and readable from 2+ meters away
- Always show currency as "Rp" with dot thousands separator (e.g., Rp 45.000)

### Don't / Hindari:
- Don't use blue as a primary color (reserved for info/preparing state only)
- Don't overcrowd cards — max 3 pieces of info per card
- Don't use thin fonts below 400 weight — kiosk lighting may reduce readability
- Don't hide critical actions below fold on mobile
- Don't use red for error states — use red only for brand; use pink-red or amber for errors
- Don't animate more than 2–3 elements at once (visual noise)

### Kiosk-Specific Considerations:
- All buttons: min-height 52px for thumb-friendly tapping
- Category tabs: at least 80px wide each for easy selection
- Quantity steppers: very large (56px) — frequently used
- No hover-dependent interactions (touch screens)
- Font size: never below 13px for any user-visible text
- Avoid form inputs that require long text (except customer name)
- Receipt-style screens use monospace fonts

---

*End of RAKKEN COFFEE System Design Specification*
*Version 1.0 — Prepared for Google Stitch UI Generation*
*Project: StartFriday POS System | Brand: RAKKEN COFFEE*
