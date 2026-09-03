/**
 * ═══════════════════════════════════════════════════════════════
 * TEST: olsera.service.createCustomer() — belum pernah dites berdiri
 * sendiri terhadap akun Olsera production RAKKEN yang asli.
 * ═══════════════════════════════════════════════════════════════
 *
 * PERINGATAN: script ini menulis 1 customer BENERAN ke akun Olsera
 * production kamu kalau berhasil. Nomor HP & nama sengaja dibuat jelas
 * "TEST" biar gampang dicari & dihapus manual lewat Olsera Dashboard
 * setelah selesai verifikasi.
 *
 * Cara jalanin: npx tsx testing-dev/scripts/test_create_customer.ts
 */

import { findCustomerByPhone, createCustomer } from '../../src/lib/integrations/olsera.service';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const TEST_NAME = 'TEST CLAUDE ONBOARDING';
const TEST_PHONE = '089900000001'; // sengaja nomor gak lazim biar gampang dikenali & dihapus

async function run() {
  console.log('═══════════════════════════════════════════════');
  console.log('  TEST: createCustomer() — search-or-create flow');
  console.log('═══════════════════════════════════════════════\n');

  console.log(`🔍 Step 1: findCustomerByPhone("${TEST_PHONE}")...`);
  const existing = await findCustomerByPhone(TEST_PHONE);
  if (existing) {
    console.log(`✅ Customer sudah ada dari test sebelumnya: id=${existing.id}, name=${existing.name}`);
    console.log('   (Onboarding endpoint akan LINK ke sini, bukan create baru — ini juga valid.)\n');
    return;
  }
  console.log('   Tidak ditemukan — lanjut ke createCustomer()\n');

  console.log(`📝 Step 2: createCustomer("${TEST_NAME}", "${TEST_PHONE}")...`);
  try {
    const created = await createCustomer(TEST_NAME, TEST_PHONE);
    console.log(`✅ BERHASIL: id=${created.id}, name=${created.name}, phone=${created.phone}\n`);

    console.log('🔍 Step 3: verifikasi — findCustomerByPhone() harus nemu yang barusan dibuat...');
    const verify = await findCustomerByPhone(TEST_PHONE);
    if (verify && String(verify.id) === String(created.id)) {
      console.log(`✅ TERVERIFIKASI: customer baru kebaca balik dengan benar.\n`);
    } else {
      console.log(`⚠️  Customer dibuat tapi findCustomerByPhone() gak nemu balik (cek manual di Olsera Dashboard).\n`);
    }

    console.log('═══════════════════════════════════════════════');
    console.log(`  HAPUS MANUAL customer "${TEST_NAME}" (id ${created.id}) dari`);
    console.log('  Olsera Dashboard setelah ini kalau gak mau jadi sampah data.');
    console.log('═══════════════════════════════════════════════\n');
  } catch (err: any) {
    console.error(`❌ GAGAL: ${err.message}\n`);
    console.error('Detail error di atas — kemungkinan field yang dikirim createCustomer() gak sesuai yang Olsera harapkan.');
  }
}

run().catch(console.error);
