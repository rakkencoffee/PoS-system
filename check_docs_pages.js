const axios = require('axios');

const baseUrl = 'https://docs-api-open.olsera.co.id/documentation/';
const candidates = [
  'payment---list',
  'payment---detail',
  'payment-mode---list',
  'payment-mode---detail',
  'payment-type---list',
  'payment-type---detail',
  'transaction---list',
  'global---list-payment',
  'global---list-payment-mode',
  'global---list-payment-type',
  'order---update-payment',
  'order---update-payment-status',
  'order---payment-status',
  'open-order---update-payment',
  'open-order---update-payment-status',
  'open-order---payment-status',
  'pos---payment',
  'pos---list-payment',
  'settlement---list',
  'bank---list'
];

async function check() {
  for (const slug of candidates) {
    try {
      const url = baseUrl + slug;
      const res = await axios.get(url, { timeout: 5000 });
      if (res.status === 200) {
        console.log(`[FOUND] ${slug}: ${url}`);
      }
    } catch (e) {
      if (e.response && e.response.status === 404) {
        // console.log(`[404] ${slug}`);
      } else {
        console.log(`[ERROR] ${slug}: ${e.message}`);
      }
    }
  }
}

check();
