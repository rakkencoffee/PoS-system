/**
 * Format Receipt — ESC/POS Commands for 58mm Thermal Printer
 * 
 * QPOS EPM58UB: 58mm paper = 384 dots = ~32 chars per line (normal font)
 * Uses raw ESC/POS byte commands for precise thermal printer control.
 */

const { RAKKEN_LOGO_288 } = require('./rakken-logo');
const { buildHeaderRaster } = require('./dynamic-header');

// ─── ESC/POS COMMAND CONSTANTS ──────────────────────────────
const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;

/** ESC/POS raster bit image command (GS v 0) — width must be a multiple of 8. */
function logoRasterCommand(logo) {
  const bytesPerRow = logo.width / 8;
  const header = Buffer.from([
    GS, 0x76, 0x30, 0x00,
    bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff,
    logo.height & 0xff, (logo.height >> 8) & 0xff,
  ]);
  return Buffer.concat([header, logo.data]);
}

/**
 * ESC/POS QR code command sequence (GS ( k — printer generates the QR itself,
 * no bitmap/raster data needed, so payload stays tiny regardless of QR size).
 * @param {string} data - text/URL to encode
 * @param {number} [moduleSize=6] - dot size per QR module (1-16, bigger = larger QR)
 * @param {number} [errorCorrection=48] - 48=L, 49=M, 50=Q, 51=H
 */
function qrCodeCommand(data, moduleSize = 6, errorCorrection = 48) {
  const dataBuf = Buffer.from(data, 'utf8');

  // 1. Select model 2 (standard)
  const selectModel = Buffer.from([GS, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]);

  // 2. Set module size
  const setSize = Buffer.from([GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, moduleSize]);

  // 3. Set error correction level
  const setEC = Buffer.from([GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, errorCorrection]);

  // 4. Store data (pL/pH = length of [m + data], m is fixed 0x30)
  const storeLen = dataBuf.length + 3;
  const storeData = Buffer.concat([
    Buffer.from([GS, 0x28, 0x6B, storeLen & 0xff, (storeLen >> 8) & 0xff, 0x31, 0x50, 0x30]),
    dataBuf,
  ]);

  // 5. Print the stored QR symbol
  const printSymbol = Buffer.from([GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30]);

  return Buffer.concat([selectModel, setSize, setEC, storeData, printSymbol]);
}

const CMD = {
  // Initialize printer
  INIT: Buffer.from([ESC, 0x40]),

  // Font select (ESC M) — Font A = default (12x24), Font B = condensed (9x17, lebih kecil/gak full lebar kertas)
  FONT_A: Buffer.from([ESC, 0x4D, 0x00]),
  FONT_B: Buffer.from([ESC, 0x4D, 0x01]),

  // Text alignment
  ALIGN_LEFT: Buffer.from([ESC, 0x61, 0x00]),
  ALIGN_CENTER: Buffer.from([ESC, 0x61, 0x01]),
  ALIGN_RIGHT: Buffer.from([ESC, 0x61, 0x02]),

  // Text emphasis
  BOLD_ON: Buffer.from([ESC, 0x45, 0x01]),
  BOLD_OFF: Buffer.from([ESC, 0x45, 0x00]),

  // Text size (width x height multiplier)
  // GS ! n  — n bits: 0-3 = height, 4-7 = width
  SIZE_NORMAL: Buffer.from([GS, 0x21, 0x00]),        // 1x1
  SIZE_DOUBLE_H: Buffer.from([GS, 0x21, 0x01]),      // 1x2 (double height)
  SIZE_DOUBLE_W: Buffer.from([GS, 0x21, 0x10]),      // 2x1 (double width)
  SIZE_DOUBLE: Buffer.from([GS, 0x21, 0x11]),         // 2x2 (double both)
  SIZE_TRIPLE: Buffer.from([GS, 0x21, 0x22]),         // 3x3

  // Feed & Cut
  FEED_LINE: Buffer.from([LF]),
  FEED_3: Buffer.from([ESC, 0x64, 0x03]),             // Feed 3 lines
  FEED_5: Buffer.from([ESC, 0x64, 0x05]),             // Feed 5 lines
  CUT_PARTIAL: Buffer.from([GS, 0x56, 0x01]),         // Partial cut
  CUT_FULL: Buffer.from([GS, 0x56, 0x00]),            // Full cut

  // Line spacing
  LINE_SPACING_DEFAULT: Buffer.from([ESC, 0x32]),     // Default spacing
  LINE_SPACING_TIGHT: Buffer.from([ESC, 0x33, 0x10]), // Tight spacing (16 dots)
};

// 58mm = ~32 chars at normal font
const LINE_WIDTH = 32;

// ─── HELPER FUNCTIONS ───────────────────────────────────────

function textBuf(str) {
  return Buffer.from(str, 'utf8');
}

function line(char = '-') {
  return textBuf(char.repeat(LINE_WIDTH));
}

function doubleLine() {
  return textBuf('='.repeat(LINE_WIDTH));
}

/** Left-right justified text within LINE_WIDTH */
function leftRight(left, right) {
  const space = LINE_WIDTH - left.length - right.length;
  if (space < 1) {
    // If too long, truncate left side
    const maxLeft = LINE_WIDTH - right.length - 1;
    return textBuf(left.substring(0, maxLeft) + ' ' + right);
  }
  return textBuf(left + ' '.repeat(space) + right);
}

/** Center text within LINE_WIDTH */
function centerText(str) {
  if (str.length >= LINE_WIDTH) return textBuf(str.substring(0, LINE_WIDTH));
  const pad = Math.floor((LINE_WIDTH - str.length) / 2);
  return textBuf(' '.repeat(pad) + str);
}

/** Format IDR currency */
function formatRp(amount) {
  return 'Rp' + Number(amount).toLocaleString('id-ID');
}

/** Wrap long text to fit LINE_WIDTH with optional indent */
function wrapText(text, indent = 0) {
  const maxLen = LINE_WIDTH - indent;
  const prefix = ' '.repeat(indent);
  const lines = [];

  while (text.length > 0) {
    if (text.length <= maxLen) {
      lines.push(prefix + text);
      break;
    }
    // Find last space within maxLen
    let breakAt = text.lastIndexOf(' ', maxLen);
    if (breakAt <= 0) breakAt = maxLen;
    lines.push(prefix + text.substring(0, breakAt));
    text = text.substring(breakAt).trimStart();
  }

  return lines;
}

// ─── MAIN FORMAT FUNCTION ───────────────────────────────────

/**
 * Format receipt data into ESC/POS binary buffer
 * 
 * @param {Object} data - Receipt data
 * @param {string} data.orderId - Order ID (e.g., "OLSERA-12345")
 * @param {string|number} data.queueNumber - Queue number
 * @param {string} data.customerName - Customer name
 * @param {Array} data.items - Order items
 * @param {number} data.total - Total amount
 * @param {number} [data.discount] - Discount amount
 * @param {string} data.paymentMethod - Payment method
 * @returns {Buffer} ESC/POS binary commands
 */
function formatReceipt(data) {
  const parts = [];

  const add = (...buffers) => {
    buffers.forEach(b => parts.push(b));
  };

  const newline = () => add(CMD.FEED_LINE);

  // Current time
  const now = new Date().toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  });

  // Queue number: extract last 3 digits
  const queueNum = data.queueNumber || (() => {
    if (!data.orderId) return '000';
    const nums = data.orderId.replace(/[^0-9]/g, '');
    return nums.length > 3 ? nums.slice(-3) : nums.padStart(3, '0');
  })();

  // ═══════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════
  add(CMD.INIT);
  add(CMD.LINE_SPACING_DEFAULT);

  // ═══════════════════════════════════════
  // HEADER — Brand
  // ═══════════════════════════════════════
  add(CMD.ALIGN_CENTER);
  add(logoRasterCommand(RAKKEN_LOGO_288));
  newline();
  newline(); // gap biar alamat gak mepet ke logo
  add(CMD.SIZE_NORMAL);
  add(CMD.BOLD_OFF);
  const addressLines = wrapText('Jl. HR. Soebrantas, Simpang Baru, Kec. Tampan, Kota Pekanbaru, Riau', 0);
  for (const al of addressLines) {
    add(textBuf(al));
    newline();
  }

  // Divider
  add(CMD.ALIGN_LEFT);
  add(doubleLine());
  newline();

  // ═══════════════════════════════════════
  // ORDER INFO
  // ═══════════════════════════════════════
  add(CMD.ALIGN_LEFT);
  add(CMD.SIZE_NORMAL);
  add(leftRight('Tanggal:', now));
  newline();
  add(leftRight('Order:', data.orderId || '-'));
  newline();
  if (data.customerName) {
    add(leftRight('Nama:', data.customerName));
    newline();
  }

  // Divider
  add(doubleLine());
  newline();

  // ═══════════════════════════════════════
  // QUEUE NUMBER — BIG & BOLD
  // ═══════════════════════════════════════
  add(CMD.ALIGN_CENTER);
  add(CMD.SIZE_NORMAL);
  add(textBuf('NOMOR ANTREAN'));
  newline();
  add(CMD.BOLD_ON);
  add(CMD.SIZE_TRIPLE);
  add(textBuf(`#${queueNum}`));
  newline();
  add(CMD.SIZE_NORMAL);
  add(CMD.BOLD_OFF);

  // Divider
  add(CMD.ALIGN_LEFT);
  add(doubleLine());
  newline();

  // ═══════════════════════════════════════
  // ITEMS
  // ═══════════════════════════════════════
  add(CMD.ALIGN_LEFT);
  add(CMD.LINE_SPACING_TIGHT);

  // Known add-on price lookup (name pattern → price in IDR)
  const ADDON_PRICES = [
    { pattern: /^extra 2 shots?$/i, price: 12000 },
    { pattern: /^extra 1 shots?$/i, price: 6000 },
    { pattern: /^png signature$/i, price: 6000 },
    { pattern: /^skim milk$/i, price: 6000 },
    { pattern: /^oat milk$/i, price: 6000 },
    { pattern: /^sea salt cream$/i, price: 6000 },
    { pattern: /^cheese cream$/i, price: 6000 },
    { pattern: /^almond milk$/i, price: 6000 },
    { pattern: /^espresso shot$/i, price: 6000 },
    { pattern: /^whip cream$/i, price: 6000 },
    { pattern: /^extra shot$/i, price: 6000 },
  ];

  // Notes that are customization options (no extra cost)
  const FREE_NOTE_PATTERNS = [
    /^size:/i, /sugar$/i, /ice$/i, /^hot$/i, /^iced?$/i,
    /^no sugar$/i, /^no ice$/i, /^normal$/i,
    /^dairy milk$/i, /^rakken blend$/i, /^normal shot$/i,
  ];

  function lookupAddonPrice(noteName) {
    const trimmed = noteName.trim();
    for (const addon of ADDON_PRICES) {
      if (addon.pattern.test(trimmed)) return addon.price;
    }
    return 0;
  }

  function isFreeNote(noteName) {
    const trimmed = noteName.trim();
    return FREE_NOTE_PATTERNS.some(p => p.test(trimmed));
  }

  if (data.items && data.items.length > 0) {
    for (const item of data.items) {
      const name = item.menuItem?.name || item.name || 'Item';
      const qty = item.quantity || 1;
      const price = item.price || item.subtotal || 0;
      const subtotal = price * qty;

      // Parse notes to extract add-ons with prices
      let addons = []; // { name, price }
      let freeNotes = []; // customizations without price (sugar, ice, etc.)
      
      if (item.notes) {
        const notesArray = item.notes.split(/,\s+/).filter(Boolean);
        for (const note of notesArray) {
          const cleanNote = note.replace(/,/g, ', ').replace(/\s+/g, ' ').trim();
          const capitalized = cleanNote.charAt(0).toUpperCase() + cleanNote.slice(1);
          const addonPrice = lookupAddonPrice(cleanNote);
          
          if (addonPrice > 0) {
            addons.push({ name: capitalized, price: addonPrice });
          } else if (!isFreeNote(cleanNote)) {
            // Unknown add-on — show without price
            freeNotes.push(capitalized);
          } else {
            freeNotes.push(capitalized);
          }
        }
      }

      // Calculate base+variant price (full price minus recognized add-ons)
      const totalAddonPrice = addons.reduce((sum, a) => sum + a.price, 0);
      const basePrice = Math.max(0, price - totalAddonPrice);

      // ── Line 1: Item name + full subtotal (bold) ──
      add(CMD.BOLD_ON);
      if (name.length + formatRp(subtotal).length + 1 <= LINE_WIDTH) {
        add(leftRight(name, formatRp(subtotal)));
        newline();
      } else {
        // Name too long — wrap name, then show subtotal on next line
        const nameLines = wrapText(name, 0);
        for (const nl of nameLines) {
          add(textBuf(nl));
          newline();
        }
        add(CMD.ALIGN_RIGHT);
        add(textBuf(formatRp(subtotal)));
        newline();
        add(CMD.ALIGN_LEFT);
      }
      add(CMD.BOLD_OFF);

      // ── Line 2: Qty x base price ──
      const qtyStr = `  ${qty}x ${formatRp(basePrice)}`;
      add(textBuf(qtyStr));
      newline();

      // ── Size (if not in notes) ──
      const hasSizeInNotes = item.notes && item.notes.toLowerCase().includes('size:');
      if (item.size && item.size !== '-' && !hasSizeInNotes) {
        add(textBuf(`  Size: ${item.size}`));
        newline();
      }

      // ── Free customizations (sugar, ice, etc.) ──
      for (const fn of freeNotes) {
        const fnLines = wrapText(`  * ${fn}`, 0);
        for (const nl of fnLines) {
          add(textBuf(nl));
          newline();
        }
      }

      // ── Paid add-ons with prices ──
      for (const addon of addons) {
        const label = `  + ${addon.name}`;
        const priceStr = `+${formatRp(addon.price)}`;
        add(leftRight(label, priceStr));
        newline();
      }

      // ── Item Discount ──
      if (item.discount && item.discount > 0) {
        add(leftRight('  Diskon', `-${formatRp(item.discount)}`));
        newline();
      }

      // Small gap between items
      newline();
    }
  }

  add(CMD.LINE_SPACING_DEFAULT);

  // ═══════════════════════════════════════
  // TOTALS
  // ═══════════════════════════════════════
  add(line('-'));
  newline();

  // Discount
  if (data.discount && data.discount > 0) {
    add(leftRight('Subtotal:', formatRp(data.total + data.discount)));
    newline();
    add(leftRight('Diskon:', `-${formatRp(data.discount)}`));
    newline();
  }

  // Total — Bold & slightly larger
  add(CMD.BOLD_ON);
  add(CMD.SIZE_DOUBLE_H);
  add(leftRight('TOTAL', formatRp(data.total)));
  newline();
  add(CMD.SIZE_NORMAL);
  add(CMD.BOLD_OFF);

  // Payment method
  add(leftRight('Bayar:', data.paymentMethod || 'QRIS'));
  newline();

  // Divider
  add(doubleLine());
  newline();

  // ═══════════════════════════════════════
  // FOOTER
  // ═══════════════════════════════════════
  add(CMD.ALIGN_CENTER);
  add(CMD.BOLD_ON);
  add(textBuf('*** TERIMA KASIH ***'));
  newline();
  add(CMD.BOLD_OFF);
  add(textBuf('Tunggu nomor antrean Anda'));
  newline();
  add(textBuf('dipanggil.'));
  newline();
  newline();
  add(textBuf('IG: @rakkencoffee'));
  newline();

  // Feed paper so receipt is fully visible
  add(CMD.FEED_5);

  // Cut (if printer supports it — EPM58UB biasanya tidak punya auto-cutter)
  // add(CMD.CUT_PARTIAL);

  return Buffer.concat(parts);
}

/**
 * Format Drink Labels into ESC/POS binary buffer
 * Prints individual labels for each drink cup.
 */
async function formatDrinkLabels(data) {
  const parts = [];
  const add = (...buffers) => buffers.forEach(b => parts.push(b));
  const newline = () => add(CMD.FEED_LINE);

  if (!data.items || data.items.length === 0) return Buffer.concat(parts);

  // Filter out food items (dessert, snack, main course, pastry, bites, makanan, cemilan)
  const excludedCategories = ['bites', 'dessert', 'main-course', 'snack', 'pastry', 'makanan', 'cemilan'];
  const drinkItems = data.items.filter(item => {
    const category = (item.categorySlug || item.category || '').toLowerCase();
    if (category) {
      return !excludedCategories.some(excluded => category.includes(excluded));
    }
    // Fallback if categorySlug is missing
    const name = (item.menuItem?.name || item.name || '').toLowerCase();
    return !excludedCategories.some(excluded => name.includes(excluded));
  });

  if (drinkItems.length === 0) return Buffer.concat(parts);

  const totalCups = drinkItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
  let currentCup = 1;

  const queueNum = data.queueNumber || (() => {
    if (!data.orderId) return '000';
    const nums = data.orderId.replace(/[^0-9]/g, '');
    return nums.length > 3 ? nums.slice(-3) : nums.padStart(3, '0');
  })();

  // Header (logo kiri + nomor antrian kanan) di-generate SEKALI, dipakai ulang
  // buat semua cup di order yang sama (nomor antreannya kan sama semua)
  const headerRaster = await buildHeaderRaster(queueNum);

  for (const item of drinkItems) {
    const qty = item.quantity || 1;
    for (let i = 0; i < qty; i++) {
      add(CMD.INIT);
      add(CMD.LINE_SPACING_DEFAULT);
      add(CMD.FONT_B); // font kondensed biar teks gak full lebar kertas

      // Header gabungan: logo pojok kiri, nomor antrian pojok kanan
      add(CMD.ALIGN_CENTER);
      add(logoRasterCommand(headerRaster));
      newline();

      // Info line: nama pelanggan - jenis order - urutan cup (misal 01/02)
      add(CMD.ALIGN_LEFT);
      const customerLabel = data.customerName || 'Customer';
      const orderTypeLabel = data.orderType === 'DINE_IN' ? 'Dine In' : 'Takeaway';
      const cupNote = `${String(currentCup).padStart(2, '0')}/${String(totalCups).padStart(2, '0')}`;
      add(textBuf(`${customerLabel} - ${orderTypeLabel} - ${cupNote}`));
      newline();
      newline(); // gap dikit sebelum menu

      add(CMD.BOLD_ON);
      const name = item.menuItem?.name || item.name || 'Drink';
      const hasSizeInNotes = item.notes && item.notes.toLowerCase().includes('size:');
      const sizeStr = (item.size && item.size !== '-' && !hasSizeInNotes) ? ` (${item.size})` : '';
      const nameLines = wrapText(`${name}${sizeStr}`, 0);
      for (const nl of nameLines) {
        add(textBuf(nl));
        newline();
      }
      add(CMD.BOLD_OFF);

      // Notes / Customizations — 1 baris menyamping, dipisah "|" (bukan ke bawah),
      // isinya persis sesuai nama di menu & pilihan customer (bukan teks bebas)
      if (item.notes) {
        const notesArray = item.notes.split(',').map(n => n.trim()).filter(Boolean);
        const cleaned = notesArray.map(note => note.replace(/^Size:\s*/i, '').toUpperCase());
        const notesLine = cleaned.join(' | ');
        const noteLines = wrapText(notesLine, 0);
        for (const nl of noteLines) {
          add(textBuf(nl));
          newline();
        }
      }
      newline(); // gap dikit sebelum tanggal

      // Tanggal & Jam
      const orderDate = new Date().toLocaleString('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Jakarta',
      });
      add(textBuf(orderDate));
      newline();

      // Feed buat sobek manual (printer ini gak ada auto-cutter) — dinaikin
      // dikit dari 1 baris karena tanggalnya kepotong pas sobek terlalu mepet
      add(CMD.FEED_3);

      currentCup++;
    }
  }

  return Buffer.concat(parts);
}

module.exports = { formatReceipt, formatDrinkLabels };
