
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

  const url = OLSERA_API_BASE + '/api/open-api/v1/en/product';
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' }});
  
  if(r.ok) {
     const data = await r.json();
     if(data.data && data.data.length > 0) {
        // print keys and values of the first product
        const p = data.data.find(x => x.name.includes('Lychee Mojito'));
        if(p) console.log(JSON.stringify(p, null, 2));
        else console.log(JSON.stringify(data.data[0], null, 2));
     }
  } else {
     console.log(r.status, await r.text());
  }
}
run();

