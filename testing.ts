import { config } from 'dotenv';
config({path: '.env.local'});
process.env.USE_OLSERA='true';

import { createOrder } from './src/lib/integrations/pos.adapter';

async function main() {
  console.log('Testing createOrder with addItemToOrder loop...');
  try {
    const res = await createOrder([{
      productId: '4181954', // RAKKEN Coffee Sampler (mock assumed valid)
      quantity: 1
    }]);
    console.log('Resulting POS Order:', res);
  } catch(e) {
    console.error('Error creating order:', e);
  }
}
main();
