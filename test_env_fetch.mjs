const credentials = Buffer.from('AiXFMn0ipns8a8kS3IiJ:lfFXUugNJkgYucuvDMSOhUmYdD5zPwKH').toString('base64');
const storeId = 'rakkencoffee';
const fetch = globalThis.fetch;
const olseraFetch = async (path) => {
  const res = await fetch('https://api-open.olsera.co.id/api/open-api/v1/en' + path, {
    headers: {
      'Authorization': 'Basic ' + credentials,
      'store-id': storeId,
      'Accept': 'application/json'
    }
  });
  return res;
};
async function go() {
  const res = await olseraFetch('/order/openorder?per_page=1');
  const d = await res.json();
  console.log(JSON.stringify(d, null, 2));
}
go();
