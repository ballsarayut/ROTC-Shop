import dotenv from 'dotenv';
dotenv.config();

const SCRIPT_URL = process.env.VITE_GOOGLE_SHEET_URL;

async function getHeaders() {
  const url = `${SCRIPT_URL}?action=read&sheet=Orders`;
  const res = await fetch(url);
  const data = await res.json();
  if (data && data.length > 0) {
    const keys = Object.keys(data[0]);
    // The keys are returned in whatever order they appear or alphabetically.
    // Actually, GAS getSheetData creates an object with headers as keys.
    // It will return them.
    for(const key of keys) {
       console.log(`'${key}' (length: ${key.length})`);
    }
  } else {
    console.log("No data");
  }
}
getHeaders();
