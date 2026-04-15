const axios = require('axios');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf8');
  const config = {};
  content.split('\n').forEach(line => {
    const idx = line.indexOf('=');
    if (idx > 0) config[line.substring(0, idx).trim()] = line.substring(idx + 1).trim();
  });
  return config;
}

const env = loadEnv();
const results = [];

async function run() {
  const fd = new URLSearchParams();
  fd.append('app_id', env.OLSERA_APP_ID);
  fd.append('secret_key', env.OLSERA_SECRET_KEY);
  fd.append('grant_type', 'secret_key');
  const tokenRes = await axios.post('https://api-open.olsera.co.id/api/open-api/v1/id/token', fd);
  const token = tokenRes.data.access_token;
  results.push('Token acquired.');

  const endpoints = [
    '/global/list-payment',
    '/global/list-paymentmode',
    '/global/list-paymenttype',
    '/global/list-payment-mode',
    '/global/list-payment-type',
    '/global/paymentmode',
    '/global/paymenttype',
    '/global/payment-mode',
    '/global/payment-type',
    '/global/list-transactionmode',
    '/global/transaction-mode',
  ];

  for (const ep of endpoints) {
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
    try {
      const res = await axios.get(
        'https://api-open.olsera.co.id/api/open-api/v1/en' + ep,
        {
          headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
          timeout: 8000,
        }
      );
      const preview = JSON.stringify(res.data).substring(0, 300);
      results.push(`OK ${ep} => Status: ${res.status}`);
      results.push(`  Data: ${preview}`);
    } catch (e) {
      const status = e.response?.status || 'TIMEOUT';
      const msg = JSON.stringify(e.response?.data || e.message).substring(0, 200);
      results.push(`FAIL ${ep} => Status: ${status}`);
      results.push(`  Error: ${msg}`);
    }
  }

  // Write results to file
  fs.writeFileSync('test_results.txt', results.join('\n'), 'utf8');
}

run().then(() => {
  console.log('DONE - results saved to test_results.txt');
}).catch(err => {
  results.push('FATAL: ' + err.message);
  fs.writeFileSync('test_results.txt', results.join('\n'), 'utf8');
  console.log('DONE with errors - results saved');
});
