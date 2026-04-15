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

async function testApplyDiscount(token) {
  console.log("\n--- Testing Apply Discount on Dummy Order ---");
  
  const prodRes = await axios.get(`${OLSERA_API_BASE}/api/open-api/v1/en/product?per_page=1`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const product = prodRes.data.data ? prodRes.data.data[0] : prodRes.data[0];
  console.log(`Using product: ${product.name} (ID: ${product.id}, Price: ${product.price})`);

  // Creating open order
  const formDataCreate = new URLSearchParams();
  formDataCreate.append('order_date', new Date().toISOString().split('T')[0]);
  formDataCreate.append('currency_id', 'IDR');
  formDataCreate.append('is_funding', '0');
  formDataCreate.append('customer_name', 'Test Discount User');
  formDataCreate.append('customer_type_id', '0');
  const uniqueStr = Date.now().toString().slice(-5);
  formDataCreate.append('customer_email', `disc${uniqueStr}@example.com`);
  formDataCreate.append('customer_phone', `08123${uniqueStr}`);
  
  const createRes = await axios.post(`${OLSERA_API_BASE}/api/open-api/v1/en/order/openorder`, formDataCreate, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const orderId = createRes.data.data?.order_id || createRes.data.data?.id || createRes.data?.id;
  console.log(`Created Order ID: ${orderId}`);

  // Add Item to Order
  const formDataAdd = new URLSearchParams();
  formDataAdd.append('order_id', orderId);
  formDataAdd.append('item_products', String(product.id)); 
  formDataAdd.append('item_qty', '1');
  
  const addRes = await axios.post(`${OLSERA_API_BASE}/api/open-api/v1/en/order/openorder/additem`, formDataAdd, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log(`Added Item. Total: ${addRes.data.data?.grand_total || addRes.data?.grand_total || 'N/A'}`);

  // Fetch detail to get item ID
  const detailRes = await axios.get(`${OLSERA_API_BASE}/api/open-api/v1/en/order/openorder/detail?id=${orderId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const orderDetail = detailRes.data.data || detailRes.data;
  const orderItem = orderDetail.orderitems && orderDetail.orderitems[0] ? orderDetail.orderitems[0] : null;
  const orderItemId = orderItem?.id;

  if (!orderItemId) {
     console.log("No order item ID found.");
     return;
  }
  console.log(`Found Order Item ID: ${orderItemId}. Attempting to apply 5000 discount.`);

  // Apply Discount via updatedetail (Requires price and qty to be resent)
  const formUpdate = new URLSearchParams();
  formUpdate.append('order_id', orderId);
  formUpdate.append('id', orderItemId);
  formUpdate.append('price', String(orderItem.price || orderItem.subtotal_per_item || product.price || 0));
  formUpdate.append('qty', String(orderItem.qty || orderItem.quantity || 1));
  formUpdate.append('discount', '5000'); 

  try {
      const updateRes = await axios.post(`${OLSERA_API_BASE}/api/open-api/v1/en/order/openorder/updatedetail`, formUpdate, {
          headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log(`Update Detail Status: ${updateRes.status}`);
  } catch(e) {
      console.error("Update Detail Failed:", e.response?.data || e.message);
  }

  // Fetch final detail to format output
  const finalDetailRes = await axios.get(`${OLSERA_API_BASE}/api/open-api/v1/en/order/openorder/detail?id=${orderId}`, {
     headers: { 'Authorization': `Bearer ${token}` }
  });
  const finalData = finalDetailRes.data.data || finalDetailRes.data;
  const finalItem = finalData.orderitems ? finalData.orderitems[0] : null;

  console.log("\n--- FINAL ORDER SUMMARY ---");
  console.log(`Original Price: ${product.price}`);
  console.log(`Item Discount Saved in API: ${finalItem?.discount || 0}`);
  // Sometimes Olsera uses subtotal for calculating post-discount
  console.log(`Final Grand Total of Order: ${finalData.total || finalData.total_amount || finalData.grand_total}`);
  
  // Cleanup order (optional, mostly Olsera allows leaving it open, but let's cancel it if possible)
  try {
      const formCancel = new URLSearchParams();
      formCancel.append('order_id', orderId);
      formCancel.append('status', 'X'); // Cancel
      await axios.post(`${OLSERA_API_BASE}/api/open-api/v1/en/order/openorder/updatestatus`, formCancel, {
          headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log(`\nOrder ${orderId} cancelled for cleanup.`);
  } catch(e) {
      // ignore
  }

}

(async () => {
    const token = await getAccessToken();
    await testApplyDiscount(token);
})();
