import fs from 'fs';
async function run() {
  const r = await fetch('https://docs-api-open.olsera.co.id/documentation/');
  const html = await r.text();
  const jsFiles = [...html.matchAll(/src=.\/js\/([^>\"\']+)/g)].map(m => m[1]);
  for(const file of jsFiles) {
    const rf = await fetch('https://docs-api-open.olsera.co.id/js/' + file);
    const text = await rf.text();
    const paths = [...text.matchAll(/\/api\/[a-zA-Z0-\/]+/g)].map(m => m[0]);
    if(paths.length > 0) {
      console.log('--- in', file);
      console.log([...new Set(paths)].join('\n'));
    }
  }
}
run();
