import dotenv from 'dotenv';
dotenv.config();

const SCRIPT_URL = process.env.VITE_GOOGLE_SHEET_URL;

async function run() {
  const payloadObj = { id: 'test1234', phone: "'0123456789" };
  const params = { action: 'sync', sheet: 'Orders', payload: payloadObj };

  const res = await fetch(SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(params),
  });

  console.log("Result:", await res.text());
}
run();
