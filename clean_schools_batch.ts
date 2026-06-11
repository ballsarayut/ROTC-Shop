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
  
  let seen = new Set();
  let duplicates = [];
  
  schools.sort((a, b) => {
    const aIsCenter = a.id.startsWith('center_');
    const bIsCenter = b.id.startsWith('center_');
    if (aIsCenter && !bIsCenter) return -1;
    if (!aIsCenter && bIsCenter) return 1;
    return 0; 
  });
  
  for (let school of schools) {
    if (seen.has(school.name)) {
      duplicates.push(school.id);
    } else {
      seen.add(school.name);
    }
  }
  
  console.log("Total schools:", schools.length);
  console.log("Duplicates to delete:", duplicates.length);

  // Process 30 duplicates sequentially
  let count = 0;
  for (const id of duplicates) {
    if (count >= 50) break; // limit to 50 so it finishes under 60seconds
    count++;
    console.log(`Deleting ${count}: ${id}`);
    try {
      await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'delete',
          sheet: 'Schools',
          payload: { id: id },
        }),
      });
    } catch (e) {
      console.error("Error", e.message);
    }
  }
  console.log("Done batch");
}
run();
