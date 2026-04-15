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
    if (parts.length === 2) {
      env[parts[0].trim()] = parts[1].trim();
    }
  });
  return env;
}

const env = getEnv();
const baseUrl = 'https://api-open.olsera.co.id/api/open-api/v1/en/';

async function getAccessToken() {
  const url = 'https://api-open.olsera.co.id/api/open-api/v1/id/token';
  const formData = new URLSearchParams();
  formData.append('app_id', env.OLSERA_APP_ID);
  formData.append('secret_key', env.OLSERA_SECRET_KEY);
  formData.append('grant_type', 'secret_key');
  
  const res = await axios.post(url, formData);
  return res.data.access_token;
}

const candidates = [
  'paymentmode',
  'paymenttype',
  'list-payment',
  'list-payment-mode',
  'list-payment-type',
  'transaction-type',
  'mode/payment',
  'payment/list',
  'payment/mode/list',
  'payment/type/list',
  'global/bank-list',
  'global/list-bank',
  'global/list-paymentmode',
  'global/list-paymenttype',
  'order/payment-methods',
  'pos/payment-methods'
];

async function test() {
  const token = await getAccessToken();
  for (const path of candidates) {
    try {
      const url = baseUrl + path;
      const res = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        },
        timeout: 3000
      });
      console.log(`[OK] ${path}: Status ${res.status}`);
      console.log('  Data:', JSON.stringify(res.data).substring(0, 100));
    } catch (e) {
      if (e.response) {
        // console.log(`[FAILED] ${path}: Status ${e.response.status}`);
      } else {
        // console.log(`[ERROR] ${path}: ${e.message}`);
      }
    }
  }
}

test();
