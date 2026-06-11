import dotenv from 'dotenv';
dotenv.config();

const SCRIPT_URL = process.env.VITE_GOOGLE_SHEET_URL;

async function run() {
  const fetchModule = await import('node-fetch');
  const fetch = fetchModule.default;
  const fetchRes = await fetch(SCRIPT_URL + "?action=read&sheet=Schools");
  const data = await fetchRes.json();
  const withAttr = data.filter(s => s.shippingAddress && s.shippingAddress.length > 0);
  console.log("Total Schools:", data.length);
  console.log("With Address:", withAttr.length);
  const withoutAttr = data.filter(s => !s.shippingAddress || s.shippingAddress.length === 0);
  console.log("Missing Address count:", withoutAttr.length);
}
run();
