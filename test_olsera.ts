import { getOrderDetail, getAllOrders } from './src/lib/integrations/olsera.service';
async function run() {
  const orders = await getAllOrders({ today: false });
  console.log('Orders length:', orders.length);
  if (orders.length > 0) {
    console.log(JSON.stringify(orders[0], null, 2));
    const detail = await getOrderDetail(orders[0].id || orders[0].order_id);
    console.log('--- DETAIL ---');
    console.log(JSON.stringify(detail, null, 2));
  }
}
run();
