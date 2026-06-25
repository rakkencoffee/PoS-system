import * as dotenv from 'dotenv';
dotenv.config();
import * as olsera from '../src/lib/integrations/olsera.service';

async function test() {
  console.log('Testing getAllOrders({ today: true })...');
  try {
    const orders = await olsera.getAllOrders({ today: true });
    console.log(`Success! Found ${orders.length} orders.`);
    if (orders.length > 0) {
      const orderWithItems = orders.find(o => (o.items || o.orderitems || o.order_items || []).length > 0);
      if (orderWithItems) {
        console.log('Found order with items. ID:', orderWithItems.id || orderWithItems.order_id);
        console.log('Items:', JSON.stringify(orderWithItems.items || orderWithItems.orderitems || orderWithItems.order_items, null, 2));
      } else {
        console.log('No orders in the list have items populated. This confirms that the list API does not return items.');
      }
    }
  } catch (err) {
    console.error('Failed:', err);
  }
}

test();
