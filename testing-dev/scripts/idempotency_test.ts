/**
 * ═══════════════════════════════════════════════════════════════
 * TEST SKENARIO 1: Double Webhook (Idempotency Test)
 * ═══════════════════════════════════════════════════════════════
 * 
 * Mensimulasikan Midtrans mengirim webhook pembayaran sukses
 * DUA KALI untuk order yang sama, untuk memastikan:
 * - Settlement Olsera TIDAK terjadi dua kali
 * - Pusher broadcast TIDAK mengirim pesanan duplikat ke KDS
 * - Database lokal TIDAK error karena duplikasi
 * 
 * ═══════════════════════════════════════════════════════════════
 */

import { updateOrderPaymentStatus } from '../../src/lib/integrations/pos.adapter';
import * as dotenv from 'dotenv';
dotenv.config();

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function testDoubleWebhook() {
  console.log('═══════════════════════════════════════════════');
  console.log('  TEST: Double Webhook (Idempotency)');
  console.log('═══════════════════════════════════════════════\n');

  // Kita pakai order OLSERA yang sudah dibuat dari test sebelumnya
  // (atau order yang sudah ada di sistem)
  // Pertama, buat order baru dulu agar kita punya ID yang valid
  const { createOrder } = await import('../../src/lib/integrations/pos.adapter');
  
  const testItem = {
    productId: '112514750',
    quantity: 1,
    price: 1,
    name: 'Test Idempotency Item'
  };

  console.log('📦 Membuat order baru untuk test...');
  let orderId: string;
  try {
    const res = await createOrder([testItem], 'Idempotency Test');
    orderId = res.orderId;
    console.log(`✅ Order dibuat: ${orderId}\n`);
  } catch (err) {
    // Fallback jika Olsera gagal
    orderId = `SF-IDEM-${Date.now()}`;
    console.log(`⚠️ Olsera gagal, menggunakan ID lokal: ${orderId}\n`);
  }

  const paymentAmount = 1;

  // ─── WEBHOOK KE-1 (Normal) ───
  console.log('🔔 WEBHOOK KE-1: Mengirim notifikasi pembayaran sukses...');
  const start1 = Date.now();
  try {
    await updateOrderPaymentStatus(orderId, 'paid', paymentAmount);
    console.log(`✅ Webhook 1 selesai dalam ${Date.now() - start1}ms`);
    console.log('   → Settlement diproses\n');
  } catch (err: any) {
    console.error(`❌ Webhook 1 GAGAL: ${err.message}\n`);
  }

  await delay(2000); // Jeda 2 detik (simulasi network delay Midtrans)

  // ─── WEBHOOK KE-2 (Duplikat) ───
  console.log('🔔 WEBHOOK KE-2 (DUPLIKAT): Mengirim notifikasi yang sama...');
  const start2 = Date.now();
  try {
    await updateOrderPaymentStatus(orderId, 'paid', paymentAmount);
    console.log(`✅ Webhook 2 selesai dalam ${Date.now() - start2}ms`);
    console.log('   → Harus ter-skip karena sudah dibayar\n');
  } catch (err: any) {
    console.error(`❌ Webhook 2 GAGAL: ${err.message}\n`);
  }

  // ─── WEBHOOK KE-3 (Triple — stress test idempotency) ───
  console.log('🔔 WEBHOOK KE-3 (TRIPLE): Mengirim notifikasi ketiga...');
  const start3 = Date.now();
  try {
    await updateOrderPaymentStatus(orderId, 'paid', paymentAmount);
    console.log(`✅ Webhook 3 selesai dalam ${Date.now() - start3}ms`);
    console.log('   → Harus ter-skip lagi\n');
  } catch (err: any) {
    console.error(`❌ Webhook 3 GAGAL: ${err.message}\n`);
  }

  console.log('═══════════════════════════════════════════════');
  console.log('  HASIL ANALISIS:');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Order ID    : ${orderId}`);
  console.log(`  Webhook 1   : Diproses (settlement + KDS broadcast)`);
  console.log(`  Webhook 2-3 : Harus di-SKIP oleh guard "is_paid"`);
  console.log('');
  console.log('  Cek log di atas:');
  console.log('  → Jika ada "already marked as PAID" = ✅ IDEMPOTEN');
  console.log('  → Jika settlement dijalankan 2-3x = ❌ ADA BUG');
  console.log('═══════════════════════════════════════════════\n');
}

testDoubleWebhook().catch(console.error);
