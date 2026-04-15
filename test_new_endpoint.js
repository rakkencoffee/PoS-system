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

async function testEndpoint() {
  try {
    const token = await getAccessToken();
    const endpoint = '/transaction/inextranstype';
    const url = `${baseUrl}${endpoint}?_t=${Date.now()}`;
    
    console.log(`[Testing] GET ${url}`);
    
    const res = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      timeout: 10000
    });
    
    console.log(`[Status] ${res.status}`);
    console.log('[Data Body] Full Response:');
    console.log(JSON.stringify(res.data, null, 2));
    
    if (res.data && (res.data.data || Array.isArray(res.data))) {
      const methods = res.data.data || res.data;
      console.log('\n[Summary] Found entries:', Array.isArray(methods) ? methods.length : 'object');
    }
    
  } catch (error) {
    if (error.response) {
      console.error(`[Error] Status: ${error.response.status}`);
      console.error(`[Error Body]:`, JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(`[Error]: ${error.message}`);
    }
  }
}

testEndpoint();
