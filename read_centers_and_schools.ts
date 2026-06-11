async function main() {
  const SCRIPT_URL = process.env.VITE_GOOGLE_SHEET_URL;
  if (!SCRIPT_URL) {
    console.error("VITE_GOOGLE_SHEET_URL is missing!");
    return;
  }
  try {
    for (const sheet of ["TrainingCenters", "Schools"]) {
      const url = `${SCRIPT_URL}?action=read&sheet=${sheet}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        console.log(`Sheet: ${sheet}`, data.length, "rows found");
        if (data.length > 0) {
          console.log("Sample:", data[0]);
        }
      } else {
        console.log(`Failed to read sheet: ${sheet}, status: ${response.status}`);
      }
    }
  } catch (err) {
    console.error(err);
  }
}
main();
