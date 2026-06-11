import dotenv from 'dotenv';
dotenv.config();

const SCRIPT_URL = process.env.VITE_GOOGLE_SHEET_URL;

async function run() {
  const fetchRes = await fetch(SCRIPT_URL + "?action=read&sheet=Orders");
  const data = await fetchRes.json();
  data.slice(0, 5).forEach(d => console.log(d.id, "Phone:", d.phone));
}
run();
