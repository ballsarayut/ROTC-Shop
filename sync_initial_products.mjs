import fs from 'fs';

async function sync() {
  const url = process.env.VITE_GOOGLE_SHEET_URL + '?action=read&sheet=Products';
  const res = await fetch(url);
  const data = await res.json();
  
  const content = `import { Product } from '../types';

export const INITIAL_PRODUCTS: Partial<Product>[] = ${JSON.stringify(data, null, 2)};
`;
  
  fs.writeFileSync('src/data/initialProducts.ts', content);
  console.log('Synced src/data/initialProducts.ts with spreadsheet data');
}

sync();
