import dotenv from 'dotenv';
dotenv.config();

const SCRIPT_URL = process.env.VITE_GOOGLE_SHEET_URL;

async function getHeaders() {
  const url = `${SCRIPT_URL}?action=read&sheet=Orders`;
  const res = await fetch(url);
  const data = await res.json();
  const sample = data.find(r => r.id === 'TEST_CART_3' || r.isEmbroidered || r.isOrdered || ['TRUE', 'FALSE', true, false].includes(r.isEmbroidered) || r.id === '11') || data[0];
  console.log("sample row:", JSON.stringify(sample, null, 2));
}
getHeaders();
