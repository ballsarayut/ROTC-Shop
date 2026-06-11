import dotenv from 'dotenv';
dotenv.config();

const SCRIPT_URL = process.env.VITE_GOOGLE_SHEET_URL;

async function run() {
  if (!SCRIPT_URL) {
    console.error("VITE_GOOGLE_SHEET_URL missing");
    return;
  }
  
  const url = `${SCRIPT_URL}?action=read&sheet=Schools`;
  const response = await fetch(url);
  const schools = await response.json();
  
  if (schools.length > 0) {
    console.log("Keys in first school:", Object.keys(schools[0]));
    console.log("First school:", schools[0]);
    console.log("School 256:", schools[255]);
  }
}
run();
