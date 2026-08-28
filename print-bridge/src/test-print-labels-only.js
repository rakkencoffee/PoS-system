/**
 * Test Print LABELS ONLY — kirim cuma label minuman (formatDrinkLabels),
 * TANPA struk (formatReceipt), buat tes cepat tampilan label doang.
 * Print 2 kasus: catatan dikit vs catatan banyak, buat bandingin panjang
 * hasil print (harusnya sama sekarang berkat fixed 3-baris notes).
 *
 * Jalankan: node src/test-print-labels-only.js COM4
 */
const { SerialPort } = require('serialport');
const { formatDrinkLabels } = require('./format-receipt');

const portName = process.argv[2] || 'COM4';

const shortData = {
  orderId: 'OLSERA-TEST-002',
  queueNumber: '088',
  customerName: 'Budi Santoso',
  orderType: 'DINE_IN',
  items: [
    {
      name: 'Dirty Matcha',
      quantity: 1,
      price: 35000,
      size: 'Large',
      notes: 'Less Ice, Extra Shot, Oat Milk, No Sugar, Whip Cream',
    },
  ],
};

(async () => {
  const buf = await formatDrinkLabels(shortData);

  console.log(`Mengirim ${buf.length} byte (1 label) ke ${portName}...`);

  const port = new SerialPort({ path: portName, baudRate: 9600, autoOpen: false });

  port.open((err) => {
    if (err) {
      console.error(`Gagal buka ${portName}: ${err.message}`);
      process.exit(1);
    }
    console.log(`Port ${portName} terbuka.`);
    port.write(buf, (writeErr) => {
      if (writeErr) {
        console.error(`Write error: ${writeErr.message}`);
        port.close();
        process.exit(1);
      }
      port.drain(() => {
        console.log('Berhasil terkirim (drain selesai).');
        setTimeout(() => { port.close(); process.exit(0); }, 500);
      });
    });
  });
})();
