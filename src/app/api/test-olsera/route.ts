import { NextResponse } from 'next/server';
import { olseraFetch, getOrderDetail } from '@/lib/integrations/olsera.service';
export async function GET() {
  try {
    const formData = new URLSearchParams();
    formData.append('customer_name', 'Test Array Notes');
    formData.append('items[0][product_id]', '114800750');
    formData.append('items[0][variant_id]', '63357628');
    formData.append('items[0][qty]', '1');
    formData.append('items[0][notes]', 'Sugar: ARRAY;');
    formData.append('items[0][note]', 'Sugar: ARRAY;');
    formData.append('items[0][item_note]', 'Sugar: ARRAY;');
    
    const res = await olseraFetch('/order/openorder', {
      method: 'POST', body: formData, headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    const { data: o } = await res.json();
    const id = o.id || o.order_id;
    
    const detail = await getOrderDetail(id);
    return NextResponse.json({ targetNote: detail.orderitems?.[0]?.note });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

