/**
 * Test Print — Quick test to verify printer connection
 * 
 * Usage: 
 *   node src/test-print.js              (default COM4)
 *   node src/test-print.js COM5         (specify port)
 *   node src/test-print.js --scan       (scan all ports)
 */

const { SerialPort } = require('serialport');
const { formatReceipt } = require('./format-receipt');

const args = process.argv.slice(2);

async function scanPorts() {
  console.log('🔍 Scanning available serial ports...\n');
  const ports = await SerialPort.list();

  if (ports.length === 0) {
    console.log('❌ No serial ports found!');
    console.log('   Make sure Bluetooth is paired or USB is connected.');
    return;
  }

  console.log('Found ports:');
  ports.forEach(p => {
    console.log(`  📌 ${p.path} — ${p.manufacturer || 'Unknown'} ${p.friendlyName || ''}`);
  });
  console.log('');
  console.log('Usage: node src/test-print.js COM4');
}

async function testPrint(portName) {
  console.log(`🖨️  Testing printer on ${portName}...`);
  console.log('');

  return new Promise((resolve, reject) => {
    const port = new SerialPort({
      path: portName,
      baudRate: 9600,
      autoOpen: false,
    });

    port.open((err) => {
      if (err) {
        console.error(`❌ Cannot open ${portName}: ${err.message}`);
        console.log('');
        console.log('Possible issues:');
        console.log('  1. Wrong COM port — run with --scan to see available ports');
        console.log('  2. Printer is off');
        console.log('  3. Bluetooth not paired');
        console.log('  4. Another app is using this port');
        return reject(err);
      }

      console.log(`✅ Port ${portName} opened successfully!`);

      // Create test receipt
      const testData = {
        orderId: 'TEST-001',
        queueNumber: '088',
        customerName: 'Rakken Test',
        items: [
          {
            name: 'Kyoto House Blend',
            quantity: 1,
            price: 28000,
            size: 'Regular',
            notes: 'Less Ice, Normal Sugar',
          },
          {
            name: 'Matcha Berry Latte',
            quantity: 2,
            price: 32000,
            size: 'Large (+6000)',
          },
          {
            name: 'Dirty Matcha',
            quantity: 1,
            price: 35000,
            notes: 'Oat Milk, Extra Shot',
          },
        ],
        total: 127000,
        discount: 0,
        paymentMethod: 'QRIS (Midtrans)',
      };

      const buffer = formatReceipt(testData);

      console.log(`📄 Sending ${buffer.length} bytes to printer...`);

      port.write(buffer, (writeErr) => {
        if (writeErr) {
          console.error(`❌ Write error: ${writeErr.message}`);
          port.close();
          return reject(writeErr);
        }

        port.drain(() => {
          console.log('✅ Test receipt sent successfully!');
          console.log('');
          console.log('🧾 Check your printer — struk should be printing now.');
          console.log('');
          console.log(`If it works, start the Print Bridge with:`);
          console.log(`  PRINTER_PORT=${portName} npm start`);

          setTimeout(() => {
            port.close();
            resolve();
          }, 1000);
        });
      });
    });
  });
}

// Main
(async () => {
  if (args.includes('--scan') || args.includes('-s')) {
    await scanPorts();
  } else {
    const portName = args[0] || 'COM4';
    try {
      await testPrint(portName);
    } catch (e) {
      process.exit(1);
    }
  }
})();
