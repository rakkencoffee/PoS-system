/**
 * Virtual Printer — Simulasi printer thermal via TCP (port 9100 standar raw printing)
 *
 * Dengerin koneksi TCP masuk, parse command ESC/POS yang dikirim (sama seperti
 * yang dibuat format-receipt.js), lalu render jadi HTML yang tampil kayak struk asli.
 * Dipakai buat validasi flow SEBELUM printer fisik datang.
 *
 * Jalankan: node src/virtual-printer.js [port]
 * Default port: 9100
 */

const net = require('net');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = Number(process.argv[2]) || 9100;
const OUTPUT_DIR = path.join(__dirname, '..', 'printed-receipts');

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;

/** Parse raw ESC/POS buffer jadi array of line objects { text, bold, align, sizeClass } */
function parseEscPos(buf) {
  const lines = [];
  let align = 'left';
  let bold = false;
  let sizeClass = 'normal'; // normal | double-h | double-w | double | triple
  let textBytes = [];
  let cut = false;

  const pushLine = () => {
    const text = Buffer.from(textBytes).toString('utf8');
    lines.push({ text, bold, align, sizeClass });
    textBytes = [];
  };

  let i = 0;
  while (i < buf.length) {
    const b = buf[i];

    if (b === ESC && buf[i + 1] === 0x40) { // INIT
      align = 'left'; bold = false; sizeClass = 'normal';
      i += 2; continue;
    }
    if (b === ESC && buf[i + 1] === 0x61) { // ALIGN
      const n = buf[i + 2];
      align = n === 0x01 ? 'center' : n === 0x02 ? 'right' : 'left';
      i += 3; continue;
    }
    if (b === ESC && buf[i + 1] === 0x45) { // BOLD
      bold = buf[i + 2] === 0x01;
      i += 3; continue;
    }
    if (b === GS && buf[i + 1] === 0x21) { // SIZE
      const n = buf[i + 2];
      sizeClass = n === 0x11 ? 'double' : n === 0x22 ? 'triple' : n === 0x01 ? 'double-h' : n === 0x10 ? 'double-w' : 'normal';
      i += 3; continue;
    }
    if (b === ESC && buf[i + 1] === 0x64) { // FEED N lines
      const n = buf[i + 2];
      pushLine();
      for (let k = 0; k < n; k++) lines.push({ text: '', bold: false, align: 'left', sizeClass: 'normal' });
      i += 3; continue;
    }
    if (b === GS && buf[i + 1] === 0x56) { // CUT
      cut = true;
      i += 3; continue;
    }
    if (b === ESC && buf[i + 1] === 0x32) { // line spacing default — ignore
      i += 2; continue;
    }
    if (b === ESC && buf[i + 1] === 0x33) { // line spacing tight — ignore, has 1 param byte
      i += 3; continue;
    }
    if (b === LF) {
      pushLine();
      i += 1; continue;
    }

    textBytes.push(b);
    i += 1;
  }
  if (textBytes.length > 0) pushLine();

  return { lines, cut };
}

function sizeToCss(sizeClass) {
  switch (sizeClass) {
    case 'double-h': return 'font-size:14px; display:inline-block; transform:scaleY(2); transform-origin:left;';
    case 'double-w': return 'font-size:14px; letter-spacing:3px;';
    case 'double': return 'font-size:28px;';
    case 'triple': return 'font-size:42px;';
    default: return 'font-size:14px;';
  }
}

function renderHtml(lines, meta) {
  const rows = lines.map(l => {
    const style = `text-align:${l.align}; font-weight:${l.bold ? '700' : '400'}; ${sizeToCss(l.sizeClass)}`;
    const escaped = (l.text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<div style="${style}">${escaped === '' ? '&nbsp;' : escaped}</div>`;
  }).join('\n');

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>Virtual Printer — ${meta.timestamp}</title>
<style>
  body { background:#3a3a3a; margin:0; padding:40px 0; font-family:"Courier New", monospace; }
  .paper {
    background:#fff; width:384px; margin:0 auto; padding:16px 12px;
    box-shadow:0 4px 24px rgba(0,0,0,0.4);
    white-space:pre-wrap; word-break:break-word; color:#111;
  }
  .meta { text-align:center; color:#aaa; font-size:12px; margin-bottom:12px; font-family:sans-serif; }
</style>
</head>
<body>
  <div class="meta">Diterima dari ${meta.remoteAddress} pada ${meta.timestamp} — ${meta.byteLength} bytes</div>
  <div class="paper">
${rows}
  </div>
</body>
</html>`;
}

const server = net.createServer((socket) => {
  const chunks = [];
  const remoteAddress = socket.remoteAddress;

  console.log(`[virtual-printer] Koneksi masuk dari ${remoteAddress}`);

  socket.on('data', (chunk) => {
    chunks.push(chunk);
  });

  socket.on('end', () => {
    const buf = Buffer.concat(chunks);
    console.log(`[virtual-printer] Data selesai diterima: ${buf.length} bytes`);

    const { lines } = parseEscPos(buf);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const html = renderHtml(lines, { timestamp, remoteAddress, byteLength: buf.length });

    const filename = `receipt-${timestamp}.html`;
    const filepath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(filepath, html, 'utf8');
    console.log(`[virtual-printer] Struk di-render: ${filepath}`);

    // Auto-open di browser default (Windows)
    exec(`start "" "${filepath}"`, (err) => {
      if (err) console.log(`[virtual-printer] Gagal auto-open, buka manual: ${filepath}`);
    });
  });

  socket.on('error', (err) => {
    console.error(`[virtual-printer] Socket error:`, err.message);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const nets = require('os').networkInterfaces();
  console.log(`\n=== Virtual Printer Listening di port ${PORT} ===`);
  console.log('IP yang bisa dipakai buat kirim print job ke laptop ini:');
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`  - ${net.address}:${PORT}  (interface: ${name})`);
      }
    }
  }
  console.log('\nTunggu print job masuk... (Ctrl+C buat stop)\n');
});
