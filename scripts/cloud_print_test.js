const dotenv = require('dotenv');
dotenv.config();

const NEXT_API_URL = 'http://localhost:3000';
const testOrderId = 'CLOUD-TEST-' + Math.floor(Math.random() * 1000000);

async function runTest() {
  console.log(`🚀 Starting Cloud Print Queue E2E Test for Order: ${testOrderId}\n`);

  try {
    // 1. Create a print job
    const payload = {
      orderId: testOrderId,
      queueNumber: '088',
      customerName: 'Cloud Tester ☁️',
      items: [
        { name: 'Cold Brew Kyoto', quantity: 1, price: 32000, size: 'Regular' },
        { name: 'Croissant Butter', quantity: 1, price: 25000 }
      ],
      total: 57000,
      paymentMethod: 'QRIS'
    };

    console.log('1. Posting print job to Next.js API...');
    const postRes = await fetch(`${NEXT_API_URL}/api/print-jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!postRes.ok) {
      throw new Error(`Failed to create print job: Status ${postRes.status}`);
    }

    const postData = await postRes.json();
    console.log('Result:', JSON.stringify(postData, null, 2));

    // 2. Poll the status for up to 10 seconds
    console.log('\n2. Polling print status (waiting for daemon to pick up and process)...');
    const startTime = Date.now();
    let isPrinted = false;

    for (let i = 0; i < 6; i++) {
      await new Promise(r => setTimeout(r, 2000));

      const statusRes = await fetch(`${NEXT_API_URL}/api/print-jobs/status?orderId=${testOrderId}`);
      if (!statusRes.ok) {
        console.warn(`Failed to fetch status: Status ${statusRes.status}`);
        continue;
      }

      const statusData = await statusRes.json();
      console.log(`[Poll ${i+1}] Status in DB: ${statusData.status}`);

      if (statusData.status === 'PRINTED') {
        isPrinted = true;
        break;
      }
      if (statusData.status === 'FAILED') {
        console.error('❌ Job failed inside daemon. Error:', statusData.errorMessage);
        break;
      }
    }

    if (isPrinted) {
      console.log('\n🎉 SUCCESS: Cloud Print Queue E2E flow verified successfully!');
      process.exit(0);
    } else {
      console.log('\n❌ TIMEOUT: Daemon did not pick up or complete the job in time.');
      process.exit(1);
    }

  } catch (err) {
    console.error('\n❌ Test Error:', err.message);
    process.exit(1);
  }
}

// Check if Next.js is running first
fetch(NEXT_API_URL)
  .then(() => runTest())
  .catch(() => {
    console.error(`⚠️ Next.js server is not running on ${NEXT_API_URL}. Start it first using npm run dev.`);
    process.exit(1);
  });
