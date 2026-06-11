import dotenv from 'dotenv';
dotenv.config();
const SCRIPT_URL = process.env.VITE_GOOGLE_SHEET_URL;

async function run() {
  const fetchRes = await fetch(SCRIPT_URL + "?action=read&sheet=Orders");
  const data = await fetchRes.json();
  const test = data.find(d => d.id === 'TEST_CART_3');
  console.log(test);
}
run();
