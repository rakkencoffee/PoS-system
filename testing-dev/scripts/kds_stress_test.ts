/**
 * ═══════════════════════════════════════════════════════════════
 * TEST SKENARIO 2: KDS Heavy Load (Stress Test)
 * ═══════════════════════════════════════════════════════════════
 * 
 * Mensimulasikan KDS mem-fetch data ketika ada banyak order aktif.
 * Endpoint /api/orders melakukan parallel fetch ke getOrderDetail()
 * untuk setiap order aktif. Test ini mengukur:
 * - Berapa lama waktu response saat ada N order aktif
 * - Apakah ada request yang timeout atau gagal
 * - Batas wajar kapasitas KDS
 * 
 * ═══════════════════════════════════════════════════════════════
 */

import * as olsera from '../../src/lib/integrations/olsera.service';
import * as dotenv from 'dotenv';
dotenv.config();

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function testKDSHeavyLoad() {
  console.log('═══════════════════════════════════════════════');
  console.log('  TEST: KDS Heavy Load (Stress Test)');
  console.log('═══════════════════════════════════════════════\n');

  // ─── STEP 1: Hitung jumlah open order yang ada ───
  console.log('📊 Mengambil daftar open orders dari Olsera...');
  const startList = Date.now();
  let rawOrders: any[] = [];
  
  try {
    const res = await olsera.olseraFetch('/order/openorder?per_page=50');
    const data = await res.json();
    rawOrders = data.data || data || [];
    if (!Array.isArray(rawOrders)) rawOrders = [];
  } catch (err: any) {
    console.error(`❌ Gagal fetch open orders: ${err.message}`);
    return;
  }
  
  const listDuration = Date.now() - startList;
  console.log(`✅ Ditemukan ${rawOrders.length} open orders (${listDuration}ms)\n`);

  // Filter order yang aktif (belum selesai)
  const activeOrders = rawOrders.filter((o: any) => {
    const s = (o.status || '').toUpperCase();
    return s !== 'Z' && s !== 'T' && s !== 'COMPLETED';
  });
  console.log(`📋 Order aktif (belum selesai): ${activeOrders.length}\n`);

  if (activeOrders.length === 0) {
    console.log('⚠️ Tidak ada order aktif untuk ditest. Buat beberapa order dulu.');
    return;
  }

  // ─── STEP 2: Simulasikan KDS fetch (parallel detail fetching) ───
  console.log('🔥 Simulasi KDS: Fetch detail semua order secara paralel...');
  console.log(`   (Ini mensimulasikan apa yang terjadi setiap 10 detik di KDS)\n`);

  const startDetail = Date.now();
  let successCount = 0;
  let failCount = 0;
  const results: { id: string; status: string; duration: number; itemCount: number }[] = [];

  const detailedOrders = await Promise.all(
    activeOrders.map(async (o: any) => {
      const orderId = o.id || o.order_id;
      const fetchStart = Date.now();
      try {
        const detail = await olsera.getOrderDetail(orderId);
        const dur = Date.now() - fetchStart;
        const items = detail.items || detail.orderitems || [];
        successCount++;
        results.push({ 
          id: String(orderId), 
          status: '✅', 
          duration: dur, 
          itemCount: items.length 
        });
        return detail;
      } catch (err: any) {
        const dur = Date.now() - fetchStart;
        failCount++;
        results.push({ 
          id: String(orderId), 
          status: '❌', 
          duration: dur, 
          itemCount: 0 
        });
        return o; // fallback
      }
    })
  );

  const totalDetailDuration = Date.now() - startDetail;

  // ─── STEP 3: Hasil ───
  console.log('┌───────────────┬────────┬──────────┬───────┐');
  console.log('│   Order ID    │ Status │ Duration │ Items │');
  console.log('├───────────────┼────────┼──────────┼───────┤');
  for (const r of results) {
    const id = r.id.padEnd(13).substring(0, 13);
    const dur = `${r.duration}ms`.padStart(8);
    const items = String(r.itemCount).padStart(5);
    console.log(`│ ${id} │  ${r.status}  │ ${dur} │${items} │`);
  }
  console.log('└───────────────┴────────┴──────────┴───────┘');

  const avgDuration = results.length > 0 
    ? Math.round(results.reduce((a, r) => a + r.duration, 0) / results.length) 
    : 0;
  const maxDuration = results.length > 0 
    ? Math.max(...results.map(r => r.duration)) 
    : 0;

  console.log('\n═══════════════════════════════════════════════');
  console.log('  HASIL ANALISIS:');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Total open orders      : ${rawOrders.length}`);
  console.log(`  Order aktif (KDS)      : ${activeOrders.length}`);
  console.log(`  Berhasil di-fetch      : ${successCount}`);
  console.log(`  Gagal di-fetch         : ${failCount}`);
  console.log(`  Waktu list orders      : ${listDuration}ms`);
  console.log(`  Waktu detail paralel   : ${totalDetailDuration}ms`);
  console.log(`  Rata-rata per order    : ${avgDuration}ms`);
  console.log(`  Terlama               : ${maxDuration}ms`);
  console.log(`  Total waktu KDS refresh: ${listDuration + totalDetailDuration}ms`);
  console.log('');

  const totalRefresh = listDuration + totalDetailDuration;
  if (totalRefresh < 3000) {
    console.log('  🟢 EXCELLENT: KDS refresh < 3 detik. Sangat responsif!');
  } else if (totalRefresh < 5000) {
    console.log('  🟡 ACCEPTABLE: KDS refresh 3-5 detik. Masih oke.');
  } else if (totalRefresh < 10000) {
    console.log('  🟠 WARNING: KDS refresh 5-10 detik. Pertimbangkan caching.');
  } else {
    console.log('  🔴 CRITICAL: KDS refresh > 10 detik. BUTUH optimisasi!');
  }

  if (failCount > 0) {
    const failRate = Math.round((failCount / activeOrders.length) * 100);
    console.log(`  ⚠️ Failure Rate: ${failRate}% — Olsera API mungkin overloaded.`);
  } else {
    console.log('  ✅ Zero failures — Olsera API stabil untuk jumlah order ini.');
  }

  // Estimasi batas
  if (activeOrders.length > 0 && avgDuration > 0) {
    const estimatedMax = Math.floor(10000 / avgDuration); // 10s Vercel timeout
    console.log(`  📈 Estimasi kapasitas maks: ~${estimatedMax} order aktif sebelum timeout Vercel (10s).`);
  }

  console.log('═══════════════════════════════════════════════\n');
}

testKDSHeavyLoad().catch(console.error);
