/**
 * Preview Terminal — parse buffer ESC/POS dan tampilin langsung di terminal
 * (teks doang, gambar/QR diganti placeholder), TANPA kirim ke printer manapun.
 *
 * Jalankan: node src/preview-terminal.js
 */
const { formatDrinkLabels } = require('./format-receipt');

const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;
const WIDTH = 32;

function parseEscPos(buf) {
  const lines = [];
  let align = 'left';
  let bold = false;
  let sizeClass = 'normal';
  let textBytes = [];

  const pushLine = () => {
    const text = Buffer.from(textBytes).toString('utf8');
    lines.push({ text, bold, align, sizeClass });
    textBytes = [];
  };

  let i = 0;
  while (i < buf.length) {
    const b = buf[i];

    if (b === ESC && buf[i + 1] === 0x40) { align = 'left'; bold = false; sizeClass = 'normal'; i += 2; continue; }
    if (b === ESC && buf[i + 1] === 0x61) { const n = buf[i + 2]; align = n === 0x01 ? 'center' : n === 0x02 ? 'right' : 'left'; i += 3; continue; }
    if (b === ESC && buf[i + 1] === 0x45) { bold = buf[i + 2] === 0x01; i += 3; continue; }
    if (b === ESC && buf[i + 1] === 0x4D) { i += 3; continue; } // font select, ignore in preview
    if (b === GS && buf[i + 1] === 0x21) {
      const n = buf[i + 2];
      sizeClass = n === 0x11 ? 'double' : n === 0x22 ? 'triple' : n === 0x01 ? 'double-h' : n === 0x10 ? 'double-w' : 'normal';
      i += 3; continue;
    }
    if (b === ESC && buf[i + 1] === 0x64) {
      const n = buf[i + 2];
      pushLine();
      for (let k = 0; k < n; k++) lines.push({ text: '', bold: false, align: 'left', sizeClass: 'normal' });
      i += 3; continue;
    }
    if (b === GS && buf[i + 1] === 0x56) { i += 3; continue; } // cut
    if (b === ESC && buf[i + 1] === 0x32) { i += 2; continue; }
    if (b === ESC && buf[i + 1] === 0x33) { i += 3; continue; }

    // Raster image: GS v 0 m xL xH yL yH <data xL*8 bytes-per-row * height>
    if (b === GS && buf[i + 1] === 0x76 && buf[i + 2] === 0x30) {
      const xL = buf[i + 4], xH = buf[i + 5], yL = buf[i + 6], yH = buf[i + 7];
      const bytesPerRow = xL | (xH << 8);
      const height = yL | (yH << 8);
      const dataLen = bytesPerRow * height;
      pushLine();
      lines.push({ text: `[GAMBAR ${bytesPerRow * 8}x${height}]`, bold: false, align, sizeClass: 'normal' });
      i += 8 + dataLen;
      continue;
    }

    // QR code command family: GS ( k pL pH cn fn ...
    if (b === GS && buf[i + 1] === 0x28 && buf[i + 2] === 0x6B) {
      const pL = buf[i + 3], pH = buf[i + 4];
      const paramLen = pL | (pH << 8);
      const fn = buf[i + 3 + 2 + 1]; // cn at +5, fn at +6
      if (fn === 0x51) { // print symbol fn
        pushLine();
        lines.push({ text: '[QR CODE]', bold: false, align, sizeClass: 'normal' });
      }
      i += 5 + paramLen;
      continue;
    }

    if (b === LF) { pushLine(); i += 1; continue; }

    textBytes.push(b);
    i += 1;
  }
  if (textBytes.length > 0) pushLine();
  return lines;
}

function padLine(text, align) {
  if (text.length >= WIDTH) return text.slice(0, WIDTH);
  const space = WIDTH - text.length;
  if (align === 'center') {
    const left = Math.floor(space / 2);
    return ' '.repeat(left) + text + ' '.repeat(space - left);
  }
  if (align === 'right') return ' '.repeat(space) + text;
  return text + ' '.repeat(space);
}

function render(lines) {
  const border = '+' + '-'.repeat(WIDTH + 2) + '+';
  console.log(border);
  for (const l of lines) {
    let text = l.text;
    if (l.sizeClass === 'double' || l.sizeClass === 'triple') text = `[BESAR] ${text}`;
    if (l.bold) text = text; // bold shown via uppercase marker below if needed
    const padded = padLine(text, l.align);
    console.log(`| ${padded} |`);
  }
  console.log(border);
}

const data = {
  orderId: 'OLSERA-TEST-002',
  queueNumber: '088',
  customerName: 'Budi Santoso',
  items: [
    {
      name: 'Dirty Matcha',
      quantity: 1,
      price: 35000,
      size: 'Large',
      notes: 'Less Ice, Extra Shot, Oat Milk, No Sugar, Whip Cream',
    },
  ],
  orderType: 'DINE_IN',
};

(async () => {
  const buf = await formatDrinkLabels(data);
  console.log(`\nTotal buffer: ${buf.length} byte\n`);
  const lines = parseEscPos(buf);
  render(lines);
})();
