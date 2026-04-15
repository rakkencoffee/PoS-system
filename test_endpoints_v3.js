const axios = require('axios');
const fs = require('fs');
const path = require('path');

function getEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return {};
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  const env = {};
  lines.forEach(line => {
    const parts = line.split('=');
    if (parts.length === 2) {
      env[parts[0].trim()] = parts[1].trim();
    }
  });
  return env;
}

const env = getEnv();
const baseUrl = 'https://api-open.olsera.co.id/api/open-api/v1/en';

async function getAccessToken() {
  const url = 'https://api-open.olsera.co.id/api/open-api/v1/id/token';
  const formData = new URLSearchParams();
  formData.append('app_id', env.OLSERA_APP_ID);
  formData.append('secret_key', env.OLSERA_SECRET_KEY);
  formData.append('grant_type', 'secret_key');
  
  const res = await axios.post(url, formData);
  return res.data.access_token;
}

const endpoints = [
  '/paymentmode',
  '/paymentmode/list',
  '/payment-mode',
  '/payment-mode/list',
  '/list-payment-mode',
  '/list-paymentmode',
  '/payment/mode',
  '/payment/mode/list',
  '/mode/payment',
  '/mode/payment/list',
  '/global/list-payment-mode',
  '/global/list-paymentmode',
  '/global/paymentmode',
  '/global/payment-mode',
  '/global/payment_mode',
  '/global/list-payment_mode',
  '/transcation-type',
  '/transcation-type/list',
  '/list-transcation-type',
  '/global/list-transcation-type',
  '/global/transcation-type'
];

async function run() {
  const token = await getAccessToken();
  for (const ep of endpoints) {
    try {
      const url = baseUrl + ep;
      const res = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        },
        timeout: 2000
      });
      console.log(`[OK] ${ep} : Status ${res.status}`);
    } catch (e) {
      const status = e.response ? e.response.status : 'ERR';
      const msg = e.response ? JSON.stringify(e.response.data) : e.message;
      console.log(`[FAIL] ${ep} : Status ${status} - ${msg.substring(0, 50)}`);
    }
  }
}

run();
