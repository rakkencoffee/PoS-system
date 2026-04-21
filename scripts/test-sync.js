// scripts/test-sync.js
require('dotenv').config();
const { syncProductsFromOlsera } = require('../src/lib/integrations/olsera-sync');

/**
 * MANUAL SYNC TEST
 * 
 * Verifies if the POS system can successfully:
 * 1. Authenticate with Olsera.
 * 2. Pull product data.
 * 3. Save to Neon PostgreSQL (ProductCache table).
 */

async function test() {
  console.log('🚀 Starting Manual Sync Test...');
  try {
    const result = await syncProductsFromOlsera();
    console.log('✅ Sync Success!');
    console.log('Items Processed:', result.count);
  } catch (err) {
    console.error('❌ Sync Failed!');
    console.error(err);
  }
}

test();
