import dotenv from 'dotenv';
dotenv.config();

const SCRIPT_URL = process.env.VITE_GOOGLE_SHEET_URL;

async function run() {
  const url = `${SCRIPT_URL}?action=read&sheet=Schools`;
  const response = await fetch(url);
  const schools = await response.json();
  
  let validCenters = schools.filter(s => s.id.startsWith('center_'));
  let nonCenters = schools.filter(s => !s.id.startsWith('center_'));
  
  console.log(`Original schools starting with center_: ${validCenters.length}`);
  console.log(`Schools NOT starting with center_: ${nonCenters.length}`);
}
run();
