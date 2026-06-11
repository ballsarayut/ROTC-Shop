import dotenv from 'dotenv';
dotenv.config();

const SCRIPT_URL = process.env.VITE_GOOGLE_SHEET_URL;

async function forceSyncOne() {
  const payloadToSync = {
    id: "9SUzeOsn0Q0T",
    isEmbroidered: "TRUE",
    isOrdered: "FALSE"
  };

  const res = await fetch(SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "sync", sheet: 'Orders', payload: payloadToSync }),
  });
  console.log("Status:", res.status);
}

forceSyncOne().catch(console.error);
