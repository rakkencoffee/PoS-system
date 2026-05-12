const credentials = Buffer.from('1B291A7F-7FB0-429E-862D-0B902A54050D:A78A7EDEE17BF5AE9CA6CA1A8EC32402').toString('base64');
const storeId = 'raakkencoffee';

const olseraFetch = async (path) => {
  const rawUrl = path.startsWith('http') ? path : `https://api-open.olsera.co.id/api/open-api/v1/en${path}`;
  console.log('Fetching', rawUrl);
  const res = await fetch(rawUrl, {
    headers: {
      'Authorization': 'Basic ' + credentials,
      'store-id': storeId,
      'Accept': 'application/json'
    }
  });
  return res;
};

async function fetchOrders() {
  console.log('Fetching Open Orders...');
  const res = await olseraFetch('/order/openorder?per_page=5');
  const text = await res.text();
  try {
    const data = JSON.parse(text);
    console.log("OPEN ORDER ITEM:");
    console.log(JSON.stringify(data.data[0], null, 2));

    const orderId = data.data[0].id || data.data[0].order_id;
    console.log('Fetching detail for: ' + orderId);
    const detailRes = await olseraFetch(`/order/openorder/detail?id=${orderId}`);
    const detailData = await detailRes.json();
    console.log("DETAIL ORDER RESPONSE:");
    console.log(JSON.stringify(detailData, null, 2));
  } catch(e) {
    console.log("Response text:", text);
    console.error(e);
  }
}

fetchOrders().catch(console.error);
