import { olseraFetch } from '../../src/lib/integrations/olsera.service';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const candidates = [
  // Customer type — confirm the new "Member" id
  '/customersupplier/customertype',
  // Catatan Pelanggan (Customer Notes)
  '/customersupplier/customer-note',
  '/customersupplier/customernote',
  '/customersupplier/note',
  '/customersupplier/customer/note',
  // Ulasan Pelanggan (Customer Reviews)
  '/customersupplier/customer-review',
  '/customersupplier/customerreview',
  '/customersupplier/review',
  '/review',
  // Kepuasan Pelanggan (Customer Satisfaction)
  '/customersupplier/customer-satisfaction',
  '/customersupplier/customersatisfaction',
  '/customersupplier/satisfaction',
  '/satisfaction',
];

async function run() {
  for (const path of candidates) {
    try {
      const res = await olseraFetch(path, { silent: true });
      const text = await res.text();
      console.log(`\n${path} -> status=${res.status}`);
      if (res.ok) console.log(text.slice(0, 600));
    } catch (err: any) {
      console.log(`${path} -> error: ${err.message}`);
    }
  }
}

run().catch(console.error);
