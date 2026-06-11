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
  
  console.log("Total schools:", schools.length);
  
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
  console.log("Duplicate count by name:", duplicates.length);
  
  const idsToDelete = duplicates.map(d => d.id);
  console.log("Found " + idsToDelete.length + " duplicates. Proceeding to delete.");
  
  for (const id of idsToDelete) {
    console.log(`Deleting duplicate school id: ${id}`);
    await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'delete',
        sheet: 'Schools',
        payload: { id: id },
      }),
    });
  }
  
  console.log("Done computing and deleting duplicates.");
}
run();
