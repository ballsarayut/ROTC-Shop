import dotenv from 'dotenv';
dotenv.config();

const SCRIPT_URL = process.env.VITE_GOOGLE_SHEET_URL;

async function check() {
  const url = `${SCRIPT_URL}?action=read&sheet=Orders`;
  const res = await fetch(url);
  const data = await res.json();
  const sample = data.find(r => r.id === '9SUzeOsn0Q0T');
  console.log("sample row:", JSON.stringify(sample, null, 2));
}
check();
