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

/**
 * Picks the biggest built-in font that fits `text` on a SINGLE line within
 * maxWidthDots, trying LARGE -> MEDIUM -> SMALL in that order. Item names
 * should read sideways on one line, not stack top-to-bottom -- confirmed
 * live 2026-09-15: a longer real menu name ("Butterscotch Cloud Coffee")
 * forced onto FONT.LARGE always wraps into an awkward multi-line stack no
 * matter how the wrap width is tuned, since LARGE simply can't fit that many
 * characters per line on this label. Falls back to wrapping at SMALL (the
 * font with the most characters per line) only if the text doesn't fit on
 * one line even at the smallest option.
 */
function fitToOneLine(text: string, maxWidthDots: number): { font: string; lines: string[] } {
  for (const font of [FONT.LARGE, FONT.MEDIUM, FONT.SMALL]) {
    const maxChars = Math.floor(maxWidthDots / FONT_CHAR_WIDTH_DOTS[font]);
    if (text.length <= maxChars) return { font, lines: [text] };
  }
  return { font: FONT.SMALL, lines: wrapByDots(text, FONT.SMALL, maxWidthDots) };
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
  /**
   * TSPL `OFFSET` command, mm -- fine-tunes where the gap sensor's "top of
   * label" reference sits relative to where the print head actually starts
   * printing. Omitted by default (no OFFSET line sent at all), NOT defaulted
   * to 0, because TSPL persists whatever OFFSET value it's given to the
   * printer's own memory -- sending "OFFSET 0 mm" on every normal print
   * would silently wipe out a value the printer was already calibrated to
   * (via this option, or via the printer's own physical gap-calibration
   * button) the next time someone prints without passing this. Only pass
   * this when deliberately (re)calibrating -- see sticker-test route's
   * ?offsetMm= param.
   */
  offsetMm?: number;
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
const DEFAULT_OPTIONS: Required<Omit<TsplLabelOptions, 'offsetMm'>> = {
  widthMm: 48,
  heightMm: 60,
  gapMm: 2,
  density: 8,
};

/**
 * Draws one label's content starting at `startY`, returning the drawn TEXT
 * commands plus the y position right after the last line (i.e. total content
 * height when called with startY=0). Extracted so formatItemLabelsTspl can
 * call it twice: once to measure content height, once for real with a
 * vertically-centered startY -- see the centering comment below.
 */
function buildLabelContent(
  startY: number,
  item: ReceiptItem,
  data: ReceiptData,
  defaultName: string,
  currentItem: number,
  totalItems: number,
  queueNum: string,
  widthDots: number,
  marginX: number,
  contentWidth: number
): { lines: string[]; endY: number } {
  const lines: string[] = [];
  let y = startY;

  // Header: queue number (left) + item index of total (right)
  const itemNote = `${String(currentItem).padStart(2, '0')}/${String(totalItems).padStart(2, '0')}`;
  lines.push(textCmd(marginX, y, FONT.MEDIUM, `No.${queueNum}`));
  const idxX = Math.max(marginX, widthDots - marginX - itemNote.length * FONT_CHAR_WIDTH_DOTS[FONT.MEDIUM]);
  lines.push(textCmd(idxX, y, FONT.MEDIUM, itemNote));
  y += FONT_LINE_HEIGHT_DOTS[FONT.MEDIUM];

  // Customer name
  const customerLabel = data.customerName || 'Customer';
  lines.push(textCmd(marginX, y, FONT.SMALL, customerLabel));
  y += FONT_LINE_HEIGHT_DOTS[FONT.SMALL] + 6;

  // Item name (+ size, unless already folded into notes as "Size: ...")
  const name = item.menuItem?.name || item.name || defaultName;
  const hasSizeInNotes = item.notes && item.notes.toLowerCase().includes('size:');
  const sizeStr = item.size && item.size !== '-' && !hasSizeInNotes ? ` (${item.size})` : '';
  const { font: nameFont, lines: nameLines } = fitToOneLine(`${name}${sizeStr}`, contentWidth);
  nameLines.forEach((nl, i) => {
    lines.push(textCmd(marginX, y, nameFont, nl));
    // Same fix as the notes lines below: consecutive lines at the same
    // font sit visibly tighter than every other transition on the label
    // without this extra margin (confirmed live 2026-09-15 for FONT.SMALL,
    // the size fitToOneLine falls back to when a name doesn't fit on one
    // line even at the smallest font) -- only needed *between* wrapped
    // lines, not after the last one (the existing +6 before notes/date
    // already covers that gap).
    y += FONT_LINE_HEIGHT_DOTS[nameFont] + (i < nameLines.length - 1 ? 6 : 0);
  });

  // Notes (sugar/ice/milk/etc.), joined on "|"-separated line(s)
  if (item.notes) {
    const notesArray = item.notes.split(',').map((n) => n.trim()).filter(Boolean);
    const cleaned = notesArray.map((note) => note.replace(/^Size:\s*/i, '').toUpperCase());
    const notesLine = cleaned.join(' | ');
    const noteLines = wrapByDots(notesLine, FONT.SMALL, contentWidth);
    noteLines.forEach((nl, i) => {
      lines.push(textCmd(marginX, y, FONT.SMALL, nl));
      // Physical test 2026-09-14: consecutive wrapped notes lines no
      // longer overlap (that was the FONT_LINE_HEIGHT_DOTS fix), but sit
      // visibly tighter than every other transition on the label -- the
      // only spot with zero extra margin between lines. Match the +6
      // already used around the customer-name and date lines, but only
      // *between* notes lines -- the existing +6 right before the date
      // below already covers the gap after the last one.
      y += FONT_LINE_HEIGHT_DOTS[FONT.SMALL] + (i < noteLines.length - 1 ? 6 : 0);
    });
  }

  // Date, placed right after whatever content came before it.
  const orderDate = new Date().toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  });
  y += 6;
  lines.push(textCmd(marginX, y, FONT.SMALL, orderDate));
  y += FONT_LINE_HEIGHT_DOTS[FONT.SMALL];

  return { lines, endY: y };
}

function formatItemLabelsTspl(
  data: ReceiptData,
  items: ReceiptItem[],
  defaultName: string,
  opts: TsplLabelOptions = {}
): Buffer {
  const { widthMm, heightMm, gapMm, density } = { ...DEFAULT_OPTIONS, ...opts };
  const { offsetMm } = opts;
  const widthDots = widthMm * DOTS_PER_MM;
  const heightDots = heightMm * DOTS_PER_MM;
  const marginX = 10;
  const contentWidth = widthDots - marginX * 2;
  // Floor for the gap from the physical top edge -- confirmed live
  // 2026-09-15 that content starting right at the edge (the old fixed y=8)
  // looks uncomfortably tight even when nothing is actually clipped.
  const minTopMarginDots = 24;

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
      if (offsetMm !== undefined) commandLines.push(`OFFSET ${offsetMm} mm`);
      commandLines.push(`DENSITY ${density}`);
      commandLines.push('DIRECTION 0');
      commandLines.push('CLS');

      // Center content vertically within heightMm instead of always starting
      // right at the top edge: confirmed live 2026-09-15 that after the
      // one-line-name fix, content got noticeably shorter (fewer wrapped
      // lines), leaving a big unused gap at the bottom while the top stayed
      // cramped. Measure the real content height first (dry run at y=0),
      // then re-draw starting from whatever y centers that block -- this
      // assumes heightMm reflects the real physical label pitch reasonably
      // closely (already the working assumption elsewhere in this file); if
      // it's overstated the result is just less-than-perfectly-centered, not
      // clipped, since the content itself never changes.
      const { endY: contentHeight } = buildLabelContent(
        0, item, data, defaultName, currentItem, totalItems, String(queueNum), widthDots, marginX, contentWidth
      );
      const startY = Math.max(minTopMarginDots, Math.round((heightDots - contentHeight) / 2));
      const { lines } = buildLabelContent(
        startY, item, data, defaultName, currentItem, totalItems, String(queueNum), widthDots, marginX, contentWidth
      );
      commandLines.push(...lines);

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
