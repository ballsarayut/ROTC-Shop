import dotenv from 'dotenv';
dotenv.config();

const SCRIPT_URL = process.env.VITE_GOOGLE_SHEET_URL;

async function run() {
  const fetchRes = await fetch(SCRIPT_URL + "?action=read&sheet=Orders");
  const data = await fetchRes.json();
  const targets = data.filter(d => Number(d.totalAmount) === 2390 || Number(d.subtotal) === 2390 || d.items && d.items.includes('2390'));
  console.log("Found orders:");
  for (const t of targets.slice(0, 5)) {
     console.log(t.id, t.totalAmount, t.items);
  }
}
run();
