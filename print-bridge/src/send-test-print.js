/**
 * Send Test Print — Kirim contoh struk (pakai formatReceipt asli dari format-receipt.js)
 * lewat raw TCP socket ke host:port tujuan. Simulasi apa yang nanti dilakukan server
 * produksi (Vercel) saat kirim print job ke printer WiFi/IP.
 *
 * Jalankan: node src/send-test-print.js <host> [port]
 * Contoh:   node src/send-test-print.js 127.0.0.1 9100
 *           node src/send-test-print.js 192.168.1.42 9100
 */

const net = require('net');
const { formatReceipt } = require('./format-receipt');

const host = process.argv[2];
const port = Number(process.argv[3]) || 9100;

if (!host) {
  console.error('Pakai: node src/send-test-print.js <host> [port]');
  console.error('Contoh: node src/send-test-print.js 127.0.0.1 9100');
  process.exit(1);
}

const sampleReceipt = {
  orderId: 'OLSERA-TEST-001',
  queueNumber: '007',
  customerName: 'Budi Santoso',
  paymentMethod: 'QRIS',
  items: [
    {
      name: 'Rakken Signature Latte',
      quantity: 2,
      price: 28000,
      size: 'Regular',
      notes: 'Iced, Less Sugar, Oat Milk',
    },
    {
      name: 'Croissant Almond',
      quantity: 1,
      price: 25000,
      notes: '',
    },
  ],
  total: 28000 * 2 + 25000,
};

// 48 = lebar 80mm (IW-J300H), cut = true — tes final semua fix bareng
const data = formatReceipt(sampleReceipt, 48, true);

console.log(`Menghubungkan ke ${host}:${port}...`);

const socket = new net.Socket();

socket.connect(port, host, () => {
  console.log('Terhubung. Mengirim data print job...');
  socket.write(data, () => {
    // Kasih jeda sebelum nutup koneksi — printer WiFi murah di link yang lambat
    // (ping bisa >800ms) butuh waktu buat beneran proses & cetak buffer-nya;
    // nutup socket langsung abis write() bisa motong data yang belum sempat dicetak.
    console.log('Data terkirim, tunggu printer selesai proses sebelum tutup koneksi...');
    setTimeout(() => socket.end(), 2000);
  });
});

socket.on('close', () => {
  console.log('Selesai. Cek "printer" tujuan — kalau virtual-printer.js, struknya otomatis kebuka di browser.');
});

socket.on('error', (err) => {
  console.error('Gagal konek:', err.message);
  console.error('Pastikan target (host:port) sudah listening — misal jalanin virtual-printer.js dulu di device tujuan.');
  process.exit(1);
});
