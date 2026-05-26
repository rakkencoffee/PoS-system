/**
 * Format Receipt — ESC/POS Commands for 58mm Thermal Printer
 * 
 * QPOS EPM58UB: 58mm paper = 384 dots = ~32 chars per line (normal font)
 * Uses raw ESC/POS byte commands for precise thermal printer control.
 */

// ─── ESC/POS COMMAND CONSTANTS ──────────────────────────────
const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;

const CMD = {
  // Initialize printer
  INIT: Buffer.from([ESC, 0x40]),

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
  add(CMD.BOLD_ON);
  add(CMD.SIZE_DOUBLE_W);
  add(textBuf('RAKKEN COFFEE'));
  newline();
  add(CMD.SIZE_NORMAL);
  add(CMD.BOLD_OFF);
  add(textBuf('STARTFRIDAY SPECIALTY'));
  newline();
  add(textBuf('South Jakarta'));
  newline();

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

  if (data.items && data.items.length > 0) {
    for (const item of data.items) {
      const name = item.menuItem?.name || item.name || 'Item';
      const qty = item.quantity || 1;
      const price = item.price || item.subtotal || 0;
      const subtotal = price * qty;

      // Item name (bold)
      add(CMD.BOLD_ON);
      const nameLines = wrapText(name, 0);
      for (const nl of nameLines) {
        add(textBuf(nl));
        newline();
      }
      add(CMD.BOLD_OFF);

      // Qty x Price = Subtotal
      const qtyStr = `  ${qty}x ${formatRp(price)}`;
      const subStr = formatRp(subtotal);
      add(leftRight(qtyStr, subStr));
      newline();

      // Size
      // Skip printing standalone Size if it's already in notes
      const hasSizeInNotes = item.notes && item.notes.toLowerCase().includes('size:');
      if (item.size && item.size !== '-' && !hasSizeInNotes) {
        add(textBuf(`  Size: ${item.size}`));
        newline();
      }

      // Notes / customization
      if (item.notes) {
        // Split by comma+space to keep "Hot,Small" together, but separate "normal Sugar"
        const notesArray = item.notes.split(/,\s+/).filter(Boolean);
        for (const note of notesArray) {
          // Add a space after comma for readability, e.g. "Hot,Small" -> "Hot, Small"
          const cleanNote = note.replace(/,/g, ', ').replace(/\s+/g, ' ');
          // Capitalize first letter
          const capitalized = cleanNote.charAt(0).toUpperCase() + cleanNote.slice(1);
          
          const noteLines = wrapText(`  * ${capitalized}`, 0);
          for (const nl of noteLines) {
            add(textBuf(nl));
            newline();
          }
        }
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
function formatDrinkLabels(data) {
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

  const now = new Date().toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'Asia/Jakarta',
  });

  for (const item of drinkItems) {
    const qty = item.quantity || 1;
    for (let i = 0; i < qty; i++) {
      add(CMD.INIT);
      add(CMD.LINE_SPACING_DEFAULT);
      
      // Header: No: 178         1/3
      add(CMD.ALIGN_LEFT);
      add(CMD.SIZE_NORMAL);
      add(CMD.BOLD_ON);
      add(leftRight(`No: ${queueNum}`, `${currentCup}/${totalCups}`));
      newline();
      
      // Name and Size
      const name = item.menuItem?.name || item.name || 'Drink';
      const hasSizeInNotes = item.notes && item.notes.toLowerCase().includes('size:');
      const sizeStr = (item.size && item.size !== '-' && !hasSizeInNotes) ? ` (${item.size})` : '';
      const nameLines = wrapText(`${name}${sizeStr}`, 0);
      for (const nl of nameLines) {
        add(textBuf(nl));
        newline();
      }
      add(CMD.BOLD_OFF);
      
      // Notes / Customizations
      if (item.notes) {
        // For stickers, we split by ALL commas to put every variant on a new line for max readability
        const notesArray = item.notes.split(',').map(n => n.trim()).filter(Boolean);
        for (let note of notesArray) {
          // Remove "Size: " from the string for a cleaner sticker
          note = note.replace(/^Size:\s*/i, '');
          const noteLines = wrapText(`  * ${note.toUpperCase()}`, 0);
          for (const nl of noteLines) {
            add(textBuf(nl));
            newline();
          }
        }
      } else {
        // Empty notes but add space for alignment if needed
        newline();
      }
      
      // Footer Date/Time
      newline();
      add(CMD.ALIGN_LEFT);
      add(CMD.SIZE_NORMAL);
      add(textBuf(now));
      newline();
      
      // Cut line separator for manual tearing
      newline();
      add(line('-'));
      newline();
      
      // Feed paper to ensure it's outside the printer lip
      add(CMD.FEED_5);
      
      currentCup++;
    }
  }

  return Buffer.concat(parts);
}

module.exports = { formatReceipt, formatDrinkLabels };
