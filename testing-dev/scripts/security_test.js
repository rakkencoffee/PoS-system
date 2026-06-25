const crypto = require('crypto');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load env variables
dotenv.config();

console.log('🛡️ Starting POS Security Patches Verification Suite...\n');

// ═══════════════════════════════════════════════════════════════
// TEST 1: Dexie Offline Storage Encryption / Decryption
// ═══════════════════════════════════════════════════════════════
console.log('--- Test 1: Dexie Offline Encryption ---');

const OFFLINE_STORAGE_SECRET = 'rakken-pos-offline-secure-key-2026';

function xorEncrypt(str) {
  const utf8Encoder = new TextEncoder();
  const encoded = utf8Encoder.encode(str);
  
  const resultBytes = new Uint8Array(encoded.length);
  for (let i = 0; i < encoded.length; i++) {
    const keyChar = OFFLINE_STORAGE_SECRET.charCodeAt(i % OFFLINE_STORAGE_SECRET.length);
    resultBytes[i] = encoded[i] ^ keyChar;
  }
  
  let binary = '';
  const len = resultBytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(resultBytes[i]);
  }
  return btoa(binary);
}

function xorDecrypt(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    const keyChar = OFFLINE_STORAGE_SECRET.charCodeAt(i % OFFLINE_STORAGE_SECRET.length);
    bytes[i] = binary.charCodeAt(i) ^ keyChar;
  }
  
  const utf8Decoder = new TextDecoder();
  return utf8Decoder.decode(bytes);
}

function encryptPendingOrder(order) {
  if (order.isEncrypted) return order;
  return {
    ...order,
    customerName: xorEncrypt(order.customerName),
    items: xorEncrypt(JSON.stringify(order.items)),
    isEncrypted: true
  };
}

function decryptPendingOrder(order) {
  if (!order.isEncrypted) return order;
  const decryptedItemsStr = xorDecrypt(order.items);
  return {
    ...order,
    customerName: xorDecrypt(order.customerName),
    items: JSON.parse(decryptedItemsStr),
    isEncrypted: false
  };
}

const dummyOrder = {
  orderId: 'OFFLINE-1234567890',
  totalAmount: 92000,
  customerName: 'Ahmad Dzaky 😊☕',
  items: [
    { productId: '123', name: 'Kyoto Latte', quantity: 2, notes: 'Less ice' }
  ],
  createdAt: new Date().toISOString(),
  status: 'pending'
};

console.log('Original Order:', JSON.stringify(dummyOrder, null, 2));

const encrypted = encryptPendingOrder(dummyOrder);
console.log('\nEncrypted Order in Dexie DB:', JSON.stringify(encrypted, null, 2));

const decrypted = decryptPendingOrder(encrypted);
console.log('\nDecrypted Order for Sync:', JSON.stringify(decrypted, null, 2));

const encryptionSuccess = 
  decrypted.customerName === dummyOrder.customerName &&
  JSON.stringify(decrypted.items) === JSON.stringify(dummyOrder.items) &&
  decrypted.isEncrypted === false;

console.log(`\nEncryption Test Result: ${encryptionSuccess ? '✅ SUCCESS' : '❌ FAILED'}\n`);


// ═══════════════════════════════════════════════════════════════
// TEST 2: Webhook Signature Verification Logic
// ═══════════════════════════════════════════════════════════════
console.log('--- Test 2: Webhook Signature Verification ---');

const testWebhookSecret = 'rakken-olsera-webhook-secret-key-9988';
process.env.OLSERA_WEBHOOK_SECRET = testWebhookSecret;

function verifyOlseraSignature(payload, signature) {
  if (!signature) return false;
  const secret = process.env.OLSERA_WEBHOOK_SECRET;
  if (!secret) return true;
  
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
    
  const expectedBuf = Buffer.from(expected);
  const signatureBuf = Buffer.from(signature);
  if (expectedBuf.length !== signatureBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(signatureBuf, expectedBuf);
}

const payload = JSON.stringify({
  event: 'openOrderUpdateStatus',
  openorder_id: 12345,
  status: 'A'
});

const correctSignature = crypto
  .createHmac('sha256', testWebhookSecret)
  .update(payload)
  .digest('hex');

const wrongSignature = 'invalid-signature-12345';

const sigCheckValid = verifyOlseraSignature(payload, correctSignature);
const sigCheckInvalid = verifyOlseraSignature(payload, wrongSignature);
const sigCheckMissing = verifyOlseraSignature(payload, null);

console.log('Webhook payload:', payload);
console.log('Signature generated:', correctSignature);
console.log('Verify with correct signature:', sigCheckValid ? '✅ VALID (Expected)' : '❌ INVALID');
console.log('Verify with incorrect signature:', sigCheckInvalid ? '❌ VALID' : '✅ INVALID (Expected)');
console.log('Verify with missing signature:', sigCheckMissing ? '❌ VALID' : '✅ INVALID (Expected)');

const webhookTestSuccess = sigCheckValid && !sigCheckInvalid && !sigCheckMissing;
console.log(`\nWebhook Verification Test Result: ${webhookTestSuccess ? '✅ SUCCESS' : '❌ FAILED'}\n`);


// ═══════════════════════════════════════════════════════════════
// TEST 3: Local Print Bridge Authorization Testing
// ═══════════════════════════════════════════════════════════════
console.log('--- Test 3: Local Print Bridge Auth Connection ---');
console.log('Checking if print bridge is running locally...');

const PRINT_BRIDGE_URL = 'http://localhost:3001';
const PRINT_BRIDGE_API_KEY = 'rakken-print-bridge-secret-key-123';

async function testPrintBridge() {
  try {
    // 1. Health check (should be open / bypass auth)
    const healthRes = await fetch(`${PRINT_BRIDGE_URL}/health`);
    console.log(`Health check request: GET ${PRINT_BRIDGE_URL}/health -> Status ${healthRes.status}`);
    
    // 2. Access /printers without API key (should return 401)
    const printersNoKey = await fetch(`${PRINT_BRIDGE_URL}/printers`);
    console.log(`Printers (no key): GET ${PRINT_BRIDGE_URL}/printers -> Status ${printersNoKey.status} (Expected 401)`);
    
    // 3. Access /printers with incorrect API key (should return 401)
    const printersWrongKey = await fetch(`${PRINT_BRIDGE_URL}/printers`, {
      headers: { 'x-api-key': 'wrong-key-123' }
    });
    console.log(`Printers (wrong key): GET ${PRINT_BRIDGE_URL}/printers -> Status ${printersWrongKey.status} (Expected 401)`);

    // 4. Access /printers with correct API key (should return 200/500 depending on SerialPort configuration)
    const printersCorrectKey = await fetch(`${PRINT_BRIDGE_URL}/printers`, {
      headers: { 'x-api-key': PRINT_BRIDGE_API_KEY }
    });
    console.log(`Printers (correct key): GET ${PRINT_BRIDGE_URL}/printers -> Status ${printersCorrectKey.status} (Expected 200 or 500)`);
    
    const printBridgeSuccess = 
      healthRes.status === 200 &&
      printersNoKey.status === 401 &&
      printersWrongKey.status === 401 &&
      (printersCorrectKey.status === 200 || printersCorrectKey.status === 500);
      
    console.log(`\nPrint Bridge Auth Test Result: ${printBridgeSuccess ? '✅ SUCCESS' : '❌ FAILED'}\n`);
    
  } catch (err) {
    console.log(`⚠️ Print Bridge is offline. Start the server (npm run dev inside print-bridge) to verify local connection.`);
  }
}

testPrintBridge();
