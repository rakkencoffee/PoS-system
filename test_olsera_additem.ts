import { createOrder, addItemToOrder, getOrderDetail } from './src/lib/integrations/olsera.service';
async function run() {
  const o = await createOrder([], { customer_name: 'Debug Note' });
  const id = o.id || o.order_id;
  console.log('Created order', id);
  // add a kyoto blend
  await addItemToOrder(id, 114800750, 63357628, 1, 'Sugar: Less; Ice: Less;');
  const detail = await getOrderDetail(id);
  console.log('Detail note is:', detail.orderitems[0].note);
}
run();
