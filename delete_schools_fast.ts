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
  let goodSchools = [];
  
  for (let school of schools) {
    if (seen.has(school.name)) {
      duplicates.push(school.id);
    } else {
      seen.add(school.name);
      goodSchools.push(school);
    }
  }
  
  console.log("Good schools count:", goodSchools.length);
  console.log("Duplicate schools count:", duplicates.length);

  // We should make sure we're leaving the correct ones
  for(let i=0; i<3; i++) {
    console.log("Good:", goodSchools[i]);
  }
  
  // Instead of deleting 1 by 1 which is slow, I'll delete them 20 at a time, but wait, Apps Script delete is slow if iterating sequentially.
  // We can just filter out duplicates in JS, delete all existing schools and write the new list
  // Wait, if I do this I might lose some data, but the only issue is "โรงเรียนซ้ำกันอยู่ใน sheet แก้ไขด้วยลบอันที่ซ้ำออก"
  // Is it safe to just remove all rows in Schools and insert goodSchools?
  // Let's delete 1 by 1 but we don't need to await one by one.
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
