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
  'global/list-payment',
  'global/list-payment-mode',
  'global/list-payment-type',
  'global/payment-mode',
  'global/payment-type',
  'pos/list-payment',
  'bank/list',
  'global/paymenttype',
  'global/list-transcation-type',
  'global/transcation-type',
  'global/list-transaction-type',
  'global/transaction-type',
  'global/list-transcation',
  'global/list-transaction'
];

async function test() {
  const token = await getAccessToken();
  console.log('Using Token:', token.substring(0, 10) + '...');
  
  for (const path of candidates) {
    try {
      const url = baseUrl + path;
      const res = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        },
        timeout: 5000
      });
      console.log(`[OK] ${path}: Status ${res.status}`);
      console.log('  Data Preview:', JSON.stringify(res.data).substring(0, 200));
    } catch (e) {
      if (e.response) {
        console.log(`[FAILED] ${path}: Status ${e.response.status}`);
        // console.log('  Response:', JSON.stringify(e.response.data).substring(0, 200));
      } else {
        console.log(`[ERROR] ${path}: ${e.message}`);
      }
    }
  }
}

test();
