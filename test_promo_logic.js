const axios = require('axios');
const fs = require('fs');
const path = require('path');

function getEnv() {
  const envPath = path.join(process.cwd(), '.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  const env = {};
  lines.forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^"(.*)"$/, '$1');
    }
  });
  return env;
}

const env = getEnv();
const OLSERA_API_BASE = env.OLSERA_API_BASE || 'https://api-open.olsera.co.id';

async function getAccessToken() {
  const url = `${OLSERA_API_BASE}/api/open-api/v1/id/token`;
  const formData = new URLSearchParams();
  formData.append('app_id', env.OLSERA_APP_ID);
  formData.append('secret_key', env.OLSERA_SECRET_KEY);
  formData.append('grant_type', 'secret_key');
  
  const res = await axios.post(url, formData);
  return res.data.access_token || res.data.data?.access_token;
}

async function testHiddenAPIs(token) {
  const endpoints = [
    '/promotion',
    '/promotions',
    '/voucher',
    '/vouchers',
    '/global/promotion',
    '/global/voucher',
    '/discount',
    '/discounts'
  ];

  console.log("--- Scanning potential Promo/Voucher APIs ---");
  for (const ep of endpoints) {
    const url = `${OLSERA_API_BASE}/api/open-api/v1/en${ep}`;
    try {
      const res = await axios.get(url, {
        headers: { 'Authorization': `Bearer ${token}` },
        timeout: 5000
      });
      console.log(`[SUCCESS] ${ep} | Status: ${res.status}`);
      console.log(`Data preview: ${JSON.stringify(res.data).substring(0, 200)}`);
    } catch (e) {
      // Ignore 404s to keep logs clean, only log 200s or unexpected errors
      if (e.response && (e.response.status === 404 || e.response.status === 500)) {
        console.log(`[FAIL] ${ep} | Status: ${e.response.status}`);
      } else {
        console.log(`[ERROR] ${ep} | ${e.message}`);
      }
    }
  }
}

async function testApplyDiscount(token) {
  console.log("\n--- Testing Apply Discount on Dummy Order ---");
  // 1. Get a product to add to order
  console.log("Fetching a product...");
  const prodRes = await axios.get(`${OLSERA_API_BASE}/api/open-api/v1/en/product?per_page=1`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const product = prodRes.data.data ? prodRes.data.data[0] : prodRes.data[0];
  if (!product) {
    console.log("No product found to test with.");
    return;
  }
  console.log(`Using product: ${product.name} (ID: ${product.id})`);

  // 2. Create Open Order
  console.log("Creating open order...");
  const formDataCreate = new URLSearchParams();
  formDataCreate.append('order_date', new Date().toISOString().split('T')[0]);
  formDataCreate.append('currency_id', 'IDR');
  formDataCreate.append('is_funding', '0');
  formDataCreate.append('customer_name', 'Test Discount User');
  formDataCreate.append('customer_type_id', '0');
  
  const createRes = await axios.post(`${OLSERA_API_BASE}/api/open-api/v1/en/order/openorder`, formDataCreate, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const orderId = createRes.data.data?.order_id || createRes.data.data?.id || createRes.data?.id;
  console.log(`Created Order ID: ${orderId}`);

  // 3. Add Item to Order
  console.log("Adding item to order...");
  const formDataAdd = new URLSearchParams();
  formDataAdd.append('order_id', orderId);
  formDataAdd.append('item_products', String(product.id)); // Assuming no variant for simplicity
  formDataAdd.append('item_qty', '1');
  
  const addRes = await axios.post(`${OLSERA_API_BASE}/api/open-api/v1/en/order/openorder/additem`, formDataAdd, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const addedItemData = addRes.data.data || addRes.data;
  console.log(`Item added. Current Grand Total: ${addedItemData.grand_total}`);

  // 4. Update Detail to Apply Discount
  // To do this, we need the `id` of the item inside the order (order_item_id)
  console.log("Fetching order details to get item ID...");
  const detailRes = await axios.get(`${OLSERA_API_BASE}/api/open-api/v1/en/order/openorder/detail?id=${orderId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const orderDetail = detailRes.data.data || detailRes.data;
  const orderItem = orderDetail.orderitems && orderDetail.orderitems[0] ? orderDetail.orderitems[0] : orderDetail.items[0];
  
  if (!orderItem) {
     console.log("Order item not found in detail response.");
     return;
  }
  const orderItemId = orderItem.id;
  console.log(`Found Order Item ID: ${orderItemId}. Applying 5000 IDR discount...`);

  // Apply Discount
  const formUpdate = new URLSearchParams();
  formUpdate.append('order_id', orderId);
  formUpdate.append('id', orderItemId);
  formUpdate.append('discount', '5000'); // Applying Rp 5000 discount

  try {
      const updateRes = await axios.post(`${OLSERA_API_BASE}/api/open-api/v1/en/order/openorder/updatedetail`, formUpdate, {
          headers: { 'Authorization': `Bearer ${token}` }
      });
      
      console.log(`Discount applied. Status: ${updateRes.status}`);
      
      // Let's check the final total
      const finalDetailRes = await axios.get(`${OLSERA_API_BASE}/api/open-api/v1/en/order/openorder/detail?id=${orderId}`, {
         headers: { 'Authorization': `Bearer ${token}` }
      });
      const finalDetail = finalDetailRes.data.data || finalDetailRes.data;
      console.log(`Final Response after discount - Total: ${finalDetail.total || finalDetail.total_amount}. Discount applied on item?: ${finalDetail.orderitems?.[0]?.discount || 'N/A'}`);
      
  } catch(e) {
      console.error("Failed to apply discount:", e.response?.data || e.message);
  }
}

async function runTest() {
  try {
    const token = await getAccessToken();
    await testHiddenAPIs(token);
    await testApplyDiscount(token);
  } catch (error) {
    console.error('Test Failed:', error);
  }
}

runTest();
