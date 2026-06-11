import dotenv from 'dotenv';
dotenv.config();

const SCRIPT_URL = process.env.VITE_GOOGLE_SHEET_URL;

async function getHeaders() {
  const url = `${SCRIPT_URL}?action=read&sheet=Orders`;
  const res = await fetch(url);
  const data = await res.json();
  if (data && data.length > 0) {
    console.log(Object.keys(data[0]));
    console.log("first row:", data[0].isEmbroidered, data[0]["isEmbroidered "], data[0].isOrdered);
  } else {
    console.log("No data");
  }
}
getHeaders();
