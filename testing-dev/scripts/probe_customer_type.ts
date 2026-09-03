import { olseraFetch } from '../../src/lib/integrations/olsera.service';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const candidates = [
  '/customersupplier/customer-type',
  '/customersupplier/customertype',
  '/global/customer-type',
  '/global/customertype',
  '/global/list-customer-type',
  '/customer-type',
];

async function run() {
  for (const path of candidates) {
    try {
      const res = await olseraFetch(path, { silent: true });
      const text = await res.text();
      console.log(`\n${path} -> status=${res.status}`);
      if (res.ok) console.log(text.slice(0, 800));
    } catch (err: any) {
      console.log(`${path} -> error: ${err.message}`);
    }
  }
}

run().catch(console.error);
