
import { createOrder } from '../src/lib/integrations/pos.adapter';
import * as dotenv from 'dotenv';
dotenv.config();

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function runTest() {
  const testItem = {
    productId: '112514750', 
    quantity: 1,
    price: 1,
    name: 'Produk 2'
  };

  const simulateOrder = async (name: string) => {
    const localId = `SF-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    let finalId = '';
    try {
      const res = await createOrder([testItem], name);
      finalId = res.orderId;
      console.log(`✅ ${name} created: ${finalId}`);
    } catch (err) {
      console.warn(`⚠️ ${name} Olsera failed (Fallback): using ${localId}`);
      finalId = localId;
    }
    return finalId;
  };

  try {
    // --- SCENARIO 1: SIMULTANEOUS (0ms interval) ---
    console.log('\n🔥 SCENARIO 1: 3 Orders at the same millisecond...');
    const start1 = Date.now();
    const results1 = await Promise.all([
      simulateOrder('Simul-Tablet 1'),
      simulateOrder('Simul-Tablet 2'),
      simulateOrder('Simul-Tablet 3')
    ]);
    console.log(`⏱️ Scenario 1 Duration: ${(Date.now() - start1) / 1000}s`);

    console.log('\n😴 Cooling down for 5s...');
    await delay(5000);

    // --- SCENARIO 2: SPACED (5s interval) ---
    console.log('\n🌊 SCENARIO 2: 3 Orders with 5s delay between each...');
    const start2 = Date.now();
    
    console.log('Sending Order 1...');
    const res2_1 = await simulateOrder('Delayed-Tablet 1');
    
    await delay(5000);
    console.log('Sending Order 2...');
    const res2_2 = await simulateOrder('Delayed-Tablet 2');
    
    await delay(5000);
    console.log('Sending Order 3...');
    const res2_3 = await simulateOrder('Delayed-Tablet 3');
    
    const results2 = [res2_1, res2_2, res2_3];
    console.log(`⏱️ Scenario 2 Duration: ${(Date.now() - start2) / 1000}s`);

    console.log('\n📊 FINAL SUMMARY:');
    console.log('Scenario 1 Results:', results1);
    console.log('Scenario 2 Results:', results2);

    const olseraCount = [...results1, ...results2].filter(id => id.startsWith('OLSERA-')).length;
    console.log(`\n🏆 Total Successful Olsera Orders: ${olseraCount} / 6`);
    console.log(olseraCount === 6 
      ? '✨ Perfect score! Olsera handled all spaced requests.' 
      : 'ℹ️ Fallback IDs (SF-) ensured system stability where Olsera API limit was hit.');

  } catch (error) {
    console.error('\n❌ CRITICAL ERROR IN TEST SCRIPT');
    console.error(error);
    process.exit(1);
  }
}

runTest();
