import { olseraFetch } from '../../src/lib/integrations/olsera.service';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const candidates = [
  '/global/list-country',
  '/global/country',
  '/global/countries',
  '/global/list-countries',
];

async function run() {
  for (const path of candidates) {
    console.log(`\n→ Trying ${path} ...`);
    try {
      const res = await olseraFetch(path, { silent: true });
      const text = await res.text();
      console.log(`  status=${res.status}`);
      console.log(`  body=${text.slice(0, 500)}`);
    } catch (err: any) {
      console.log(`  error: ${err.message}`);
    }
  }
}

run().catch(console.error);
