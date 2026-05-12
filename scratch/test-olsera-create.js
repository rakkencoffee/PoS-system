const path = require('path');
const olsera = require(path.join(process.cwd(), 'src/lib/integrations/olsera.service'));

async function testCreateOrder() {
  try {
    console.log('--- Testing One-Step Order Creation ---');
    // Get a real product ID from category list if possible, otherwise use a guess
    const items = [
      { productId: '21197', quantity: 1, price: 28000 } 
    ];
    
    const result = await olsera.createOrder(items, { customer_name: 'Test Manual Total' });
    console.log('Order Created Result:', JSON.stringify(result, null, 2));
    
    const orderId = result.id || result.order_id;
    console.log('\n--- Fetching Order Detail ---');
    const detail = await olsera.getOrderDetail(orderId);
    console.log('Order Detail:', JSON.stringify(detail, null, 2));
    console.log('\nTotal Amount from API:', detail.total_amount || detail.total);
    
  } catch (error) {
    console.error('Test Failed:', error.message);
  }
}

testCreateOrder();
