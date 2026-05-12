/**
 * Test different baud rates on COM7 to find the correct one
 * Common baud rates for thermal printers: 9600, 19200, 38400, 57600, 115200
 */
const { SerialPort } = require('serialport');

const PORT = process.argv[2] || 'COM7';
const BAUD_RATES = [9600, 19200, 38400, 57600, 115200];

const ESC = 0x1B;

function makeTestPayload(baudRate) {
  const text = `Baud: ${baudRate}\n`;
  return Buffer.from([
    ESC, 0x40,                    // Init printer
    ESC, 0x61, 0x00,              // Left align
    ESC, 0x45, 0x01,              // Bold ON
    ...Buffer.from(`--- BAUD ${baudRate} ---\n`),
    ESC, 0x45, 0x00,              // Bold OFF
    ...Buffer.from('RAKKEN COFFEE\n'),
    ...Buffer.from('Hello World!\n'),
    ...Buffer.from('1234567890\n'),
    ...Buffer.from(`-------------------\n`),
    ESC, 0x64, 0x03,              // Feed 3 lines
  ]);
}

function tryBaud(baudRate) {
  return new Promise((resolve) => {
    console.log(`\n⏳ Trying ${PORT} at ${baudRate} baud...`);

    const timeout = setTimeout(() => {
      resolve(false);
      console.log(`   ⏱ Timeout`);
    }, 4000);

    const port = new SerialPort({
      path: PORT,
      baudRate: baudRate,
      autoOpen: false,
    });

    port.open((err) => {
      if (err) {
        clearTimeout(timeout);
        console.log(`   ❌ Open failed: ${err.message}`);
        resolve(false);
        return;
      }

      const payload = makeTestPayload(baudRate);
      console.log(`   📤 Sending ${payload.length} bytes...`);

      port.write(payload, (writeErr) => {
        if (writeErr) {
          clearTimeout(timeout);
          console.log(`   ❌ Write failed: ${writeErr.message}`);
          port.close();
          resolve(false);
          return;
        }

        port.drain(() => {
          clearTimeout(timeout);
          console.log(`   ✅ Sent! Check printer for text: "--- BAUD ${baudRate} ---"`);
          setTimeout(() => {
            port.close();
            resolve(true);
          }, 1500);
        });
      });
    });
  });
}

(async () => {
  console.log(`🔬 Testing baud rates on ${PORT}`);
  console.log(`   Watch your printer after each test!`);
  console.log(`   The one that prints READABLE TEXT is the correct baud rate.`);

  for (const baud of BAUD_RATES) {
    await tryBaud(baud);
    // Wait between tests
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n📋 Which baud rate printed readable text?');
  console.log('   Use: PRINTER_PORT=COM7 BAUD_RATE=xxxxx npm start');
})();
