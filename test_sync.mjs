import dotenv from 'dotenv';
dotenv.config();

const SCRIPT_URL = process.env.VITE_GOOGLE_SHEET_URL;

async function run() {
  const dummyItems = [
    { productId: '1', name: 'A', price: 810, quantity: 1 },
    { productId: '2', name: 'B', price: 90, quantity: 1 },
    { productId: '3', name: 'C', price: 200, quantity: 1 },
  ];
  
  const payload = {
    id: "TEST_CART_3",
    items: dummyItems,
    subtotal: 2390,
  };

  const sanitized = { ...payload };
  Object.keys(sanitized).forEach(k => {
    if (sanitized[k] && typeof sanitized[k] === 'object') {
      sanitized[k] = JSON.stringify(sanitized[k]);
    }
  });

  console.log("Req string:", JSON.stringify({ action: "sync", sheet: 'Orders', payload: sanitized }));

  const res = await fetch(SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({ action: "sync", sheet: 'Orders', payload: sanitized }),
  });
  
  console.log("Res:", await res.text());
}
run();
