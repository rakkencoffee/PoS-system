
import fs from 'fs';
import dotenv from 'dotenv';
const envConfig = dotenv.parse(fs.readFileSync('.env'));

const OLSERA_API_BASE = envConfig.OLSERA_API_BASE;
const OLSERA_APP_ID = envConfig.OLSERA_APP_ID;
const OLSERA_SECRET_KEY = envConfig.OLSERA_SECRET_KEY;

async function run() {
  const formDataAuth = new URLSearchParams();
  formDataAuth.append('app_id', OLSERA_APP_ID);
  formDataAuth.append('secret_key', OLSERA_SECRET_KEY);
  formDataAuth.append('grant_type', 'secret_key');

  const resAuth = await fetch(OLSERA_API_BASE + '/api/open-api/v1/id/token', { method: 'POST', body: formDataAuth });
  const dataAuth = await resAuth.json();
  const token = dataAuth.access_token;

  const url = OLSERA_API_BASE + '/api/open-api/v1/en/order/openorder';

  const formData = new URLSearchParams();
  formData.append('order_date', new Date().toISOString().split('T')[0]);
  formData.append('currency_id', 'IDR');
  formData.append('items[0][product_id]', '1547840');
  formData.append('items[0][qty]', '1');
  formData.append('items[0][price]', '10000');
  
  formData.append('amount_paid', '10000');
  formData.append('payment_type', 'qris');
  formData.append('status', 'paid');
  
  const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      body: formData
  });
  console.log('Testing create paid:', r.status);
  console.log(await r.text());
}
run();

