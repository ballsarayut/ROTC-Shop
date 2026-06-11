import dotenv from 'dotenv';
dotenv.config();

const SCRIPT_URL = process.env.VITE_GOOGLE_SHEET_URL;

async function run() {
  if (!SCRIPT_URL) return;
  const url = `${SCRIPT_URL}?action=read&sheet=Orders`;
  const response = await fetch(url);
  const data: any = await response.json();
  if (data && data.length > 0) {
    const emptyIdRows = data.filter((r: any) => !r.id);
    const validIdRows = data.filter((r: any) => r.id);
    console.log("Total rows from sheet:", data.length);
    console.log("Rows with empty/missing id:", emptyIdRows.length);
    console.log("Rows with valid id:", validIdRows.length);
    if (emptyIdRows.length > 0) {
      console.log("First 3 rows with empty id:", emptyIdRows.slice(0, 3));
    }
  }
}

run();
