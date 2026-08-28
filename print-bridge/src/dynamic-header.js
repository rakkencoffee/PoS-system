/**
 * Dynamic Header — generate 1 gambar raster gabungan (logo kiri + nomor
 * antrian kanan) buat label stiker, karena command ESC/POS printer ini gak
 * bisa naruh gambar & teks di baris yang sama secara terpisah — satu-satunya
 * cara ngedapetin "logo pojok kiri, nomor pojok kanan" adalah gabungin
 * keduanya jadi 1 bitmap sebelum dikirim ke printer.
 *
 * BEDA dari logo/tagline statis (rakken-logo.js) — ini di-generate ULANG
 * tiap kali dipanggil karena nomor antrian beda tiap order.
 */
const path = require('path');
const sharp = require('sharp');

const LOGO_SOURCE = path.join(__dirname, '..', 'assets', 'rakken-logo-source.png');
// Bounding box logo asli di kanvas 8000x4500 (lihat rakken-logo.js untuk konteks)
const LOGO_CROP = { left: 726, top: 1748, width: 6548, height: 1004 };

const CANVAS_WIDTH = 384; // 58mm penuh, dot (lebar kertas, gak bisa diubah)
const CANVAS_HEIGHT = 48;
const LOGO_WIDTH = 160;
const LOGO_HEIGHT = Math.round(LOGO_WIDTH * (LOGO_CROP.height / LOGO_CROP.width));
const LEFT_MARGIN = 8; // jarak logo dari tepi kiri
const RIGHT_MARGIN = 8; // jarak nomor dari tepi kanan
const NUMBER_FONT_SIZE = 30;

/**
 * Generate bitmap header gabungan (logo kiri + `#queueNum` kanan) sebagai
 * raster 1-bit siap pakai buat logoRasterCommand().
 * @param {string} queueNum
 * @returns {Promise<{width: number, height: number, data: Buffer}>}
 */
async function buildHeaderRaster(queueNum) {
  // Logo asli putih-di-atas-transparan -> ubah jadi hitam-di-atas-transparan
  // (biar keliatan pas ditempel ke kanvas putih)
  const { data: logoRgba, info } = await sharp(LOGO_SOURCE)
    .extract(LOGO_CROP)
    .resize(LOGO_WIDTH, LOGO_HEIGHT, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const blackLogo = Buffer.alloc(info.width * info.height * 4);
  for (let p = 0; p < info.width * info.height; p++) {
    blackLogo[p * 4 + 3] = logoRgba[p * 4 + 3]; // alpha doang, RGB tetap 0 (hitam)
  }
  const logoPngBuf = await sharp(blackLogo, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();

  const svgText = `
    <svg width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <text x="${CANVAS_WIDTH - RIGHT_MARGIN}" y="${CANVAS_HEIGHT / 2}" font-size="${NUMBER_FONT_SIZE}" font-weight="bold"
            font-family="Arial, sans-serif" fill="black" text-anchor="end" dominant-baseline="central">#${queueNum}</text>
    </svg>
  `;

  const { data: rgba } = await sharp({
    create: {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([
      { input: logoPngBuf, left: LEFT_MARGIN, top: Math.round((CANVAS_HEIGHT - LOGO_HEIGHT) / 2) },
      { input: Buffer.from(svgText), left: 0, top: 0 },
    ])
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Threshold jadi 1-bit ESC/POS raster (sama pola kayak rakken-logo.js)
  const bytesPerRow = CANVAS_WIDTH / 8;
  const out = Buffer.alloc(bytesPerRow * CANVAS_HEIGHT, 0);
  for (let y = 0; y < CANVAS_HEIGHT; y++) {
    for (let x = 0; x < CANVAS_WIDTH; x++) {
      const gray = rgba[y * CANVAS_WIDTH + x];
      if (gray < 128) {
        const byteIndex = y * bytesPerRow + (x >> 3);
        const bit = 7 - (x % 8);
        out[byteIndex] |= (1 << bit);
      }
    }
  }

  return { width: CANVAS_WIDTH, height: CANVAS_HEIGHT, data: out };
}

module.exports = { buildHeaderRaster };
