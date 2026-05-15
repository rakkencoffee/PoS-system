/**
 * RAKKEN Coffee — Print Bridge
 * 
 * Local server yang menerima data receipt dari web POS
 * dan mengirim ESC/POS commands ke thermal printer QPOS EPM58UB (58mm)
 * via Bluetooth Serial (COM port) atau USB.
 * 
 * Usage: npm start
 * Test:  npm run test-print
 */

const express = require('express');
const cors = require('cors');
const net = require('net'); // Added for EDC socket communication
const { formatReceipt, formatDrinkLabels } = require('./format-receipt');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── CONFIGURATION ──────────────────────────────────────────
// Printer Config
const PRINTER_PORT = process.env.PRINTER_PORT || 'COM7';
const BAUD_RATE = parseInt(process.env.BAUD_RATE || '9600');

// EDC Config (Verifone X990)
const EDC_HOST = process.env.EDC_HOST || '192.168.1.100'; // Change to EDC static IP
const EDC_PORT = parseInt(process.env.EDC_PORT || '7000');
const EDC_TIMEOUT = 60000; // 60 seconds for customer to tap/swipe
// ─────────────────────────────────────────────────────────────

app.use(express.json());
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://pos-system-iota-ivory.vercel.app',
  ],
}));

// ─── RAW SERIAL PRINT ───────────────────────────────────────
// Kirim raw bytes ESC/POS ke printer via serial port
const { SerialPort } = require('serialport');

let printerPort = null;
let isPortOpen = false;

async function openPrinter() {
  if (isPortOpen && printerPort && printerPort.isOpen) return printerPort;

  return new Promise(async (resolve, reject) => {
    try {
      const ports = await SerialPort.list();
      const portPaths = ports.map(p => p.path);
      console.log('[Print Bridge] Available ports:', portPaths.join(', ') || 'None');
      
      console.log(`[Print Bridge] Attempting to open printer on ${PRINTER_PORT}...`);

      printerPort = new SerialPort({
        path: PRINTER_PORT,
        baudRate: BAUD_RATE,
        autoOpen: false,
      });

      printerPort.open((err) => {
        if (err) {
          console.error(`❌ Failed to open ${PRINTER_PORT}:`, err.message);
          isPortOpen = false;
          return reject(new Error(`Failed to open ${PRINTER_PORT}: ${err.message}. Available ports: ${portPaths.join(', ') || 'None'}`));
        }
        console.log(`✅ Printer connected on ${PRINTER_PORT}`);
        isPortOpen = true;
        resolve(printerPort);
      });

      printerPort.on('close', () => {
        isPortOpen = false;
        console.log(`⚠️  Printer port ${PRINTER_PORT} closed`);
      });

      printerPort.on('error', (err) => {
        isPortOpen = false;
        console.error(`❌ Printer error:`, err.message);
      });
    } catch (err) {
      reject(err);
    }
  });
}

function writeToPrinter(buffer) {
  return new Promise(async (resolve, reject) => {
    try {
      const port = await openPrinter();
      port.write(buffer, (err) => {
        if (err) {
          console.error('❌ Write error:', err.message);
          return reject(err);
        }
        port.drain((drainErr) => {
          if (drainErr) return reject(drainErr);
          resolve();
        });
      });
    } catch (err) {
      reject(err);
    }
  });
}

// ─── ROUTES ─────────────────────────────────────────────────

/**
 * GET /health — Health check
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    printer: PRINTER_PORT,
    connected: isPortOpen,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /printers — List available serial ports
 */
app.get('/printers', async (req, res) => {
  try {
    const ports = await SerialPort.list();
    res.json({
      available: ports.map(p => ({
        path: p.path,
        manufacturer: p.manufacturer || 'Unknown',
        vendorId: p.vendorId,
        productId: p.productId,
        friendlyName: p.friendlyName || p.path,
      })),
      configured: PRINTER_PORT,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /print — Print receipt
 * Body: { orderId, queueNumber, customerName, items, total, paymentMethod, discount? }
 */
app.post('/print', async (req, res) => {
  try {
    const data = req.body;

    // Validate required fields
    if (!data.orderId || !data.items || data.total === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: orderId, items, total',
      });
    }

    console.log(`🖨️  Printing receipt & labels for order ${data.orderId}...`);

    // Format receipt ke ESC/POS binary commands
    const receiptBuffer = formatReceipt(data);
    const labelsBuffer = formatDrinkLabels(data);
    const finalBuffer = Buffer.concat([receiptBuffer, labelsBuffer]);

    // Kirim ke printer
    await writeToPrinter(finalBuffer);

    console.log(`✅ Receipt printed: ${data.orderId}`);
    res.json({ success: true, orderId: data.orderId });

  } catch (err) {
    console.error('❌ Print failed:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /payment/edc — Initiate payment on EDC terminal
 * Body: { amount, orderId }
 */
app.post('/payment/edc', async (req, res) => {
  const { amount, orderId } = req.body;

  if (!amount) {
    return res.status(400).json({ success: false, error: 'Amount is required' });
  }

  console.log(`💳  Initiating EDC payment for ${orderId}: Rp${amount}...`);

  const client = new net.Socket();
  let responseData = '';

  // Setup timeout
  client.setTimeout(EDC_TIMEOUT);

  client.connect(EDC_PORT, EDC_HOST, () => {
    console.log(`🔗  Connected to EDC at ${EDC_HOST}:${EDC_PORT}`);
    
    /**
     * Common Semi-Integrated Protocol (Placeholder)
     * Format depends on the Acquiring Bank (BCA, Mandiri, etc.)
     * Usually: [STX][Length][Command][Amount][LRC][ETX]
     */
    const payload = JSON.stringify({
      command: 'SALE',
      amount: amount,
      order_id: orderId
    });
    
    client.write(payload);
  });

  client.on('data', (data) => {
    responseData += data.toString();
    console.log(`📥  EDC Data received: ${data.toString()}`);
    
    // Check if we have a full response (usually ends with specific byte or newline)
    if (responseData.includes('}')) {
      try {
        const result = JSON.parse(responseData);
        client.destroy();
        
        if (result.status === 'APPROVED' || result.response_code === '00') {
          res.json({ 
            success: true, 
            approvalCode: result.approval_code || 'MOCKED',
            cardNo: result.card_no || '****',
            refNo: result.ref_no || orderId
          });
        } else {
          res.status(400).json({ 
            success: false, 
            error: result.message || 'Transaction Declined' 
          });
        }
      } catch (e) {
        // Not JSON? Handle as raw protocol if needed
        console.log('Received non-JSON EDC data');
      }
    }
  });

  client.on('timeout', () => {
    console.log('⌛  EDC Timeout');
    client.destroy();
    res.status(408).json({ success: false, error: 'Payment timed out on EDC terminal' });
  });

  client.on('error', (err) => {
    console.error('❌  EDC Connection error:', err.message);
    res.status(500).json({ 
      success: false, 
      error: `Could not connect to EDC terminal at ${EDC_HOST}:${EDC_PORT}. Make sure IP is correct.` 
    });
  });
});

/**
 * POST /test — Test print (simple text)
 */
app.post('/test', async (req, res) => {
  try {
    const testData = {
      orderId: 'TEST-001',
      queueNumber: '001',
      customerName: 'Test Customer',
      items: [
        { name: 'Kyoto House Blend', quantity: 1, price: 28000, size: 'Regular', notes: 'Less Ice, Normal Sugar' },
        { name: 'Matcha Berry Latte', quantity: 2, price: 32000, size: 'Large (+6000)' },
      ],
      total: 92000,
      discount: 0,
      paymentMethod: 'QRIS',
    };

    const buffer = formatReceipt(testData);
    await writeToPrinter(buffer);

    console.log('✅ Test print success!');
    res.json({ success: true, message: 'Test receipt printed!' });

  } catch (err) {
    console.error('❌ Test print failed:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── START SERVER ───────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║   🖨️  RAKKEN Coffee — Print Bridge        ║');
  console.log('╠═══════════════════════════════════════════╣');
  console.log(`║   Server:  http://localhost:${PORT}          ║`);
  console.log(`║   Printer: ${PRINTER_PORT.padEnd(30)}║`);
  console.log(`║   Baud:    ${String(BAUD_RATE).padEnd(30)}║`);
  console.log('╚═══════════════════════════════════════════╝');
  console.log('');
  console.log('Endpoints:');
  console.log(`  GET  http://localhost:${PORT}/health   — Status`);
  console.log(`  GET  http://localhost:${PORT}/printers — List ports`);
  console.log(`  POST http://localhost:${PORT}/print    — Print receipt`);
  console.log(`  POST http://localhost:${PORT}/test     — Test print`);
  console.log('');

  // Auto-try connect to printer on startup
  openPrinter().catch(() => {
    console.log(`⚠️  Printer not connected yet. Will retry on first print.`);
    console.log(`   Make sure ${PRINTER_PORT} is correct. Run: GET /printers to see available ports.`);
  });
});
