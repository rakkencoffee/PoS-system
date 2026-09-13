/**
 * Format Label — TSPL/TSPL2 commands, for the RPP02N (TSC 5824TSC clone)
 * Bluetooth label printer used at the Barista station.
 *
 * Confirmed 2026-09-13: this printer's own self-test sticker prints
 * "App: TSPL+CPCL" -- it does NOT speak ESC/POS at all (unlike the QPOS/iWare
 * units format-receipt.ts targets). Sending ESC/POS bytes over BLE connects
 * and writes without any error (the write itself always "succeeds"), but the
 * printer silently discards every byte since none of it parses as valid
 * TSPL/CPCL, so nothing ever comes out. This is a separate formatter, not a
 * flag on the existing one, because the two command languages don't share
 * anything below the label-content level (no INIT/ESC bytes, plain ASCII
 * text commands terminated by CR LF instead).
 *
 * Reference: TSC TSPL/TSPL2 Programming Manual (SIZE, GAP, CLS, TEXT, PRINT,
 * DENSITY). 200 DPI = 8 dots/mm, matching this printer's 576 dots at 58mm
 * (allowing headroom past the label's actual print width).
 */

import { type ReceiptData, type ReceiptItem, isDrinkItem } from './format-receipt';

const CRLF = '\r\n';
const DOTS_PER_MM = 8; // 200 DPI

/** Built-in TSPL bitmap fonts (widths/heights in dots at x/y-multiplication=1). */
const FONT = {
  SMALL: '1', // 8x12
  MEDIUM: '2', // 12x20
  LARGE: '3', // 16x24
} as const;

const FONT_CHAR_WIDTH_DOTS: Record<string, number> = { '1': 8, '2': 12, '3': 16 };
const FONT_LINE_HEIGHT_DOTS: Record<string, number> = { '1': 16, '2': 26, '3': 30 };

/** TSPL requires literal double quotes inside string params to be escaped this way. */
function escapeTspl(text: string): string {
  return text.replace(/"/g, '\\["]');
}

function textCmd(x: number, y: number, font: string, content: string): string {
  return `TEXT ${x},${y},"${font}",0,1,1,"${escapeTspl(content)}"`;
}

function wrapByDots(text: string, font: string, maxWidthDots: number): string[] {
  const maxChars = Math.max(1, Math.floor(maxWidthDots / FONT_CHAR_WIDTH_DOTS[font]));
  const lines: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxChars) {
      lines.push(remaining);
      break;
    }
    let breakAt = remaining.lastIndexOf(' ', maxChars);
    if (breakAt <= 0) breakAt = maxChars;
    lines.push(remaining.slice(0, breakAt));
    remaining = remaining.slice(breakAt).trimStart();
  }
  return lines;
}

export interface TsplLabelOptions {
  /** Physical label width, mm -- adjust to match the actual roll in use. */
  widthMm?: number;
  /** Physical label height, mm. */
  heightMm?: number;
  /** Gap between labels, mm (0 for continuous stock). */
  gapMm?: number;
  /** Print darkness, 0 (lightest) - 15 (darkest). Printer default is 8. */
  density?: number;
}

// Portrait, not landscape. Confirmed via the printer's own self-test sticker
// (2026-09-13 photo) that the physical roll is 58mm wide, not the 40mm this
// was guessing before -- that alone was enough to throw off every margin/wrap
// calculation. Label length was declared as 30mm, but the self-test's four
// info/checkerboard/order blocks each print roughly one physical label's
// worth of content and all look near-square against the 58mm width, putting
// the real pitch closer to ~60mm. 30mm was too short once notes wrapped to
// 2-3 lines -- content that ran past the declared height didn't get clipped,
// it kept printing straight past the label's physical edge and onto the next
// one, which is what showed up as overlapping/garbled text in that test
// print. Still an estimate pending a ruler check -- adjust heightMm if the
// next physical test shows it's off.
const DEFAULT_OPTIONS: Required<TsplLabelOptions> = {
  widthMm: 58,
  heightMm: 60,
  gapMm: 2,
  density: 8,
};

function formatItemLabelsTspl(
  data: ReceiptData,
  items: ReceiptItem[],
  defaultName: string,
  opts: TsplLabelOptions = {}
): Buffer {
  const { widthMm, heightMm, gapMm, density } = { ...DEFAULT_OPTIONS, ...opts };
  const widthDots = widthMm * DOTS_PER_MM;
  const heightDots = heightMm * DOTS_PER_MM;
  const marginX = 10;
  const contentWidth = widthDots - marginX * 2;

  if (items.length === 0) return Buffer.alloc(0);

  const totalItems = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
  let currentItem = 1;

  const queueNum =
    data.queueNumber ||
    (() => {
      if (!data.orderId) return '000';
      const nums = data.orderId.replace(/[^0-9]/g, '');
      return nums.length > 3 ? nums.slice(-3) : nums.padStart(3, '0');
    })();

  const commandLines: string[] = [];

  for (const item of items) {
    const qty = item.quantity || 1;
    for (let i = 0; i < qty; i++) {
      commandLines.push(`SIZE ${widthMm} mm,${heightMm} mm`);
      commandLines.push(`GAP ${gapMm} mm,0 mm`);
      commandLines.push(`DENSITY ${density}`);
      commandLines.push('DIRECTION 0');
      commandLines.push('CLS');

      let y = 8;

      // Header: queue number (left) + item index of total (right)
      const itemNote = `${String(currentItem).padStart(2, '0')}/${String(totalItems).padStart(2, '0')}`;
      commandLines.push(textCmd(marginX, y, FONT.MEDIUM, `No.${queueNum}`));
      const idxX = Math.max(marginX, widthDots - marginX - itemNote.length * FONT_CHAR_WIDTH_DOTS[FONT.MEDIUM]);
      commandLines.push(textCmd(idxX, y, FONT.MEDIUM, itemNote));
      y += FONT_LINE_HEIGHT_DOTS[FONT.MEDIUM];

      // Customer name
      const customerLabel = data.customerName || 'Customer';
      commandLines.push(textCmd(marginX, y, FONT.SMALL, customerLabel));
      y += FONT_LINE_HEIGHT_DOTS[FONT.SMALL] + 6;

      // Item name (+ size, unless already folded into notes as "Size: ...")
      const name = item.menuItem?.name || item.name || defaultName;
      const hasSizeInNotes = item.notes && item.notes.toLowerCase().includes('size:');
      const sizeStr = item.size && item.size !== '-' && !hasSizeInNotes ? ` (${item.size})` : '';
      const nameLines = wrapByDots(`${name}${sizeStr}`, FONT.LARGE, contentWidth);
      for (const nl of nameLines) {
        commandLines.push(textCmd(marginX, y, FONT.LARGE, nl));
        y += FONT_LINE_HEIGHT_DOTS[FONT.LARGE];
      }

      // Notes (sugar/ice/milk/etc.), joined on "|"-separated line(s)
      if (item.notes) {
        const notesArray = item.notes.split(',').map((n) => n.trim()).filter(Boolean);
        const cleaned = notesArray.map((note) => note.replace(/^Size:\s*/i, '').toUpperCase());
        const notesLine = cleaned.join(' | ');
        const noteLines = wrapByDots(notesLine, FONT.SMALL, contentWidth);
        for (const nl of noteLines) {
          commandLines.push(textCmd(marginX, y, FONT.SMALL, nl));
          y += FONT_LINE_HEIGHT_DOTS[FONT.SMALL];
        }
      }

      // Date, pinned near the bottom (pushed down further if content ran long)
      const orderDate = new Date().toLocaleString('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Jakarta',
      });
      const dateY = Math.max(y, heightDots - FONT_LINE_HEIGHT_DOTS[FONT.SMALL] - 4);
      commandLines.push(textCmd(marginX, dateY, FONT.SMALL, orderDate));

      commandLines.push('PRINT 1,1');

      currentItem++;
    }
  }

  return Buffer.from(commandLines.join(CRLF) + CRLF, 'utf8');
}

/** Individual per-cup drink labels (Barista station), TSPL variant. */
export function formatDrinkLabelsTspl(data: ReceiptData, opts?: TsplLabelOptions): Buffer {
  const drinkItems = (data.items || []).filter(isDrinkItem);
  return formatItemLabelsTspl(data, drinkItems, 'Drink', opts);
}

/** Individual per-item food labels (Kitchen station), TSPL variant. */
export function formatFoodLabelsTspl(data: ReceiptData, opts?: TsplLabelOptions): Buffer {
  const foodItems = (data.items || []).filter((item) => !isDrinkItem(item));
  return formatItemLabelsTspl(data, foodItems, 'Item', opts);
}
