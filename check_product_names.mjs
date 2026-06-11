import dotenv from 'dotenv';
dotenv.config();

const SCRIPT_URL = process.env.VITE_GOOGLE_SHEET_URL;

async function run() {
  const fetchRes = await fetch(SCRIPT_URL + "?action=read&sheet=Products");
  const data = await fetchRes.json();
  const names = data.map(d => d.name);
  console.log("DB names:", names);
}
run();
