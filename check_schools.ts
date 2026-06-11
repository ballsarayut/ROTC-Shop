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
  
  console.log("Total schools remaining:", schools.length);
  // Find duplicates based on name
  let seen = new Set();
  let duplicates = [];
  for (let school of schools) {
    if (seen.has(school.name)) {
      duplicates.push(school);
    } else {
      seen.add(school.name);
    }
  }
  console.log("Duplicate count by name remaining:", duplicates.length);
}
run();
