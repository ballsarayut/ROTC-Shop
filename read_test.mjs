import dotenv from 'dotenv';
dotenv.config();

const SCRIPT_URL = process.env.VITE_GOOGLE_SHEET_URL;

async function run() {
  const fetchRes = await fetch(SCRIPT_URL + "?action=read&sheet=Orders");
  const data = await fetchRes.json();
  const t = data.find(d => d.id === 'test1234');
  console.log("Phone read:", t.phone);
}
run();
