import { googleSheetService } from './src/services/googleSheetService.js';

async function fetchProducts() {
  try {
    const products = await googleSheetService.fetchRecords('Products');
    console.log(JSON.stringify(products, null, 2));
  } catch (err) {
    console.error(err);
  }
}

fetchProducts();
