const path = require('path');
const olsera = require(path.join(process.cwd(), 'src/lib/integrations/olsera.service'));

async function testCreateOrder() {
  try {
    console.log('--- Testing Sequential Order Creation ---');
    
    // 1. Create empty order
    const order = await olsera.createOrder([], { customer_name: 'Test Sequential Variant' });
    const orderId = order.id || order.order_id;
    console.log('Order Header Created ID:', orderId);
    
    // 2. Add item WITH variant ID (Ice, Big)
    const productId = 114800750;
    const variantId = 63357628;
    
    console.log(`Adding item: Product ${productId} WITH Variant ${variantId} (Ice, Big)`);
    const formData = new URLSearchParams();
    formData.append('order_id', String(orderId));
    formData.append('item_products', `${productId}|${variantId}`); 
    formData.append('item_qty', '1');
    formData.append('notes', 'Testing variant price');
    
    const response = await olsera.olseraFetch('/order/openorder/additem', {
      method: 'POST',
      body: formData,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    const addResult = await response.json();
    console.log('Add Item Result:', addResult.status);
    
    console.log('\n--- Fetching Order Detail ---');
    const detail = await olsera.getOrderDetail(orderId);
    console.log('Order Items:', JSON.stringify(detail.orderitems, null, 2));
    console.log('\nTotal Amount from API:', detail.total_amount || detail.total);
    
  } catch (error) {
    console.error('Test Failed:', error.message);
  }
}

testCreateOrder();
