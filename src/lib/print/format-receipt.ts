/**
 * Format Receipt — ESC/POS Commands, server-side port of print-bridge/src/format-receipt.js
 *
 * Used by direct-print.ts to send raw bytes straight from Vercel to a WiFi/LAN
 * printer (zero local daemon), instead of going through the local print-bridge.
 * Kept as a close mirror of the print-bridge version so both stay easy to compare.
 */

import { RAKKEN_LOGO_576, RAKKEN_LOGO_384, type LogoRaster } from './rakken-logo';

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

/** ESC/POS raster bit image command (GS v 0) — width must be a multiple of 8. */
function logoRasterCommand(logo: LogoRaster): Buffer {
  const bytesPerRow = logo.width / 8;
  const header = Buffer.from([
    GS, 0x76, 0x30, 0x00,
    bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff,
    logo.height & 0xff, (logo.height >> 8) & 0xff,
  ]);
  return Buffer.concat([header, logo.data]);
}

const CMD = {
  INIT: Buffer.from([ESC, 0x40]),
  ALIGN_LEFT: Buffer.from([ESC, 0x61, 0x00]),
  ALIGN_CENTER: Buffer.from([ESC, 0x61, 0x01]),
  ALIGN_RIGHT: Buffer.from([ESC, 0x61, 0x02]),
  BOLD_ON: Buffer.from([ESC, 0x45, 0x01]),
  BOLD_OFF: Buffer.from([ESC, 0x45, 0x00]),
  SIZE_NORMAL: Buffer.from([GS, 0x21, 0x00]),
  SIZE_DOUBLE_H: Buffer.from([GS, 0x21, 0x01]),
  SIZE_DOUBLE_W: Buffer.from([GS, 0x21, 0x10]),
  SIZE_DOUBLE: Buffer.from([GS, 0x21, 0x11]),
  SIZE_TRIPLE: Buffer.from([GS, 0x21, 0x22]),
  FEED_LINE: Buffer.from([LF]),
  FEED_3: Buffer.from([ESC, 0x64, 0x03]),
  FEED_5: Buffer.from([ESC, 0x64, 0x05]),
  CUT_PARTIAL: Buffer.from([GS, 0x56, 0x01]),
  CUT_FULL: Buffer.from([GS, 0x56, 0x00]),
  LINE_SPACING_DEFAULT: Buffer.from([ESC, 0x32]),
  LINE_SPACING_TIGHT: Buffer.from([ESC, 0x33, 0x10]),
};

export interface ReceiptItem {
  menuItem?: { name?: string };
  name?: string;
  quantity?: number;
  price?: number;
  subtotal?: number;
  notes?: string;
  size?: string;
  discount?: number;
  categorySlug?: string;
  category?: string;
}

export interface ReceiptData {
  orderId?: string;
  queueNumber?: string | number;
  customerName?: string;
  items?: ReceiptItem[];
  total: number;
  discount?: number;
  paymentMethod?: string;
}

function textBuf(str: string): Buffer {
  return Buffer.from(str, 'utf8');
}

/**
 * @param lineWidth chars per line — 32 for 58mm paper, 48 for 80mm (iWare D260WF)
 */
export function formatReceipt(data: ReceiptData, lineWidth = 48): Buffer {
  const parts: Buffer[] = [];
  const add = (...buffers: Buffer[]) => buffers.forEach((b) => parts.push(b));
  const newline = () => add(CMD.FEED_LINE);

  const line = (char = '-') => textBuf(char.repeat(lineWidth));
  const doubleLine = () => textBuf('='.repeat(lineWidth));

  const leftRight = (left: string, right: string) => {
    const space = lineWidth - left.length - right.length;
    if (space < 1) {
      const maxLeft = lineWidth - right.length - 1;
      return textBuf(left.substring(0, maxLeft) + ' ' + right);
    }
    return textBuf(left + ' '.repeat(space) + right);
  };

  const wrapText = (text: string, indent = 0) => {
    const maxLen = lineWidth - indent;
    const prefix = ' '.repeat(indent);
    const lines: string[] = [];
    while (text.length > 0) {
      if (text.length <= maxLen) {
        lines.push(prefix + text);
        break;
      }
      let breakAt = text.lastIndexOf(' ', maxLen);
      if (breakAt <= 0) breakAt = maxLen;
      lines.push(prefix + text.substring(0, breakAt));
      text = text.substring(breakAt).trimStart();
    }
    return lines;
  };

  const formatRp = (amount: number) => 'Rp' + Number(amount).toLocaleString('id-ID');

  const now = new Date().toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  });

  const queueNum =
    data.queueNumber ||
    (() => {
      if (!data.orderId) return '000';
      const nums = data.orderId.replace(/[^0-9]/g, '');
      return nums.length > 3 ? nums.slice(-3) : nums.padStart(3, '0');
    })();

  add(CMD.INIT);
  add(CMD.LINE_SPACING_DEFAULT);

  add(CMD.ALIGN_CENTER);
  add(logoRasterCommand(lineWidth >= 48 ? RAKKEN_LOGO_576 : RAKKEN_LOGO_384));
  newline();
  add(CMD.SIZE_NORMAL);
  add(CMD.BOLD_OFF);
  add(textBuf('STARTFRIDAY SPECIALTY'));
  newline();
  add(textBuf('South Jakarta'));
  newline();

  add(CMD.ALIGN_LEFT);
  add(doubleLine());
  newline();

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

  add(doubleLine());
  newline();

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

  add(CMD.ALIGN_LEFT);
  add(doubleLine());
  newline();

  add(CMD.ALIGN_LEFT);
  add(CMD.LINE_SPACING_TIGHT);

  const ADDON_PRICES: { pattern: RegExp; price: number }[] = [
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

  const FREE_NOTE_PATTERNS: RegExp[] = [
    /^size:/i, /sugar$/i, /ice$/i, /^hot$/i, /^iced?$/i,
    /^no sugar$/i, /^no ice$/i, /^normal$/i,
    /^dairy milk$/i, /^rakken blend$/i, /^normal shot$/i,
  ];

  const lookupAddonPrice = (noteName: string) => {
    const trimmed = noteName.trim();
    const found = ADDON_PRICES.find((a) => a.pattern.test(trimmed));
    return found ? found.price : 0;
  };

  const isFreeNote = (noteName: string) => {
    const trimmed = noteName.trim();
    return FREE_NOTE_PATTERNS.some((p) => p.test(trimmed));
  };

  if (data.items && data.items.length > 0) {
    for (const item of data.items) {
      const name = item.menuItem?.name || item.name || 'Item';
      const qty = item.quantity || 1;
      const price = item.price || item.subtotal || 0;
      const subtotal = price * qty;

      const addons: { name: string; price: number }[] = [];
      const freeNotes: string[] = [];

      if (item.notes) {
        const notesArray = item.notes.split(/,\s+/).filter(Boolean);
        for (const note of notesArray) {
          const cleanNote = note.replace(/,/g, ', ').replace(/\s+/g, ' ').trim();
          const capitalized = cleanNote.charAt(0).toUpperCase() + cleanNote.slice(1);
          const addonPrice = lookupAddonPrice(cleanNote);
          if (addonPrice > 0) {
            addons.push({ name: capitalized, price: addonPrice });
          } else {
            freeNotes.push(capitalized);
          }
        }
      }

      const totalAddonPrice = addons.reduce((sum, a) => sum + a.price, 0);
      const basePrice = Math.max(0, price - totalAddonPrice);

      add(CMD.BOLD_ON);
      if (name.length + formatRp(subtotal).length + 1 <= lineWidth) {
        add(leftRight(name, formatRp(subtotal)));
        newline();
      } else {
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

      const qtyStr = `  ${qty}x ${formatRp(basePrice)}`;
      add(textBuf(qtyStr));
      newline();

      const hasSizeInNotes = item.notes && item.notes.toLowerCase().includes('size:');
      if (item.size && item.size !== '-' && !hasSizeInNotes) {
        add(textBuf(`  Size: ${item.size}`));
        newline();
      }

      for (const fn of freeNotes) {
        const fnLines = wrapText(`  * ${fn}`, 0);
        for (const nl of fnLines) {
          add(textBuf(nl));
          newline();
        }
      }

      for (const addon of addons) {
        const label = `  + ${addon.name}`;
        const priceStr = `+${formatRp(addon.price)}`;
        add(leftRight(label, priceStr));
        newline();
      }

      if (item.discount && item.discount > 0) {
        add(leftRight('  Diskon', `-${formatRp(item.discount)}`));
        newline();
      }

      newline();
    }
  }

  add(CMD.LINE_SPACING_DEFAULT);

  add(line('-'));
  newline();

  if (data.discount && data.discount > 0) {
    add(leftRight('Subtotal:', formatRp(data.total + data.discount)));
    newline();
    add(leftRight('Diskon:', `-${formatRp(data.discount)}`));
    newline();
  }

  add(CMD.BOLD_ON);
  add(CMD.SIZE_DOUBLE_H);
  add(leftRight('TOTAL', formatRp(data.total)));
  newline();
  add(CMD.SIZE_NORMAL);
  add(CMD.BOLD_OFF);

  add(leftRight('Bayar:', data.paymentMethod || 'QRIS'));
  newline();

  add(doubleLine());
  newline();

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

  add(CMD.FEED_5);

  return Buffer.concat(parts);
}

/** Individual per-cup drink labels — mirrors formatDrinkLabels in print-bridge/src/format-receipt.js */
export function formatDrinkLabels(data: ReceiptData, lineWidth = 48): Buffer {
  const parts: Buffer[] = [];
  const add = (...buffers: Buffer[]) => buffers.forEach((b) => parts.push(b));
  const newline = () => add(CMD.FEED_LINE);
  const line = (char = '-') => textBuf(char.repeat(lineWidth));

  const leftRight = (left: string, right: string) => {
    const space = lineWidth - left.length - right.length;
    if (space < 1) {
      const maxLeft = lineWidth - right.length - 1;
      return textBuf(left.substring(0, maxLeft) + ' ' + right);
    }
    return textBuf(left + ' '.repeat(space) + right);
  };

  const wrapText = (text: string, indent = 0) => {
    const maxLen = lineWidth - indent;
    const prefix = ' '.repeat(indent);
    const lines: string[] = [];
    while (text.length > 0) {
      if (text.length <= maxLen) {
        lines.push(prefix + text);
        break;
      }
      let breakAt = text.lastIndexOf(' ', maxLen);
      if (breakAt <= 0) breakAt = maxLen;
      lines.push(prefix + text.substring(0, breakAt));
      text = text.substring(breakAt).trimStart();
    }
    return lines;
  };

  if (!data.items || data.items.length === 0) return Buffer.concat(parts);

  const excludedCategories = ['bites', 'dessert', 'main-course', 'snack', 'pastry', 'makanan', 'cemilan'];
  const drinkItems = data.items.filter((item) => {
    const category = (item.categorySlug || item.category || '').toLowerCase();
    if (category) return !excludedCategories.some((excluded) => category.includes(excluded));
    const name = (item.menuItem?.name || item.name || '').toLowerCase();
    return !excludedCategories.some((excluded) => name.includes(excluded));
  });

  if (drinkItems.length === 0) return Buffer.concat(parts);

  const totalCups = drinkItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
  let currentCup = 1;

  const queueNum =
    data.queueNumber ||
    (() => {
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

      add(CMD.ALIGN_LEFT);
      add(CMD.SIZE_NORMAL);
      add(CMD.BOLD_ON);
      add(leftRight(`No: ${queueNum}`, `${currentCup}/${totalCups}`));
      newline();

      const name = item.menuItem?.name || item.name || 'Drink';
      const hasSizeInNotes = item.notes && item.notes.toLowerCase().includes('size:');
      const sizeStr = item.size && item.size !== '-' && !hasSizeInNotes ? ` (${item.size})` : '';
      const nameLines = wrapText(`${name}${sizeStr}`, 0);
      for (const nl of nameLines) {
        add(textBuf(nl));
        newline();
      }
      add(CMD.BOLD_OFF);

      if (item.notes) {
        const notesArray = item.notes.split(',').map((n) => n.trim()).filter(Boolean);
        for (let note of notesArray) {
          note = note.replace(/^Size:\s*/i, '');
          const noteLines = wrapText(`  * ${note.toUpperCase()}`, 0);
          for (const nl of noteLines) {
            add(textBuf(nl));
            newline();
          }
        }
      } else {
        newline();
      }

      newline();
      add(CMD.ALIGN_LEFT);
      add(CMD.SIZE_NORMAL);
      add(textBuf(now));
      newline();

      newline();
      add(line('-'));
      newline();

      add(CMD.FEED_5);

      currentCup++;
    }
  }

  return Buffer.concat(parts);
}
