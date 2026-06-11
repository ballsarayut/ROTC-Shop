const fs = require('fs');

let data = JSON.parse(fs.readFileSync('src/data/initialProducts.ts', 'utf8').replace('import { Product } from \'../types\';\n\nexport const INITIAL_PRODUCTS: Partial<Product>[] = ', '').replace(/;\n$/, ''));

let expectedNames = data.map(d => d.name).slice(0, 14);

let content = fs.readFileSync('src/pages/Home.tsx', 'utf8');
const replacement = `const RECOMMENDED_ITEMS = [
  ${expectedNames.map(n => '"' + n + '"').join(',\n  ')}
];`;
content = content.replace(/const RECOMMENDED_ITEMS = \[[\s\S]*?\];/, replacement);

fs.writeFileSync('src/pages/Home.tsx', content);
