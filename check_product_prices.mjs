import dotenv from 'dotenv';
dotenv.config();

const SCRIPT_URL = process.env.VITE_GOOGLE_SHEET_URL;

async function run() {
  const fetchRes = await fetch(SCRIPT_URL + "?action=read&sheet=Products");
  const data = await fetchRes.json();
  const prices = data.map(d => `${d.name}: ${d.price}`);
  console.log("DB prices:\n", prices.join("\n"));
}
run();
