async function main() {
  const SCRIPT_URL = process.env.VITE_GOOGLE_SHEET_URL;
  if (!SCRIPT_URL) return;
  try {
    for (const sheet of ["TrainingCenters", "Schools"]) {
      const url = `${SCRIPT_URL}?action=read&sheet=${sheet}`;
      const response = await fetch(url);
      const data = await response.json();
      console.log(`\n=== SHEET: ${sheet} ===`);
      console.log("Keys in first row:", data.length > 0 ? Object.keys(data[0]) : "Empty");
      for (let i = 0; i < Math.min(3, data.length); i++) {
        console.log(`Row ${i}:`, JSON.stringify(data[i], null, 2));
      }
    }
  } catch (err) {
    console.error(err);
  }
}
main();
