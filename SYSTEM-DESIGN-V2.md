# RAKKEN COFFEE — POS Kiosk Design System V2
## Google Stitch UI Generation Prompt

> **Scope:** Menu → Cart → Checkout → Payment (Kiosk-focused)
> **Language:** Bilingual EN + ID
> **Version:** 2.0 — Modern Minimalist Redesign

---

## 1. DESIGN PRINCIPLES / PRINSIP DESAIN

```
1. MINIMAL COLOR — Only primary red + secondary green/brown. No extra colors.
2. BREATHING SPACE — Generous white space between every element.
3. SOFT ROUNDED — Consistent large border-radius across all components.
4. KIOSK-FIRST — Everything designed for 1024×768 landscape touch screen.
5. ONE FOCUS — Each screen has ONE primary action the user should take.
```

---

## 2. COLOR SYSTEM / SISTEM WARNA

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRIMARY (Used for: CTA, active states, brand moments)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Brand Red       #9F131E   — primary buttons, active tabs, price labels
Red Light       #F5E6E8   — red tint bg (selected states, subtle highlights)
Red Dark        #7D0F18   — red hover/pressed state

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECONDARY (Used for: accents, secondary buttons, icons, supporting UI)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Olive Green     #737C45   — secondary buttons, tags, category accents
Dark Brown      #533F36   — headings, labels, strong text moments

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NEUTRAL (Used for: backgrounds, text, surfaces)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
White           #FFFFFF   — page backgrounds, card surfaces
Near-Black      #323131   — primary body text
Warm Sand       #D9C7A6   — dividers, borders, inactive tab bg
Taupe           #998075   — secondary text, placeholders, captions

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
USAGE RULES (Non-negotiable)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
— Max 2 brand colors on any single screen at once
— Red is ONLY for primary CTA + active/selected states + price
— Green is ONLY for secondary actions + category tags
— Brown is ONLY for headings and strong labels
— White + Taupe handle all backgrounds and secondary text
— NO gradients on backgrounds — only solid colors
— NO colored backgrounds on cards — white only
```

---

## 3. TYPOGRAPHY / TIPOGRAFI

```
FONT FAMILY
Primary  : "Plus Jakarta Sans" (fallback: Inter, system-ui, sans-serif)
Mono     : "JetBrains Mono" (fallback: "Courier New") — queue numbers only

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCALE — KIOSK (1024px+)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Display    56px  800    #533F36  — page hero titles
H1         40px  700    #323131  — main page headings
H2         28px  700    #323131  — section headings
H3         22px  600    #323131  — card titles, modal headings
H4         18px  600    #533F36  — labels, sub-headings
Body L     16px  400    #323131  — primary body text
Body M     14px  400    #998075  — secondary/supporting text
Caption    12px  400    #998075  — meta, timestamps
Price      24px  700    #9F131E  — all price displays
Tag        13px  500    varies   — category pills, badges

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCALE — MOBILE (375px–767px)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Display    36px  800
H1         28px  700
H2         22px  700
H3         18px  600
Price      20px  700    #9F131E
Body L     15px  400
Body M     13px  400
```

---

## 4. SPACING & SHAPE / SPASI & BENTUK

```
SPACING SCALE
4    — tight gaps (icon to label)
8    — compact spacing (inside tags, small elements)
12   — standard inner padding
16   — card inner padding, section elements
24   — between cards, section top padding
32   — section separators
48   — page-level horizontal padding
64   — hero sections

BORDER RADIUS — Soft Rounded System
6    — small tags/chips
12   — input fields, small buttons
16   — standard buttons (56px height)
20   — menu cards
24   — large cards, panels, modals
32   — summary panels, info blocks
9999 — full pills (category tabs, quantity stepper)

SHADOWS — Minimal, warm-toned
none      — default card state
sm        : 0 1px 4px rgba(50,49,49,0.06)
md        : 0 4px 16px rgba(50,49,49,0.08)
lg        : 0 8px 32px rgba(50,49,49,0.10)
focus-red : 0 0 0 3px rgba(159,19,30,0.15)  — input/button focus ring
```

---

## 5. COMPONENT TOKENS / TOKEN KOMPONEN

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BUTTONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

btn-primary (Solid Red)
  bg         : #9F131E
  text       : #FFFFFF
  border     : none
  radius     : 16px
  padding    : 0 32px
  height     : 56px
  font       : 16px / 600
  min-width  : 160px
  hover      : bg #7D0F18
  active     : scale(0.97), bg #7D0F18
  disabled   : bg #D9C7A6, text #998075, cursor not-allowed
  loading    : spinner (white) + text "Loading..."

btn-secondary (Outline Red)
  bg         : transparent
  text       : #9F131E
  border     : 2px solid #9F131E
  radius     : 16px
  padding    : 0 32px
  height     : 56px
  font       : 16px / 600
  hover      : bg #F5E6E8
  active     : scale(0.97)
  disabled   : border #D9C7A6, text #998075

btn-ghost (No border)
  bg         : transparent
  text       : #998075
  border     : none
  radius     : 12px
  padding    : 0 20px
  height     : 48px
  hover      : bg #F5F5F5, text #533F36

btn-tag-green (Category / Status accent)
  bg         : #737C45
  text       : #FFFFFF
  radius     : 9999px
  padding    : 6px 14px
  font       : 13px / 500

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INPUT FIELDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
input-default
  bg         : #FFFFFF
  border     : 1.5px solid #D9C7A6
  radius     : 12px
  padding    : 14px 18px
  font       : 15px / 400, #323131
  placeholder: #998075
  height     : 52px
  focus      : border #9F131E, shadow focus-red
  error      : border #9F131E, helper text red below

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CARDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
card-base
  bg         : #FFFFFF
  border     : 1px solid #D9C7A6
  radius     : 20px
  shadow     : sm
  hover      : shadow md, border #998075

card-selected
  bg         : #F5E6E8
  border     : 2px solid #9F131E

card-option (customization choices)
  bg         : #FFFFFF
  border     : 1.5px solid #D9C7A6
  radius     : 12px
  padding    : 12px 16px
  selected   : border #9F131E, bg #F5E6E8, label color #9F131E

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CATEGORY TAB (pill)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
inactive
  bg         : #FFFFFF
  border     : 1.5px solid #D9C7A6
  text       : #533F36
  radius     : 9999px
  padding    : 10px 20px
  font       : 14px / 500

active
  bg         : #9F131E
  border     : none
  text       : #FFFFFF
  font       : 14px / 600

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUANTITY STEPPER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
container
  bg         : #F5F5F5
  radius     : 9999px
  inline-flex, items centered

btn (– and +)
  size       : 48×48px
  bg         : #FFFFFF
  border     : 1.5px solid #D9C7A6
  radius     : 9999px
  icon color : #9F131E
  hover      : bg #F5E6E8, border #9F131E

number display
  width      : 48px
  text       : 20px / 600, #323131
  center aligned

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRICE BADGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  text       : #9F131E, 700 weight
  format     : "Rp 38.000" (dot thousands, no decimal)
  size       : 24px on cards, 20px on cart items, 32px on checkout total

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DIVIDER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  height     : 1px
  color      : #D9C7A6
  margin     : 24px 0
```

---

## 6. LAYOUT SYSTEM / SISTEM TATA LETAK

```
KIOSK CANVAS: 1024×768px landscape (minimum)
Max content width: 1280px, centered
Page padding: 48px left/right, 32px top/bottom

GRID SYSTEM
Menu page      : 3 columns (1024px), 4 columns (1280px+)
                 gap: 24px
Cart/Checkout  : 2 columns — content 60% | panel 40%
                 gap: 32px
Modal           : centered, max-width 640px, max-height 85vh
```

---

## 7. SCREEN SPECIFICATIONS / SPESIFIKASI LAYAR

---

### SCREEN 1 — MENU PAGE (`/menu`)

#### Layout Structure
```
┌─────────────────────────────────────────────────────────────┐
│  HEADER (sticky, 72px, white bg, bottom border #D9C7A6)     │
│  [Logo 36px]    [Search bar — 420px wide]    [Cart icon 🛍] │
├─────────────────────────────────────────────────────────────┤
│  CATEGORY BAR (sticky, 64px, white bg, bottom border)       │
│  [All] [Rakken Signature] [Rakken Style] [Non Coffee] [Food]│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  MENU GRID — 3 or 4 columns, scrollable                     │
│  [Card] [Card] [Card] [Card]                                │
│  [Card] [Card] [Card] [Card]                                │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  CART BAR (sticky bottom, 64px) — only when cart not empty  │
│  [🛍 3 items]          [Rp 135.000 → Lihat Keranjang]       │
└─────────────────────────────────────────────────────────────┘
```

#### Header Details
- Background: #FFFFFF, bottom border 1px #D9C7A6
- Logo: RAKKEN wordmark, left-aligned, 36px height
- Search bar: centered, 420px wide, height 44px
  - bg #FFFFFF, border 1.5px #D9C7A6, radius 9999px
  - icon: magnifier left, clear button right
  - placeholder: "Cari menu..." #998075
- Cart icon: right-aligned, 44×44px touch target
  - icon color #323131
  - badge: 20px circle, bg #9F131E, text white, 11px/700

#### Category Bar Details
- Background: #FFFFFF, bottom border 1px #D9C7A6
- Horizontal scroll, no visible scrollbar
- Padding: 0 48px
- Gap between tabs: 8px
- Each tab: pill button (inactive: white bg + border #D9C7A6 + text #533F36)
- Active tab: solid #9F131E bg + white text, no border
- Tab height: 36px, padding 0 20px

#### Menu Card Details
- Size: fills column (≈280px on 3-col, ≈230px on 4-col)
- Aspect ratio: card is 1:1.3 (width:height)
- bg: #FFFFFF, border: 1px solid #D9C7A6, radius: 20px
- Hover: shadow md, border #998075, lift 2px
- Active (tap): scale(0.97)

**Card anatomy (top to bottom):**
```
┌──────────────────────────┐
│                          │  ← image area: 55% of card height
│    [Product Image]       │     object-cover, top radius 20px
│                          │
│  [🔥 Best Seller]        │  ← top-left badge (if applicable)
│             [HOT ☕]      │  ← top-right badge (if applicable)
├──────────────────────────┤
│  Kyoto Origin            │  ← H3 22px/600 #323131, mt:16 mx:16
│  Signature black coffee  │  ← Body M 13px/400 #998075, 1 line truncated
│                          │
│  Rp 38.000               │  ← Price 24px/700 #9F131E
│                          │
│  [  Pilih / Select  ]    │  ← btn-primary, full width, mx:16 mb:16
└──────────────────────────┘
```

**Badge design:**
- Best Seller: bg #9F131E, text white, radius 9999px, 11px/600, padding 4px 10px
- Recommended: bg #737C45, text white, same shape
- HOT/ICED: bg #323131, text white, same shape (top-right corner)
- Unavailable: gray overlay + "Habis" center label

#### Cart Bar Details (Sticky Bottom)
- Height: 64px, bg #9F131E, radius 0 (full width)
- Left: cart icon white + "{N} item" text (16px/500 white)
- Right: "Rp {total} · Lihat Keranjang →" (16px/600 white)
- Padding: 0 48px
- Appears with slideUp 300ms when cart goes from 0 to 1+ items
- Disappears with slideDown when cart empties
- Tapping entire bar navigates to /cart

---

### SCREEN 2 — CART PAGE (`/cart`)

#### Layout Structure
```
┌─────────────────────────────────────────────────────────────┐
│  BACK HEADER (60px)                                         │
│  [← Kembali ke Menu]            [Keranjang (3)]             │
├──────────────────────────┬──────────────────────────────────┤
│                          │                                  │
│  CART ITEMS (scrollable) │   ORDER PANEL (sticky)           │
│       60%                │        40%                       │
│                          │                                  │
│  [Item Card]             │   Nama Pelanggan                 │
│  [Item Card]             │   [_________________]            │
│  [Item Card]             │                                  │
│                          │   ─────────────────              │
│                          │   Subtotal          Rp 135.000   │
│                          │                                  │
│                          │   [Lanjut ke Checkout →]         │
│                          │                                  │
└──────────────────────────┴──────────────────────────────────┘
```

#### Back Header
- Height: 60px, bg #FFFFFF, bottom border 1px #D9C7A6
- Left: "← Kembali ke Menu" — btn-ghost, #533F36, 15px/500
- Right: "Keranjang · {N} item" — 16px/600 #323131

#### Cart Items Column (left 60%)
- Padding: 32px 24px 32px 48px
- Scrollable

**Cart Item Card:**
```
┌─────────────────────────────────────────────────────┐
│  [img 80×80]   Kyoto Origin                [Rp 38K] │
│  rounded 12px  Hot · Gula: Normal                   │
│                Es: Normal · Oat Milk        [✏] [🗑] │
│                                                     │
│                [—]   1   [+]                        │
└─────────────────────────────────────────────────────┘
```
- Card: bg #FFFFFF, border 1px #D9C7A6, radius 16px, padding 16px
- Product image: 80×80px, radius 12px, object-cover
- Product name: 16px/600 #323131
- Customization line: 13px/400 #998075 (truncated, 2 lines max)
- Subtotal: 16px/700 #9F131E, top-right
- Edit icon: outline pencil, 24px, #998075, hover #533F36
- Delete icon: outline trash, 24px, #998075, hover #9F131E
- Quantity stepper: pill style (bottom-left of card)
- Separator between cards: 12px gap (no line)

**Empty Cart State:**
- Center of column: coffee cup illustration (outline style, #D9C7A6)
- "Keranjang kamu kosong" — 18px/600 #533F36
- "Yuk pilih menu yang kamu suka!" — 14px/400 #998075
- btn-primary "Lihat Menu" — 200px wide, centered

#### Order Panel (right 40%)
- Padding: 32px 48px 32px 24px
- Position: sticky top (stays when items scroll)

**Customer Name Input:**
- Label: "Nama Kamu *" — 14px/600 #533F36, mb:8
- Input: full width, height 52px, standard input style
- Helper: "Nama akan dicantumkan di struk" — 12px #998075
- Error: "Nama wajib diisi" — 12px #9F131E below input

**Divider:** 1px #D9C7A6, margin 24px 0

**Subtotal Section:**
- "Subtotal" — 14px/400 #998075, right-side amount 16px/600 #323131
- Separator line
- Total row: "Total" 16px/600 #323131, "Rp 135.000" 24px/700 #9F131E

**CTA Button:**
- btn-primary, full width, height 56px
- "Lanjut ke Checkout →" — 16px/600 white
- disabled state when no customer name: bg #D9C7A6, text #998075
- Disabled label: "Masukkan nama dulu" (replaces button text)

---

### SCREEN 3 — CHECKOUT PAGE (`/checkout`)

#### Layout Structure
```
┌─────────────────────────────────────────────────────────────┐
│  BACK HEADER (60px)                                         │
│  [← Kembali ke Keranjang]              [Checkout]           │
├──────────────────────────┬──────────────────────────────────┤
│                          │                                  │
│  ORDER REVIEW (scroll)   │   PAYMENT PANEL (sticky)         │
│        55%               │         45%                      │
│                          │                                  │
│  [👤 Nama Pelanggan]     │   Detail Pembayaran              │
│                          │   Subtotal          Rp 135.000   │
│  Pesanan Kamu            │   Diskon voucher   - Rp 10.000   │
│  [Item row]              │   ─────────────────              │
│  [Item row]              │   Total             Rp 125.000   │
│  [Item row]              │                                  │
│                          │   Metode Pembayaran              │
│  Kode Voucher            │   [Online QRIS card]             │
│  [_________] [Pakai]     │   [EDC / Kartu card]             │
│                          │                                  │
│                          │   [Bayar Sekarang →]             │
│                          │                                  │
└──────────────────────────┴──────────────────────────────────┘
```

#### Order Review Column (left 55%)
- Padding: 32px 24px 32px 48px

**Customer Badge:**
- Inline: icon 👤 + "Nama Pelanggan" — 14px/500 #533F36
- bg #F5E6E8, border 1px #9F131E, radius 9999px
- padding: 8px 16px, display inline-flex

**Section heading:** "Pesanan Kamu" — H4 18px/600 #533F36, mt:24

**Order Item Row (per item):**
```
[img 56×56]  Kyoto Origin (Hot)               1 × Rp 38.000
  radius 8px  Sugar: Normal · Ice: Less · Oat Milk
```
- Image: 56×56px, radius 8px
- Name + size: 15px/600 #323131
- Customization: 12px/400 #998075, single line
- Price: 15px/600 #323131, right-aligned
- If discounted: strikethrough original + green discounted price
- Separator between rows: 1px #D9C7A6

**Voucher Section:**
- Heading: "Kode Voucher" H4 18px/600 #533F36, mt:32
- Row: input (flex-1) + "Pakai" btn-secondary (width:auto) side by side, gap 12px
- Input height: 48px
- Pakai button: 48px height, padding 0 24px
- Success state: input bg #F0FDF4 border #737C45, green check icon right inside input
- Success message: "Diskon Rp 10.000 berhasil diterapkan!" — 13px #737C45
- Error state: input border #9F131E, "Kode tidak valid" — 13px #9F131E
- If applied: "Hapus" ghost button replaces "Pakai"

#### Payment Panel (right 45%)
- Padding: 32px 48px 32px 24px
- sticky top

**Payment Summary Card:**
- bg #FFFFFF, border 1px #D9C7A6, radius 24px, padding 24px

Row layout:
```
Subtotal                    Rp 135.000
Diskon voucher            - Rp 10.000   ← green text #737C45, only if applied
─────────────────────────────────────
Total                       Rp 125.000  ← 28px/700 #9F131E
```
- Subtotal label: 14px/400 #998075, amount 15px/500 #323131
- Total label: 16px/600 #533F36, amount 28px/700 #9F131E

**Divider** 1px #D9C7A6, margin 24px 0

**Payment Method:**
- Heading: "Metode Pembayaran" — 16px/600 #533F36, mb:16

Method Card (each):
```
┌─────────────────────────────────────────────┐
│  💳  Online (QRIS / Transfer)               │
│      Scan QR atau transfer via bank          │
└─────────────────────────────────────────────┘
```
- bg #FFFFFF, border 1.5px #D9C7A6, radius 16px, padding 16px 20px
- Icon: 32px emoji, left
- Title: 15px/600 #323131
- Subtitle: 13px/400 #998075
- Gap between cards: 12px
- Selected state: border 2px #9F131E, bg #F5E6E8, checkmark icon top-right

**Pay Button:**
- btn-primary, full width, height 64px, mt:24
- "Bayar Sekarang →" — 17px/600 white
- disabled: no payment method selected
- loading: spinner + "Memproses pembayaran..."

---

### SCREEN 4 — PAYMENT IN PROGRESS (Overlay)

For Online Payment (Midtrans):
- Full screen overlay bg rgba(0,0,0,0.6)
- Center card: white, radius 24px, padding 40px, max-width 480px
- Loading spinner (red, 48px) at top
- "Menghubungkan ke payment gateway..." — 16px/400 #323131
- "Jangan tutup halaman ini" — 13px/400 #998075
- Note: Midtrans Snap.js popup will appear on top of this overlay

For EDC Payment:
- Same overlay structure
- Icon: 🏧 (large, 48px)
- "Tempelkan atau gesek kartu di terminal" — 16px/600 #323131
- "Menunggu konfirmasi terminal..." — 14px/400 #998075
- Animated dots indicator below

---

### SCREEN 5 — SUCCESS PAGE (`/success`)

#### Layout
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                    ✓  (success badge)                       │
│               Pesanan Diterima!                             │
│             Nomor Antrean Kamu                              │
│                                                             │
│              ┌─────────────────┐                           │
│              │      #042       │                           │
│              │  OL260515...    │                           │
│              └─────────────────┘                           │
│                                                             │
│  [Step 1]          [Step 2]          [Step 3]              │
│                                                             │
│         [Cetak Struk]    [Lacak Pesanan]                   │
│                                                             │
│            Kembali ke menu dalam ⏱ 10s                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Center Card (max-width 520px, centered both axis)

**Success Badge:**
- Circle: 88px, bg #9F131E, white checkmark icon (32px), radius 9999px
- Outer ring: 8px transparent gap + 2px #9F131E border (subtle glow outline)
- scaleIn animation on load

**Text Block:**
- "Pesanan Diterima!" — H1 40px/700 #323131, mt:24, center
- "Nomor Antrean Kamu" — Body M 15px/400 #998075, mt:8, center

**Queue Number Block:**
- bg #F5E6E8, border 1px #9F131E, radius 20px
- padding: 24px 48px, mt:24
- Queue number: JetBrains Mono 64px/800 #9F131E — "#042"
- Order ID below: JetBrains Mono 13px #998075 — "OL26051500000205"

**3-Step Instructions (horizontal row):**
- Container: 3 equal columns, gap 16px, mt:32
- Each step card: bg #FFFFFF, border 1px #D9C7A6, radius 16px, padding 16px
  - Icon (emoji): 24px, center
  - Step text: 13px/500 #533F36, center, 2 lines max
  - Examples: "⏳ Tunggu nomormu dipanggil", "📺 Pantau layar status", "☕ Ambil pesananmu"

**Action Buttons (2 buttons, side by side):**
- gap 16px, mt:32, centered
- "🧾 Cetak Struk" — btn-secondary, width 180px
- "📍 Lacak Pesanan" — btn-ghost, width 180px

**Auto Countdown:**
- mt:24, "Kembali ke menu dalam {N} detik" — 13px/400 #998075, center
- Underlined "Batalkan" link inline to cancel

---

### SCREEN 6 — ORDER STATUS (`/status`)

#### Layout
```
┌─────────────────────────────────────────────────────────────┐
│  [← Kembali]                          🔴 LIVE               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                       #042                                  │
│               Pesanan untuk: Dzaky                          │
│                                                             │
│  ●─────────────●─────────────○                             │
│  Diterima    Sedang Dibuat    Siap                          │
│                                                             │
│  ┌──────────────────────────────────────────────┐          │
│  │  👨‍🍳  Sedang Dibuat                            │          │
│  │      Barista sedang menyiapkan pesananmu     │          │
│  │      Estimasi: ~5–10 menit                   │          │
│  └──────────────────────────────────────────────┘          │
│                                                             │
│  Pesanan:  1× Kyoto Origin (Hot)                           │
│            1× Croissant                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Header:**
- "← Kembali ke Menu" — btn-ghost left
- "🔴 LIVE" — right, pulsing red dot (6px circle, animation pulse) + "LIVE" 13px/600 #9F131E

**Queue Number:**
- "#042" — Mono 56px/800 #9F131E, center
- "Pesanan untuk: Dzaky" — 15px/400 #998075, center, mt:8

**Progress Tracker:**
- 3 circles connected by horizontal line
- Done step: filled circle #9F131E + white checkmark
- Current step: filled circle #9F131E + pulsing ring animation
- Future step: circle outline #D9C7A6
- Line: filled #9F131E for completed segments, #D9C7A6 for incomplete
- Step label: 13px/500 below each circle, active = #9F131E, done = #533F36, future = #998075

**Status Card:**
- bg #FFFFFF, border 1.5px #9F131E (when preparing) or #D9C7A6, radius 20px, padding 24px
- Icon: 40px emoji (👨‍🍳 preparing, ⏳ pending, ☕ ready)
- Status title: 20px/700 #323131
- Description: 14px/400 #998075
- Estimate: 13px/500 #533F36 below description

**Order Items:**
- Heading: "Detail Pesanan" — 14px/600 #533F36, mt:32
- Each item: "1× Kyoto Origin (Hot)" — 14px/400 #323131

---

## 8. ANIMATIONS / ANIMASI

```
PAGE TRANSITIONS
  Route enter  : fadeIn 300ms ease
  Route exit   : fadeOut 200ms ease

ELEMENT ENTRANCES
  Cards stagger: fadeInUp (translateY 16px→0 + opacity), 400ms, 80ms delay per card
  Modal open   : slideUp from bottom 50px, 350ms cubic-bezier(0.32, 0.72, 0, 1)
  Modal close  : fadeOut + translateY to 30px, 200ms

INTERACTION FEEDBACK
  Button tap   : scale(0.97), 80ms, return 150ms
  Card tap     : scale(0.97), 80ms
  Tab select   : bg color transition 150ms ease

CART BAR
  Appear       : translateY(100%→0) + opacity, 350ms ease-out
  Disappear    : translateY(0→100%) + opacity, 250ms ease-in

LIVE INDICATOR
  Dot pulse    : scale(1→1.5) + opacity(1→0), 1.5s loop

STATUS TRACKER
  Progress fill: width animation, 600ms ease

LOADING SKELETON
  Shimmer      : gradient sweep, 1.2s loop
  Cards shape  : same dimensions as actual card, #F5F5F5 bg

SUCCESS BADGE
  Entrance     : scale(0→1.1→1), 400ms spring
  Outer ring   : opacity 0→0.5→0 pulse, 2s loop
```

---

## 9. EMPTY & ERROR STATES / STATUS KOSONG & ERROR

```
EMPTY SEARCH
  Icon   : magnifier outline, 48px, #D9C7A6
  Title  : "Tidak ditemukan" 18px/600 #533F36
  Body   : "Coba kata kunci lain" 14px/400 #998075
  CTA    : btn-ghost "Reset Pencarian"

EMPTY CART
  Icon   : shopping bag outline, 64px, #D9C7A6
  Title  : "Keranjang masih kosong" 20px/600 #533F36
  Body   : "Pilih menu favoritmu dulu" 14px/400 #998075
  CTA    : btn-primary "Lihat Menu" 200px

ERROR BANNER (top of page, below header)
  bg     : #FFF5F5, border-left 4px solid #9F131E
  Icon   : ⚠️ left
  Text   : error message 14px/400 #323131
  Close  : × button right

VOUCHER ERROR (inline)
  Input border  : #9F131E
  Message below : "Kode voucher tidak valid atau sudah digunakan" 12px #9F131E

PAYMENT FAILED MODAL
  bg     : white, radius 24px, padding 40px, max-width 440px
  Icon   : ✕ in circle, 72px, bg #FFF5F5, icon #9F131E
  Title  : "Pembayaran Gagal" 24px/700 #323131
  Body   : error description 15px/400 #998075
  CTA    : btn-primary "Coba Lagi" full width
  Ghost  : "Kembali ke Menu" below
```

---

## 10. GOOGLE STITCH PROMPT — ENGLISH

---

Design a modern minimalist self-service coffee kiosk UI for **RAKKEN COFFEE**. The app runs on landscape tablet kiosks (1024×768+) and is touch-first. Design only these 4 screens: Menu, Cart, Checkout, and Order Success.

**DESIGN PRINCIPLES:**
- Modern minimalist — lots of white space, clean layouts
- Maximum 2 brand colors visible on any single screen
- Soft rounded corners everywhere (16–24px border-radius)
- No gradients — solid colors only
- Kiosk-optimized: all tap targets minimum 52px

**COLOR RULES (STRICT):**
- Primary Red #9F131E — solid primary buttons, active tab, price text, selected states
- Olive Green #737C45 — secondary accents, success text, tags only
- Dark Brown #533F36 — headings, labels
- White #FFFFFF — all backgrounds, card surfaces
- Near-Black #323131 — body text
- Warm Sand #D9C7A6 — borders, dividers, inactive states
- Taupe #998075 — secondary text, placeholders
- Red tint #F5E6E8 — selected card background only

**BUTTONS:**
- Primary: solid #9F131E background, white text, 16px border-radius, 56px height, no gradient
- Secondary: transparent background, 2px solid #9F131E border, #9F131E text, same shape
- Ghost: no border, #998075 text

**SCREEN 1 — MENU PAGE:**
Full-width layout. Top sticky header (72px, white, bottom border): left=RAKKEN COFFEE wordmark, center=rounded search bar (420px), right=cart icon with red badge. Below header: sticky category tab bar (64px, white): pill-shaped tabs (inactive: white bg + #D9C7A6 border + #533F36 text; active: solid #9F131E bg + white text). Horizontal scroll, no custom scrollbar. Main content: 3-4 column grid of product cards (gap 24px, side padding 48px). Each card (white bg, 1px #D9C7A6 border, 20px radius, shadow-sm): top 55% = product image (rounded top corners), bottom section = product name (22px/600 #323131), description (13px #998075, 1 line), price (24px/700 #9F131E), full-width solid red "Pilih" button (44px height). Best Seller badge: small red pill top-left of image. Hot/Iced badge: small dark pill top-right. Unavailable: grayscale + "Habis" overlay. Sticky bottom bar (full-width, 64px, solid #9F131E bg): left = cart icon + item count in white text; right = total price + "Lihat Keranjang →" in white. Bar only shows when cart has 1+ items, appears with slide-up animation.

**SCREEN 2 — CART PAGE:**
60/40 split layout. Back header (60px, white, border): left = "← Kembali ke Menu" ghost button, right = "Keranjang · {N} item" heading. Left 60% (scroll): list of cart item cards (white, 1px border, 16px radius, 16px padding): left = 80×80 product thumbnail (12px radius); middle = product name (16px/600), customization summary (13px/400 #998075, 2 lines); right = subtotal (16px/700 #9F131E), edit + delete icons. Below item info: pill quantity stepper (48×48 circular minus/plus buttons with red icons, number in center). Empty state: coffee icon + text + "Lihat Menu" red button. Right 40% sticky panel: "Nama Kamu *" label + large input field (52px height, border #D9C7A6, focus = border #9F131E); divider line; subtotal row (label gray, amount dark); total row (label #533F36 bold, amount 24px/700 #9F131E); full-width solid red "Lanjut ke Checkout →" button (56px) — disabled with #D9C7A6 bg when name empty.

**SCREEN 3 — CHECKOUT PAGE:**
55/45 split layout. Back header: "← Kembali ke Keranjang". Left 55% (scroll): customer name pill badge (red border + tint bg + 👤 icon); "Pesanan Kamu" section heading (18px/600 #533F36); per-item rows: 56×56 thumbnail + name + customization line + price right-aligned; items separated by 1px #D9C7A6 lines; "Kode Voucher" section: side-by-side input + "Pakai" outline-red secondary button; success state shows green border + discount message in #737C45. Right 45% sticky: white payment card (24px radius, 24px padding, 1px border): subtotal row, discount row (green, only when applied), bold separator line, total row (28px/700 #9F131E right); below: "Metode Pembayaran" label; 2 method cards (white bg, 1.5px #D9C7A6 border, 16px radius, 16px padding: emoji icon left + title 15px/600 + subtitle 13px/400); selected = 2px #9F131E border + #F5E6E8 bg + checkmark top-right; full-width solid red "Bayar Sekarang →" button (64px height, 17px/600).

**SCREEN 4 — SUCCESS PAGE:**
Centered card (max 520px wide, vertically centered on white page). Top: 88px circle badge (solid #9F131E bg, white checkmark icon, 2px red outline ring with gap); "Pesanan Diterima!" (40px/700 #323131, center); "Nomor Antrean Kamu" (15px #998075, center). Queue number block: bg #F5E6E8, 1px #9F131E border, 20px radius, monospace font "#042" (64px/800 #9F131E center), order ID below (13px mono #998075). 3-step row (equal columns): each step = white card (16px radius, 1px border): emoji icon + 2-line instruction (13px/500 #533F36). Two action buttons side by side: "🧾 Cetak Struk" (btn-secondary 180px) + "📍 Lacak Pesanan" (btn-ghost 180px). Auto-countdown: "Kembali ke menu dalam {N} detik" (13px #998075, center, with "Batalkan" inline link).

---

## 11. GOOGLE STITCH PROMPT — BAHASA INDONESIA

---

Desainkan UI kiosk kopi self-service modern minimalis untuk **RAKKEN COFFEE**. App berjalan di kiosk tablet landscape (1024×768+) dan berbasis sentuh. Desain hanya 4 layar: Menu, Keranjang, Checkout, dan Sukses.

**PRINSIP DESAIN:**
- Modern minimalis — banyak white space, layout bersih
- Maksimal 2 warna brand terlihat di satu layar
- Corner rounded di mana-mana (16–24px border-radius)
- Tidak ada gradien — hanya warna solid
- Optimized untuk kiosk: semua tap target minimum 52px

**ATURAN WARNA (KETAT):**
- Merah #9F131E — tombol primary solid, tab aktif, teks harga, state terpilih
- Hijau Zaitun #737C45 — aksen sekunder, teks sukses, tag saja
- Coklat Tua #533F36 — heading, label
- Putih #FFFFFF — semua background, permukaan card
- Near-Black #323131 — teks body
- Pasir Hangat #D9C7A6 — border, divider, state inactive
- Taupe #998075 — teks sekunder, placeholder
- Red tint #F5E6E8 — background card terpilih saja

**TOMBOL:**
- Primary: background solid #9F131E, teks putih, radius 16px, tinggi 56px, tanpa gradien
- Secondary: background transparan, border 2px solid #9F131E, teks #9F131E, bentuk sama
- Ghost: tanpa border, teks #998075

**LAYAR 1 — HALAMAN MENU:**
Layout full-width. Header sticky atas (72px, putih, border bawah): kiri=wordmark RAKKEN COFFEE, tengah=search bar rounded (420px), kanan=ikon keranjang dengan badge merah. Di bawah header: bar tab kategori sticky (64px, putih): tab berbentuk pill (inactive: bg putih + border #D9C7A6 + teks #533F36; active: bg #9F131E solid + teks putih). Scroll horizontal, tanpa scrollbar custom. Konten utama: grid 3–4 kolom kartu produk (gap 24px, padding samping 48px). Setiap card (bg putih, border 1px #D9C7A6, radius 20px, shadow tipis): atas 55% = gambar produk (corner atas rounded), bagian bawah = nama produk (22px/600 #323131), deskripsi (13px #998075, 1 baris), harga (24px/700 #9F131E), tombol "Pilih" merah solid full-width (tinggi 44px). Badge Best Seller: pill merah kecil kiri-atas gambar. Badge Hot/Iced: pill gelap kecil kanan-atas. Tidak tersedia: grayscale + overlay "Habis". Bottom bar sticky (full-width, 64px, bg #9F131E solid): kiri = ikon keranjang + jumlah item teks putih; kanan = total harga + "Lihat Keranjang →" putih. Bar hanya muncul saat keranjang ada isi, animasi slide-up.

**LAYAR 2 — HALAMAN KERANJANG:**
Split layout 60/40. Back header (60px, putih, border): kiri = tombol ghost "← Kembali ke Menu", kanan = heading "Keranjang · {N} item". Kiri 60% (scroll): daftar kartu item keranjang (putih, border 1px, radius 16px, padding 16px): kiri = thumbnail produk 80×80 (radius 12px); tengah = nama produk (16px/600), ringkasan kustomisasi (13px/400 #998075, 2 baris); kanan = subtotal (16px/700 #9F131E), ikon edit + hapus. Di bawah info item: stepper quantity pill (tombol minus/plus lingkaran 48×48 dengan ikon merah, angka di tengah). Empty state: ikon kopi + teks + tombol merah "Lihat Menu". Kanan 40% panel sticky: label "Nama Kamu *" + input besar (tinggi 52px, border #D9C7A6, fokus = border #9F131E); garis divider; baris subtotal (label abu, jumlah gelap); baris total (label #533F36 bold, jumlah 24px/700 #9F131E); tombol merah solid "Lanjut ke Checkout →" full-width (56px) — disabled bg #D9C7A6 saat nama kosong.

**LAYAR 3 — HALAMAN CHECKOUT:**
Split layout 55/45. Back header: "← Kembali ke Keranjang". Kiri 55% (scroll): badge pill nama pelanggan (border merah + bg tint + ikon 👤); heading seksi "Pesanan Kamu" (18px/600 #533F36); baris per-item: thumbnail 56×56 + nama + baris kustomisasi + harga rata kanan; item dipisah garis 1px #D9C7A6; seksi "Kode Voucher": input + tombol secondary "Pakai" outline merah berdampingan; sukses = border hijau + pesan diskon #737C45. Kanan 45% sticky: card pembayaran putih (radius 24px, padding 24px, border 1px): baris subtotal, baris diskon (hijau, hanya jika ada), garis pemisah tebal, baris total (28px/700 #9F131E kanan); di bawah: label "Metode Pembayaran"; 2 kartu metode (bg putih, border 1.5px #D9C7A6, radius 16px, padding 16px: ikon emoji kiri + judul 15px/600 + subjudul 13px/400); terpilih = border 2px #9F131E + bg #F5E6E8 + centang kanan-atas; tombol merah solid "Bayar Sekarang →" full-width (tinggi 64px, 17px/600).

**LAYAR 4 — HALAMAN SUKSES:**
Card terpusat (max 520px lebar, terpusat vertikal di halaman putih). Atas: badge lingkaran 88px (bg #9F131E solid, ikon centang putih, cincin outline merah 2px dengan jarak); "Pesanan Diterima!" (40px/700 #323131, center); "Nomor Antrean Kamu" (15px #998075, center). Blok nomor antrean: bg #F5E6E8, border 1px #9F131E, radius 20px, font monospace "#042" (64px/800 #9F131E center), order ID di bawah (13px mono #998075). Baris 3 langkah (kolom sama rata): setiap langkah = card putih (radius 16px, border 1px): ikon emoji + instruksi 2 baris (13px/500 #533F36). Dua tombol aksi berdampingan: "🧾 Cetak Struk" (btn-secondary 180px) + "📍 Lacak Pesanan" (btn-ghost 180px). Countdown otomatis: "Kembali ke menu dalam {N} detik" (13px #998075, center, dengan link inline "Batalkan").

---

*RAKKEN COFFEE — POS Kiosk Design System V2*
*Scope: Menu → Cart → Checkout → Success | Modern Minimalist | Kiosk-First*
