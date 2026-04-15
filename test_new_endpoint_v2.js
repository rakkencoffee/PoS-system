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
      env[parts[0].trim()] = parts[1].trim().replace(/^"(.*)"$/, '$1'); // Remove quotes
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
  // Matches olsera.service.ts behavior: data.access_token || data.data?.access_token
  return res.data.access_token || res.data.data?.access_token;
}

async function runTest() {
  try {
    const token = await getAccessToken();
    console.log(`Token acquired: ${token.substring(0, 10)}...`);

    const endpoints = [
       { name: 'Product (Confirm Auth)', path: '/product?per_page=1' },
       { name: 'Payment List (Failing)', path: '/global/list-payment' },
       { name: 'Transcation Type (New)', path: '/transaction/inextranstype' },
       { name: 'Transaction (List)', path: '/transaction' }
    ];

    for (const ep of endpoints) {
      console.log(`\n--- Testing: ${ep.name} ---`);
      const url = `${OLSERA_API_BASE}/api/open-api/v1/en${ep.path}`;
      try {
        const res = await axios.get(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          },
          timeout: 10000
        });
        console.log(`Status: ${res.status}`);
        console.log(`Data (Preview): ${JSON.stringify(res.data).substring(0, 500)}`);
      } catch (e) {
        if (e.response) {
          console.log(`Error Status: ${e.response.status}`);
          console.log(`Error Body: ${JSON.stringify(e.response.data)}`);
        } else {
          console.log(`Error: ${e.message}`);
        }
      }
    }
  } catch (error) {
    console.error('Fatal Error:', error.message);
  }
}

runTest();
