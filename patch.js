const fs = require('fs');
let lines = fs.readFileSync('src/lib/integrations/olsera.service.ts', 'utf8').split('\n');
const idx = lines.findIndex(l => l.includes('Items are better added via addItemToOrder'));
if (idx > -1 && !lines[idx-1].includes('if (notes)')) {
  lines.splice(idx, 0, '    if (notes) formData.append(\'notes\', notes);');
  fs.writeFileSync('src/lib/integrations/olsera.service.ts', lines.join('\n'));
}

