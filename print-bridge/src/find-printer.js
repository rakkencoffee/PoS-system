/**
 * Brute-force test all COM ports to find the printer
 * Sends a simple text to each port and reports which ones work
 */
const { SerialPort } = require('serialport');

const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;

// Simple test: init printer + print text + feed
const testPayload = Buffer.from([
  ESC, 0x40,           // Init
  ESC, 0x61, 0x01,     // Center align
  ...Buffer.from('=== PRINTER TEST ===\n'),
  ...Buffer.from('RAKKEN COFFEE\n'),
  ...Buffer.from('If you see this,\n'),
  ...Buffer.from('printer is working!\n'),
  ...Buffer.from('===================\n'),
  ESC, 0x64, 0x05,     // Feed 5 lines
]);

async function tryPort(portName) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({ port: portName, status: 'TIMEOUT' });
    }, 5000);

    try {
      const port = new SerialPort({
        path: portName,
        baudRate: 9600,
        autoOpen: false,
      });

      port.open((err) => {
        if (err) {
          clearTimeout(timeout);
          resolve({ port: portName, status: `FAIL: ${err.message}` });
          return;
        }

        port.write(testPayload, (writeErr) => {
          if (writeErr) {
            clearTimeout(timeout);
            port.close();
            resolve({ port: portName, status: `WRITE_FAIL: ${writeErr.message}` });
            return;
          }

          port.drain(() => {
            clearTimeout(timeout);
            setTimeout(() => port.close(), 500);
            resolve({ port: portName, status: 'SENT_OK ✅' });
          });
        });
      });
    } catch (e) {
      clearTimeout(timeout);
      resolve({ port: portName, status: `ERROR: ${e.message}` });
    }
  });
}

(async () => {
  console.log('🔍 Testing ALL COM ports (COM3-COM8)...');
  console.log('   Watch your printer — if text comes out, that port is correct!\n');

  const ports = ['COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8'];

  for (const p of ports) {
    const result = await tryPort(p);
    const icon = result.status.includes('SENT_OK') ? '✅' : '❌';
    console.log(`  ${icon} ${result.port}: ${result.status}`);
  }

  console.log('\n📋 If ANY port printed text, use that port number:');
  console.log('   PRINTER_PORT=COMx npm start');
})();
