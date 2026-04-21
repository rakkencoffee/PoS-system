const dotenv = require('dotenv');
dotenv.config();

async function testAuth() {
  const appId = process.env.OLSERA_APP_ID;
  const secretKey = process.env.OLSERA_SECRET_KEY;
  const apiBase = process.env.OLSERA_API_BASE || 'https://api-open.olsera.co.id';

  console.log('Testing Olsera Auth...');
  console.log('APP_ID:', appId);
  console.log('SECRET_KEY:', secretKey);
  console.log('API_BASE:', apiBase);

  const formData = new FormData();
  formData.append('app_id', appId);
  formData.append('secret_key', secretKey);
  formData.append('grant_type', 'secret_key');

  try {
    const res = await fetch(`${apiBase}/token`, {
      method: 'POST',
      body: formData,
    });

    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Result:', text);
  } catch (err) {
    console.error('Error:', err);
  }
}

testAuth();
