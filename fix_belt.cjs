const fs = require('fs');

let data = JSON.parse(fs.readFileSync('src/data/initialProducts.ts', 'utf8').replace('import { Product } from \'../types\';\n\nexport const INITIAL_PRODUCTS: Partial<Product>[] = ', '').replace(/;\n$/, ''));

data.find(d => d.id === 'prod-9').imageUrl = 'https://img1.pic.in.th/images/521670.jpg';
data.find(d => d.id === 'prod-14').imageUrl = 'https://img2.pic.in.th/521696.jpg';

const content = `import { Product } from '../types';

export const INITIAL_PRODUCTS: Partial<Product>[] = ${JSON.stringify(data, null, 2)};
`;

fs.writeFileSync('src/data/initialProducts.ts', content);
