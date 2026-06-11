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
  
  // Find duplicates based on name
  let seen = new Set();
  let duplicates = [];
  
  // We should prefer keeping schools with id starting with 'center_'
  // Let's sort schools first so 'center_' ids come first
  schools.sort((a, b) => {
    const aIsCenter = a.id.startsWith('center_');
    const bIsCenter = b.id.startsWith('center_');
    if (aIsCenter && !bIsCenter) return -1;
    if (!aIsCenter && bIsCenter) return 1;
    return 0; // maintain original order otherwise
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

  const promises = [];
  let i = 0;
  for (const id of duplicates) {
    promises.push(fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'delete',
        sheet: 'Schools',
        payload: { id: id },
      }),
    }));
    i++;
    if (i % 20 === 0) {
       await Promise.all(promises);
       promises.length = 0;
       console.log("Deleted", i, "duplicates");
    }
  }
  if (promises.length > 0) {
     await Promise.all(promises);
  }
  console.log("Done");
}
run();
