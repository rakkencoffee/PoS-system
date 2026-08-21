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

// Load environment variables
const fs = require('fs');
const path = require('path');

let envPath = path.join(__dirname, '../.env');
if (!fs.existsSync(envPath)) {
  envPath = path.join(__dirname, '../../.env');
}
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

const PORT = process.env.PORT || 3001;

// ─── CONFIGURATION ──────────────────────────────────────────
// Printer Config
const PRINTER_PORT = process.env.PRINTER_PORT || 'COM7';
const BAUD_RATE = parseInt(process.env.BAUD_RATE || '9600');

// Print output mode: 'serial' (default, Bluetooth QPOS produksi) atau 'tcp'
// (raw network printing — dipakai buat validasi virtual-printer/printer WiFi baru)
const PRINT_MODE = (process.env.PRINT_MODE || 'serial').toLowerCase();
const PRINTER_TCP_HOST = process.env.PRINTER_TCP_HOST || '';
const PRINTER_TCP_PORT = parseInt(process.env.PRINTER_TCP_PORT || '9100');

// Routing per-station (multi tablet, tiap tablet punya printer sendiri).
// Format .env: STATION_MAP={"A":{"mode":"serial"},"B":{"mode":"tcp","host":"192.168.1.102","port":9100}}
// Catatan: cuma ada 1 koneksi serial (Bluetooth) yang didukung sekaligus — kalau
// beberapa station butuh serial secara bersamaan, itu butuh refactor lebih lanjut.
// Station yang gak ada di map (atau STATION_MAP gak di-set) fallback ke config global di atas.
let STATION_MAP = {};
if (process.env.STATION_MAP) {
  try {
    STATION_MAP = JSON.parse(process.env.STATION_MAP);
  } catch (err) {
    console.warn('[Print Bridge] STATION_MAP bukan JSON valid, diabaikan:', err.message);
  }
}

function resolvePrinterConfig(station) {
  if (station && STATION_MAP[station]) return STATION_MAP[station];
  return PRINT_MODE === 'tcp'
    ? { mode: 'tcp', host: PRINTER_TCP_HOST, port: PRINTER_TCP_PORT }
    : { mode: 'serial' };
}

// EDC Config (Verifone X990)
const EDC_HOST = process.env.EDC_HOST || '192.168.1.100'; // Change to EDC static IP
const EDC_PORT = parseInt(process.env.EDC_PORT || '7000');
const EDC_TIMEOUT = 60000; // 60 seconds for customer to tap/swipe
// ─────────────────────────────────────────────────────────────

const PRINT_BRIDGE_API_KEY = process.env.NEXT_PUBLIC_PRINT_BRIDGE_API_KEY || 'rakken-print-bridge-secret-key-123';

app.use(express.json());
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://pos-system-iota-ivory.vercel.app',
    'https://menu.rakkencoffee.com',
  ],
}));

// Auth Middleware
function authMiddleware(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query?.apiKey;
  if (!apiKey || apiKey !== PRINT_BRIDGE_API_KEY) {
    console.warn(`[Unauthorized Access] [${new Date().toISOString()}] Access denied for URL: ${req.url}. Key: ${apiKey}`);
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing API key' });
  }
  next();
}

// ─── RAW SERIAL PRINT ───────────────────────────────────────
// Kirim raw bytes ESC/POS ke printer via serial port
const { SerialPort } = require('serialport');

let printerPort = null;
let isPortOpen = false;
let reconnectTimer = null;
const RECONNECT_INTERVAL = 5000; // Retry every 5 seconds

async function openPrinter() {
  if (isPortOpen && printerPort && printerPort.isOpen) return printerPort;

  return new Promise(async (resolve, reject) => {
    try {
      const ports = await SerialPort.list();
      const portPaths = ports.map(p => p.path);
      console.log('[Print Bridge] Available ports:', portPaths.join(', ') || 'None');
      
      if (!portPaths.includes(PRINTER_PORT)) {
        return reject(new Error(`Port ${PRINTER_PORT} not found. Available: ${portPaths.join(', ') || 'None'}. Bluetooth may not be ready yet.`));
      }

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
          printerPort = null;
          return reject(new Error(`Failed to open ${PRINTER_PORT}: ${err.message}`));
        }
        console.log(`✅ Printer connected on ${PRINTER_PORT}`);
        isPortOpen = true;
        // Stop reconnect loop once connected
        stopReconnectLoop();
        resolve(printerPort);
      });

      printerPort.on('close', () => {
        isPortOpen = false;
        printerPort = null;
        console.log(`⚠️  Printer port ${PRINTER_PORT} closed. Will auto-reconnect...`);
        startReconnectLoop();
      });

      printerPort.on('error', (err) => {
        isPortOpen = false;
        printerPort = null;
        console.error(`❌ Printer error:`, err.message);
        startReconnectLoop();
      });
    } catch (err) {
      reject(err);
    }
  });
}

function startReconnectLoop() {
  if (reconnectTimer) return; // Already running
  console.log(`🔄 Auto-reconnect started (every ${RECONNECT_INTERVAL / 1000}s)...`);
  reconnectTimer = setInterval(async () => {
    if (isPortOpen && printerPort && printerPort.isOpen) {
      stopReconnectLoop();
      return;
    }
    try {
      await openPrinter();
      console.log(`🔄 ✅ Reconnected to printer successfully!`);
    } catch (err) {
      // Silently retry — only log short message
      console.log(`🔄 ⏳ Printer not ready yet (${err.message.split('.')[0]}). Retrying...`);
    }
  }, RECONNECT_INTERVAL);
}

function stopReconnectLoop() {
  if (reconnectTimer) {
    clearInterval(reconnectTimer);
    reconnectTimer = null;
    console.log(`🔄 Auto-reconnect stopped (printer is connected).`);
  }
}

function writeToPrinterSerial(buffer) {
  return new Promise(async (resolve, reject) => {
    const timeout = setTimeout(() => {
      console.error('❌ Printer write/drain timeout (10 seconds) reached.');
      reject(new Error('Printer write/drain timeout (10 seconds)'));
    }, 10000);

    try {
      const port = await openPrinter();
      port.write(buffer, (err) => {
        if (err) {
          clearTimeout(timeout);
          console.error('❌ Write error:', err.message);
          return reject(err);
        }
        port.drain((drainErr) => {
          clearTimeout(timeout);
          if (drainErr) return reject(drainErr);
          resolve();
        });
      });
    } catch (err) {
      clearTimeout(timeout);
      reject(err);
    }
  });
}

// Kirim raw bytes langsung ke IP:port (raw network printing / virtual-printer test)
function writeToPrinterTCP(buffer, host = PRINTER_TCP_HOST, port = PRINTER_TCP_PORT) {
  return new Promise((resolve, reject) => {
    if (!host) {
      return reject(new Error('Mode tcp tapi host tujuan belum di-set (PRINTER_TCP_HOST atau STATION_MAP)'));
    }

    const socket = new net.Socket();
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error(`TCP print timeout (10 detik) ke ${host}:${port}`));
    }, 10000);

    socket.connect(port, host, () => {
      socket.write(buffer, () => socket.end());
    });

    socket.on('close', () => {
      clearTimeout(timeout);
      resolve();
    });

    socket.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

function writeToPrinter(buffer, station) {
  const config = resolvePrinterConfig(station);
  if (config.mode === 'tcp') {
    return writeToPrinterTCP(buffer, config.host, config.port || 9100);
  }
  return writeToPrinterSerial(buffer);
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
    reconnecting: reconnectTimer !== null,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /printers — List available serial ports
 */
app.get('/printers', authMiddleware, async (req, res) => {
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
app.post('/print', authMiddleware, async (req, res) => {
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

    // Kirim ke printer (routing per-station kalau di-body-nya ada `station`)
    await writeToPrinter(finalBuffer, data.station);

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
app.post('/payment/edc', authMiddleware, async (req, res) => {
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
app.post('/test', authMiddleware, async (req, res) => {
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

// ─── CLOUD PRINT DAEMON ─────────────────────────────────────
const CLOUD_API_URL = process.env.CLOUD_API_URL || '';
const CLOUD_POLLING_INTERVAL = parseInt(process.env.CLOUD_POLLING_INTERVAL || '3000');

// Helper for fetch with abort timeout
async function fetchWithTimeout(url, options = {}) {
  const { timeout = 8000 } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

let isPolling = false;

async function pollCloudPrintJobs() {
  if (isPolling) return;
  isPolling = true;

  try {
    const url = `${CLOUD_API_URL}/api/print-jobs?status=PENDING&limit=5`;
    const res = await fetchWithTimeout(url, {
      headers: {
        'x-api-key': PRINT_BRIDGE_API_KEY
      }
    });

    if (!res.ok) {
      if (res.status === 401) {
        console.error(`[Daemon] ❌ Unauthorized polling. Check process.env.NEXT_PUBLIC_PRINT_BRIDGE_API_KEY`);
      } else {
        console.warn(`[Daemon] ⚠️ Failed to fetch print jobs (Status ${res.status})`);
      }
      isPolling = false;
      return;
    }

    const { jobs } = await res.json();
    if (jobs && jobs.length > 0) {
      console.log(`[Daemon] 📥 Found ${jobs.length} pending print jobs...`);

      for (const job of jobs) {
        try {
          console.log(`[Daemon] Processing job ${job.id} for order ${job.orderId}...`);
          
          // Mark job status as PRINTING in the cloud
          await fetchWithTimeout(`${CLOUD_API_URL}/api/print-jobs/${job.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': PRINT_BRIDGE_API_KEY
            },
            body: JSON.stringify({ status: 'PRINTING' })
          });

          // Print logic
          const data = job.payload;
          if (!data.orderId || !data.items || data.total === undefined) {
            throw new Error('Invalid print job payload format: missing orderId, items, total');
          }

          // Format receipt & labels
          const receiptBuffer = formatReceipt(data);
          const labelsBuffer = formatDrinkLabels(data);
          const finalBuffer = Buffer.concat([receiptBuffer, labelsBuffer]);

          // Write to printer (routing per-station kalau ada)
          await writeToPrinter(finalBuffer, job.station);

          console.log(`[Daemon] ✅ Successfully printed job ${job.id}${job.station ? ` (station ${job.station})` : ''}`);

          // Update status in the cloud
          await fetchWithTimeout(`${CLOUD_API_URL}/api/print-jobs/${job.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': PRINT_BRIDGE_API_KEY
            },
            body: JSON.stringify({ status: 'PRINTED' })
          });

        } catch (err) {
          console.error(`[Daemon] ❌ Print job ${job.id} failed:`, err.message);
          
          // Update status to FAILED in the cloud
          await fetchWithTimeout(`${CLOUD_API_URL}/api/print-jobs/${job.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': PRINT_BRIDGE_API_KEY
            },
            body: JSON.stringify({ 
              status: 'FAILED',
              errorMessage: err.message
            })
          }).catch((e) => console.error('[Daemon] Failed to update error status:', e.message));
        }
      }
    }
  } catch (err) {
    console.error(`[Daemon] ⚠️ Polling connection error:`, err.message);
  } finally {
    isPolling = false;
  }
}

// ─── START SERVER ───────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║   🖨️  RAKKEN Coffee — Print Bridge        ║');
  console.log('╠═══════════════════════════════════════════╣');
  console.log(`║   Server:  http://localhost:${PORT}          ║`);
  if (PRINT_MODE === 'tcp') {
    console.log(`║   Mode:    TCP (raw network print)          ║`);
    console.log(`║   Target:  ${`${PRINTER_TCP_HOST}:${PRINTER_TCP_PORT}`.padEnd(30)}║`);
  } else {
    console.log(`║   Mode:    Serial (Bluetooth)               ║`);
    console.log(`║   Printer: ${PRINTER_PORT.padEnd(30)}║`);
    console.log(`║   Baud:    ${String(BAUD_RATE).padEnd(30)}║`);
  }
  console.log('╚═══════════════════════════════════════════╝');
  if (Object.keys(STATION_MAP).length > 0) {
    console.log('Station routing (STATION_MAP):');
    for (const [station, config] of Object.entries(STATION_MAP)) {
      const target = config.mode === 'tcp' ? `${config.host}:${config.port || 9100}` : 'Serial (Bluetooth)';
      console.log(`  Station ${station} -> ${config.mode} (${target})`);
    }
  }
  console.log('');
  console.log('Endpoints:');
  console.log(`  GET  http://localhost:${PORT}/health   — Status`);
  console.log(`  GET  http://localhost:${PORT}/printers — List ports`);
  console.log(`  POST http://localhost:${PORT}/print    — Print receipt`);
  console.log(`  POST http://localhost:${PORT}/test     — Test print`);
  console.log('');

  // Start polling if CLOUD_API_URL is configured. This stays on as the
  // safety net even with Pusher below — if the push event never arrives
  // (daemon reconnecting, Pusher hiccup), the job still gets picked up
  // within one poll interval instead of sitting forever.
  if (CLOUD_API_URL) {
    console.log(`[Daemon] 🔄 Starting print queue poller pointing to ${CLOUD_API_URL} every ${CLOUD_POLLING_INTERVAL}ms`);
    setInterval(pollCloudPrintJobs, CLOUD_POLLING_INTERVAL);
  } else {
    console.log('[Daemon] ⚠️ CLOUD_API_URL not configured. Running in local-only mode.');
  }

  // Instant push notification for new print jobs, on top of the polling
  // above — cuts the usual "wait up to one poll interval" delay down to
  // near-zero. Non-fatal if it can't connect; polling alone still works.
  const PUSHER_KEY = process.env.PUSHER_KEY;
  const PUSHER_CLUSTER = process.env.PUSHER_CLUSTER;
  if (CLOUD_API_URL && PUSHER_KEY && PUSHER_CLUSTER) {
    try {
      const Pusher = require('pusher-js');
      const pusher = new Pusher(PUSHER_KEY, { cluster: PUSHER_CLUSTER });
      const channel = pusher.subscribe('print-queue');
      channel.bind('NEW_JOB', (data) => {
        console.log(`[Daemon] ⚡ Instant notify for job ${data?.jobId || '?'} — checking queue now`);
        pollCloudPrintJobs();
      });
      pusher.connection.bind('error', (err) => {
        console.warn('[Daemon] ⚠️ Pusher connection error (polling still active):', err?.error?.data?.message || err);
      });
      console.log('[Daemon] ⚡ Instant print notifications enabled via Pusher');
    } catch (pusherSetupErr) {
      console.warn('[Daemon] ⚠️ Could not enable instant notifications, falling back to polling only:', pusherSetupErr.message);
    }
  }

  // Auto-try connect to printer on startup — skip kalau gak ada satupun station/config
  // yang butuh serial (semua tcp berarti gak ada perlunya buka COM port sama sekali)
  const anyStationUsesSerial = Object.values(STATION_MAP).some(c => c.mode === 'serial');
  const needsSerial = PRINT_MODE !== 'tcp' || anyStationUsesSerial;
  if (needsSerial) {
    openPrinter().catch(() => {
      console.log(`⚠️  Printer not connected yet. Starting auto-reconnect loop...`);
      console.log(`   (Bluetooth may still be initializing. Will keep trying every ${RECONNECT_INTERVAL / 1000}s)`);
      startReconnectLoop();
    });
  }
});
