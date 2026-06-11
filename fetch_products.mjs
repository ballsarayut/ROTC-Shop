const url = process.env.VITE_GOOGLE_SHEET_URL + '?action=read&sheet=Products';

async function fetchProducts() {
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(err);
  }
}
fetchProducts();
