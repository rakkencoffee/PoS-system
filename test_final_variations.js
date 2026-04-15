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
      env[parts[0].trim()] = parts[1].trim().replace(/^"(.*)"$/, '$1');
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

async function run() {
  const token = await getAccessToken();
  const endpoints = [
    '/global/list-payment', // no params
    '/global/list-payment?per_page=10',
    '/global/list-payment?per_page=1',
    '/store/detail',
    '/global/list-payment-type',
    '/global/list-payment-mode',
    '/global/list-paymenttype',
    '/global/list-paymentmode',
    '/v1/en/global/list-payment' // testing path variations
  ];

  for (const ep of endpoints) {
    console.log(`\n--- ${ep} ---`);
    const url = ep.startsWith('/v1') 
      ? `${OLSERA_API_BASE}/api/open-api${ep}`
      : `${OLSERA_API_BASE}/api/open-api/v1/en${ep}`;
      
    try {
      const res = await axios.get(url, {
        headers: { 'Authorization': `Bearer ${token}` },
        timeout: 5000
      });
      console.log(`Status: ${res.status}`);
      console.log(`Data: ${JSON.stringify(res.data).substring(0, 500)}`);
    } catch (e) {
      console.log(`Error: ${e.response?.status} - ${JSON.stringify(e.response?.data)}`);
    }
  }
}

run();
