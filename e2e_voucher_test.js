/**
 * End-to-End Automated Test: Full Kiosk Flow with Voucher
 * 
 * This script tests EVERY layer independently and reports which systems are UP/DOWN.
 * It gracefully handles Olsera being offline (auth expired) so we can still validate
 * voucher logic, Midtrans integration, and payment routing.
 */

const BASE = 'http://localhost:3000';
const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY || '';
const MIDTRANS_CLIENT_KEY = process.env.MIDTRANS_CLIENT_KEY || '';

// ───── Console Helpers ─────
const log = {
  phase: (msg) => console.log(`\n${'═'.repeat(60)}\n  🔷 ${msg}\n${'═'.repeat(60)}`),
  ok: (msg) => console.log(`  ✅ ${msg}`),
  warn: (msg) => console.log(`  ⚠️  ${msg}`),
  fail: (msg) => console.log(`  ❌ ${msg}`),
  info: (msg) => console.log(`  ℹ️  ${msg}`),
};

const errors = [];
const results = {};

async function fetchJSON(url, opts = {}) {
  try {
    const res = await fetch(url, opts);
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = text; }
    return { status: res.status, ok: res.ok, data: json };
  } catch (e) {
    return { status: 0, ok: false, data: { error: e.message } };
  }
}

// ═══════════════════════════════════════════════════════
// PHASE 1: Health Check
// ═══════════════════════════════════════════════════════
async function phase1_HealthCheck() {
  log.phase('PHASE 1: Server & External Service Health Check');
  
  // 1a. Check if Next.js server is running
  log.info('Checking localhost:3000...');
  try {
    const res = await fetch(`${BASE}/api/menu`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      log.ok('Next.js server is UP, Menu API is responding');
      results.serverUp = true;
      results.olseraUp = true;
    } else {
      const body = await res.text();
      results.serverUp = true;
      if (body.includes('401') || body.includes('Not Authorized')) {
        log.warn('Next.js server is UP, but Olsera API credentials are EXPIRED (401)');
        log.info('Will skip Olsera-dependent tests and test what we can.');
        results.olseraUp = false;
      } else {
        log.warn(`Menu API returned ${res.status}: ${body.substring(0, 200)}`);
        results.olseraUp = false;
      }
    }
  } catch (e) {
    log.fail(`Server not reachable: ${e.message}`);
    log.info('Please run "npm run dev" first!');
    results.serverUp = false;
    results.olseraUp = false;
    errors.push('PHASE 1: Server not running');
    return false;
  }

  // 1b. Check Olsera token directly
  log.info('Checking Olsera API token endpoint...');
  const formData = new URLSearchParams();
  formData.append('app_id', process.env.OLSERA_APP_ID || '');
  formData.append('secret_key', process.env.OLSERA_SECRET_KEY || '');
  formData.append('grant_type', 'secret_key');
  
  try {
    const tokenRes = await fetch('https://api-open.olsera.co.id/api/open-api/v1/id/token', {
      method: 'POST', body: formData,
    });
    const tokenData = await tokenRes.json();
    if (tokenData.access_token || tokenData.data?.access_token) {
      log.ok('Olsera token obtained successfully');
      results.olseraUp = true;
    } else {
      log.warn(`Olsera token failed: ${JSON.stringify(tokenData).substring(0, 100)}`);
      results.olseraUp = false;
    }
  } catch (e) {
    log.warn(`Olsera unreachable: ${e.message}`);
    results.olseraUp = false;
  }

  // 1c. Check Midtrans
  log.info('Checking Midtrans Sandbox...');
  try {
    const authString = Buffer.from(`${MIDTRANS_SERVER_KEY}:`).toString('base64');
    const msRes = await fetch('https://api.sandbox.midtrans.com/v2/dummy-check/status', {
      headers: { Authorization: `Basic ${authString}`, Accept: 'application/json' },
    });
    // Any non-network-error response means Midtrans is reachable
    results.midtransUp = true;
    log.ok('Midtrans Sandbox is reachable');
  } catch (e) {
    log.warn(`Midtrans unreachable: ${e.message}`);
    results.midtransUp = false;
  }

  return results.serverUp;
}

// ═══════════════════════════════════════════════════════
// PHASE 2: Voucher Validation (No Olsera dependency)
// ═══════════════════════════════════════════════════════
async function phase2_VoucherValidation() {
  log.phase('PHASE 2: Voucher Validation Logic');

  const testCases = [
    { code: 'FAKECODE', totalAmount: 60000, expectStatus: 404, desc: 'Invalid code → 404' },
    { code: 'STARTFRIDAY10', totalAmount: 30000, expectStatus: 400, desc: 'Below min purchase → 400' },
    { code: 'STARTFRIDAY10', totalAmount: 60000, expectStatus: 200, desc: 'Valid nominal voucher → 200' },
    { code: 'RAKKENCOFFEE', totalAmount: 80000, expectStatus: 200, desc: 'Valid percentage voucher → 200' },
    { code: 'MINUS5', totalAmount: 10000, expectStatus: 200, desc: 'No min purchase voucher → 200' },
    { code: 'minus5', totalAmount: 10000, expectStatus: 200, desc: 'Case insensitive → 200' },
  ];

  let passed = 0;
  let failed = 0;

  for (const tc of testCases) {
    const { data, status } = await fetchJSON(`${BASE}/api/payment/validate-voucher`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: tc.code, totalAmount: tc.totalAmount }),
    });

    if (status === tc.expectStatus) {
      if (status === 200) {
        log.ok(`${tc.desc} | discount=Rp ${data.discountAmount?.toLocaleString()}`);
      } else {
        log.ok(`${tc.desc} | msg="${data.error?.substring(0, 50)}"`);
      }
      passed++;
    } else {
      log.fail(`${tc.desc} | Got ${status} instead of ${tc.expectStatus}`);
      failed++;
    }
  }

  // Specific checks for discount amounts
  log.info('Verifying discount calculation accuracy...');
  
  const { data: d1 } = await fetchJSON(`${BASE}/api/payment/validate-voucher`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'STARTFRIDAY10', totalAmount: 60000 }),
  });
  if (d1.discountAmount === 10000) {
    log.ok(`STARTFRIDAY10 nominal: 10000 ✓`);
    passed++;
  } else {
    log.fail(`STARTFRIDAY10 expected 10000, got ${d1.discountAmount}`);
    failed++;
  }

  const { data: d2 } = await fetchJSON(`${BASE}/api/payment/validate-voucher`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'RAKKENCOFFEE', totalAmount: 80000 }),
  });
  if (d2.discountAmount === 12000) { // 15% of 80000 = 12000
    log.ok(`RAKKENCOFFEE 15% of 80k: 12000 ✓`);
    passed++;
  } else {
    log.fail(`RAKKENCOFFEE expected 12000, got ${d2.discountAmount}`);
    failed++;
  }

  log.info(`Voucher Tests: ${passed} passed, ${failed} failed`);
  results.voucherPassed = passed;
  results.voucherFailed = failed;
  
  if (failed > 0) {
    errors.push(`PHASE 2: ${failed} voucher test(s) failed`);
  }
}

// ═══════════════════════════════════════════════════════
// PHASE 3: Create Payment (Full Stack: Olsera + Midtrans)
// ═══════════════════════════════════════════════════════
async function phase3_CreatePayment() {
  log.phase('PHASE 3: Create Order + Payment (Olsera → Midtrans)');

  if (!results.olseraUp) {
    log.warn('Olsera is DOWN. Skipping create payment (requires Olsera order creation).');
    log.info('This is expected when Olsera credentials are expired.');
    errors.push('PHASE 3: Skipped (Olsera auth expired)');
    return null;
  }

  // Get first available menu item
  const { data: menuItems } = await fetchJSON(`${BASE}/api/menu`);
  if (!Array.isArray(menuItems) || menuItems.length === 0) {
    log.fail('No menu items available');
    errors.push('PHASE 3: No menu items');
    return null;
  }

  const item = menuItems.find(i => i.isAvailable && i.price >= 25000) || menuItems[0];
  const quantity = Math.ceil(50000 / item.price);
  const totalAmount = item.price * quantity;
  
  log.ok(`Selected: ${quantity}x "${item.name}" @ Rp ${item.price.toLocaleString()} = Rp ${totalAmount.toLocaleString()}`);

  // Validate voucher
  const { data: voucherData } = await fetchJSON(`${BASE}/api/payment/validate-voucher`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'STARTFRIDAY10', totalAmount }),
  });

  const discountAmount = voucherData.discountAmount || 0;
  const finalAmount = totalAmount - discountAmount;
  log.info(`Voucher discount: Rp ${discountAmount.toLocaleString()} → Final: Rp ${finalAmount.toLocaleString()}`);

  // Create payment
  const payload = {
    items: [{
      productId: item.id,
      variantId: item.olseraVariants?.[0]?.id ? String(item.olseraVariants[0].id) : undefined,
      quantity,
      name: item.name,
      price: item.price,
    }],
    totalAmount,
    customerName: 'E2E Test Bot',
    discountAmount: discountAmount > 0 ? discountAmount : undefined,
    voucherCode: discountAmount > 0 ? 'STARTFRIDAY10' : undefined,
  };

  log.info('POST /api/payment/create...');
  const startTime = Date.now();
  const { data, status, ok } = await fetchJSON(`${BASE}/api/payment/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const elapsed = Date.now() - startTime;

  if (!ok) {
    log.fail(`Payment creation failed (${status}): ${JSON.stringify(data).substring(0, 200)}`);
    errors.push(`PHASE 3: Payment create error ${status}`);
    return null;
  }

  log.ok(`Order created in ${elapsed}ms`);
  log.info(`Order ID: ${data.orderId}`);
  log.info(`Snap Token: ${data.snapToken?.substring(0, 30)}...`);
  log.info(`Redirect URL: ${data.redirectUrl?.substring(0, 60)}...`);

  results.payment = { ...data, finalAmount, totalAmount, discountAmount };
  return results.payment;
}

// ═══════════════════════════════════════════════════════
// PHASE 4: Midtrans CC Payment
// ═══════════════════════════════════════════════════════
async function phase4_MidtransCC() {
  log.phase('PHASE 4: Midtrans Credit Card Charge');

  if (!results.payment) {
    log.warn('No payment created (Phase 3 skipped). Skipping Midtrans charge.');
    return null;
  }

  const { orderId, finalAmount } = results.payment;
  const authString = Buffer.from(`${MIDTRANS_SERVER_KEY}:`).toString('base64');

  // Step 1: Get card token
  log.info('Tokenizing credit card 4811111111111114...');
  const tokenUrl = `https://api.sandbox.midtrans.com/v2/token?card_number=4811111111111114&card_exp_month=01&card_exp_year=2029&card_cvv=123&client_key=${MIDTRANS_CLIENT_KEY}`;
  
  try {
    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();

    if (tokenData.status_code !== '200') {
      log.fail(`Card tokenization failed: ${JSON.stringify(tokenData).substring(0, 200)}`);
      errors.push('PHASE 4: Card token failed');
      return null;
    }
    log.ok(`Card token: ${tokenData.token_id.substring(0, 25)}...`);

    // Step 2: Charge
    log.info(`Charging Rp ${finalAmount.toLocaleString()} for order ${orderId}...`);
    const chargeRes = await fetch('https://api.sandbox.midtrans.com/v2/charge', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${authString}`,
        Accept: 'application/json',
      },
      body: JSON.stringify({
        payment_type: 'credit_card',
        transaction_details: { order_id: orderId, gross_amount: finalAmount },
        credit_card: { token_id: tokenData.token_id, authentication: true },
      }),
    });
    const chargeData = await chargeRes.json();

    log.info(`Status: ${chargeData.transaction_status} (${chargeData.status_code})`);
    log.info(`Message: ${chargeData.status_message}`);

    if (chargeData.status_code === '201') {
      log.ok('3DS redirect created (expected for sandbox CC with authentication: true)');
      log.warn('3DS requires browser interaction — cannot auto-complete in headless mode.');
      log.info('The order IS created in Olsera. Payment is pending 3DS completion.');
      
      // Try without 3DS authentication
      log.info('\nRetrying without 3DS (authentication: false) for auto-capture...');
      const retryOid = orderId + '-NO3DS';
      const chargeRes2 = await fetch('https://api.sandbox.midtrans.com/v2/charge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${authString}`,
          Accept: 'application/json',
        },
        body: JSON.stringify({
          payment_type: 'credit_card',
          transaction_details: { order_id: retryOid, gross_amount: finalAmount },
          credit_card: { token_id: tokenData.token_id, authentication: false },
        }),
      });
      const chargeData2 = await chargeRes2.json();
      log.info(`No-3DS Status: ${chargeData2.transaction_status} (${chargeData2.status_code})`);
      
      if (chargeData2.transaction_status === 'capture' || chargeData2.transaction_status === 'settlement') {
        log.ok(`🎉 Payment captured without 3DS! Order ${retryOid} → ${chargeData2.transaction_status}`);
        results.ccSuccess = true;
        results.paidOrderId = retryOid;
      } else {
        log.warn(`No-3DS charge result: ${chargeData2.status_message}`);
      }
      
      results.charge = chargeData;
      return chargeData;
    }
    
    if (chargeData.transaction_status === 'capture' || chargeData.transaction_status === 'settlement') {
      log.ok(`🎉 Payment captured! Status: ${chargeData.transaction_status}`);
      results.ccSuccess = true;
      results.paidOrderId = orderId;
    }

    results.charge = chargeData;
    return chargeData;
  } catch (e) {
    log.fail(`Midtrans error: ${e.message}`);
    errors.push(`PHASE 4: ${e.message}`);
    return null;
  }
}

// ═══════════════════════════════════════════════════════
// PHASE 5: Verify Payment & Auto-Settle to Olsera
// ═══════════════════════════════════════════════════════
async function phase5_Verify() {
  log.phase('PHASE 5: Verify Payment & Trigger Auto-Settlement');

  const orderId = results.payment?.orderId;
  if (!orderId) {
    log.warn('No order to verify (Phase 3 skipped).');
    return;
  }

  log.info(`POST /api/payment/verify?orderId=${orderId}...`);
  const { data, status } = await fetchJSON(`${BASE}/api/payment/verify?orderId=${orderId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });

  log.info(`Response (${status}): ${JSON.stringify(data)}`);

  if (data.status === 'success') {
    log.ok('✅ Payment verified as SUCCESS → Olsera auto-settlement triggered!');
    results.verified = true;
  } else if (data.status === 'pending') {
    log.warn('Payment still PENDING (3DS not completed).');
    log.info('In real browser flow, user completes 3DS → Midtrans webhook fires → auto-settle.');
  } else {
    log.warn(`Verify returned: ${data.status} / ${data.midtrans_status}`);
  }

  results.verify = data;
}

// ═══════════════════════════════════════════════════════
// PHASE 6: Dashboard & KDS Check
// ═══════════════════════════════════════════════════════
async function phase6_DashboardAndKDS() {
  log.phase('PHASE 6: Admin Dashboard & KDS Sync Check');

  if (!results.olseraUp) {
    log.warn('Olsera is DOWN. Dashboard/KDS checks skipped.');
    return;
  }

  // Dashboard - Today's orders
  log.info("Fetching today's orders...");
  const { data: todayOrders } = await fetchJSON(`${BASE}/api/orders?today=true`);
  const orders = Array.isArray(todayOrders) ? todayOrders : [];
  log.info(`Found ${orders.length} order(s) today`);

  if (results.payment?.orderId) {
    const ours = orders.find(o => o.id === results.payment.orderId);
    if (ours) {
      log.ok(`Our order FOUND in dashboard: ${ours.id} | ${ours.status} | Rp ${ours.totalAmount?.toLocaleString()}`);
      results.dashboardFound = true;
    } else {
      log.info(`Order ${results.payment.orderId} not in filtered results. Last 3 orders:`);
      orders.slice(-3).forEach(o => log.info(`  ${o.id} | ${o.status} | Rp ${o.totalAmount?.toLocaleString()}`));
    }
  }

  // KDS - Open orders
  log.info('\nFetching KDS open orders...');
  const { data: kdsOrders } = await fetchJSON(`${BASE}/api/orders`);
  const kds = Array.isArray(kdsOrders) ? kdsOrders : [];
  const pending = kds.filter(o => o.status === 'PENDING');
  const preparing = kds.filter(o => o.status === 'PREPARING');
  
  log.info(`KDS: ${pending.length} Pending | ${preparing.length} Preparing | ${kds.length} Total`);

  if (results.payment?.orderId) {
    const ours = kds.find(o => o.id === results.payment.orderId);
    if (ours) {
      log.ok(`Our order FOUND in KDS: ${ours.status}`);
      results.kdsFound = true;
    }
  }

  if (pending.length > 0) {
    log.info('Recent Pending:');
    pending.slice(-3).forEach(o => log.info(`  🟡 ${o.id} | Rp ${o.totalAmount?.toLocaleString()}`));
  }
}

// ═══════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════
function printSummary(startTime) {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  log.phase('📊 FINAL TEST REPORT');
  console.log(`  Total duration: ${elapsed}s\n`);

  console.log('  ─── System Status ───');
  console.log(`  ${results.serverUp ? '🟢' : '🔴'} Next.js Server`);
  console.log(`  ${results.olseraUp ? '🟢' : '🔴'} Olsera POS API`);
  console.log(`  ${results.midtransUp ? '🟢' : '🔴'} Midtrans Sandbox`);

  console.log('\n  ─── Test Results ───');
  const checks = [
    ['Voucher Validation Logic', results.voucherFailed === 0 && results.voucherPassed > 0],
    ['Order Creation (Olsera)', !!results.payment],
    ['Voucher Discount Applied', results.payment?.discountAmount > 0],
    ['Midtrans Snap Token', !!results.payment?.snapToken],
    ['CC Charge Initiated', !!results.charge],
    ['Payment Verified (Success)', !!results.verified],
    ['Dashboard Sync', !!results.dashboardFound],
    ['KDS Visibility', !!results.kdsFound],
  ];

  checks.forEach(([name, passed]) => {
    if (passed) {
      console.log(`  ✅ ${name}`);
    } else if (
      (!results.olseraUp && ['Order Creation (Olsera)', 'Voucher Discount Applied', 'Midtrans Snap Token', 'CC Charge Initiated', 'Payment Verified (Success)', 'Dashboard Sync', 'KDS Visibility'].includes(name))
    ) {
      console.log(`  ⏭️  ${name} (skipped — Olsera offline)`);
    } else {
      console.log(`  ⬜ ${name}`);
    }
  });

  console.log('\n  ─── Errors ───');
  if (errors.length > 0) {
    errors.forEach(e => console.log(`  🔴 ${e}`));
  } else {
    console.log('  🟢 No critical errors!');
  }

  if (!results.olseraUp) {
    console.log('\n  ─── IMPORTANT ───');
    console.log('  Olsera credentials expired. To fix:');
    console.log('  1. Log in to Olsera Dashboard → Open API settings');
    console.log('  2. Generate a new APP_ID and SECRET_KEY');
    console.log('  3. Update .env file with new credentials');
    console.log('  4. Restart the dev server and re-run this test');
  }

  console.log('');
}

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════
async function main() {
  console.log('\n' + '🚀'.repeat(30));
  console.log('  STARTFRIDAY POS — E2E TEST WITH VOUCHER');
  console.log('  ' + new Date().toLocaleString('id-ID'));
  console.log('🚀'.repeat(30));

  const startTime = Date.now();

  const serverOk = await phase1_HealthCheck();
  if (!serverOk) {
    return printSummary(startTime);
  }

  await phase2_VoucherValidation();
  await phase3_CreatePayment();
  await phase4_MidtransCC();
  await phase5_Verify();
  await phase6_DashboardAndKDS();

  printSummary(startTime);
}

main().catch(err => {
  console.error('\n💥 FATAL:', err);
  process.exit(1);
});
