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
 * DENSITY). 200 DPI = 8 dots/mm.
 *
 * Font width note: the manual's own bitmap-font dot widths (8/12/16 for
 * fonts 1/2/3) didn't match this clone's actual rendering -- confirmed
 * 2026-09-13 when a notes line we calculated should fit on one line came
 * back auto-wrapped by the printer itself mid-word ("NORMAL" split into
 * "NO"/"RMAL"), meaning our own wrapByDots() thought more would fit per
 * line than the printer's real character cells allow. FONT_CHAR_WIDTH_DOTS
 * below is scaled up ~1.5x from the manual's numbers to match.
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

const FONT_CHAR_WIDTH_DOTS: Record<string, number> = { '1': 12, '2': 18, '3': 24 };
// Confirmed 2026-09-13 (round 2): lines printed physically overlapping --
// these were the manual's stated glyph heights (12/20/24) plus a small
// line-gap margin, but that manual spec already proved wrong for this
// clone's char width (see FONT_CHAR_WIDTH_DOTS above, ~1.5x the manual's
// number). Applying the same ~1.5x correction here: 18/30/36 actual glyph
// height, plus the same small margins as before so consecutive lines don't
// touch.
const FONT_LINE_HEIGHT_DOTS: Record<string, number> = { '1': 22, '2': 36, '3': 42 };

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

// Portrait, not landscape. The roll's paper is 58mm wide, but this class of
// 58mm thermal head is commonly a 384-dot (~48mm) printable area with a
// non-printing margin on each side -- widthMm here targets the printable
// area, not the full paper width, matching the ~31-char wrap width actually
// observed on the printer in the 2026-09-13 test.
//
// heightMm is a generous ceiling, not a match for the real physical label
// pitch (still unconfirmed -- somewhere under 60mm, since a 60mm canvas
// caused the printer to cut the label before the date printed). It's safe
// to overstate on purpose now that the date is placed right after the
// content instead of pinned near the bottom of the declared height -- see
// the comment at dateY below.
const DEFAULT_OPTIONS: Required<TsplLabelOptions> = {
  widthMm: 48,
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

      // Date, placed right after whatever content came before it. NOT pinned
      // near the bottom of heightMm -- that only works if heightMm matches
      // the real physical label pitch exactly, and it doesn't (confirmed
      // 2026-09-13: a 60mm canvas with the old bottom-pinned date caused the
      // date to land past the real label's edge and print on the next
      // physical label instead). Following the content keeps this correct
      // regardless of how generous heightMm is.
      const orderDate = new Date().toLocaleString('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Jakarta',
      });
      y += 6;
      commandLines.push(textCmd(marginX, y, FONT.SMALL, orderDate));

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
