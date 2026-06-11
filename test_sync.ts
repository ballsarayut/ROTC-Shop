import dotenv from 'dotenv';
dotenv.config();

const SCRIPT_URL = process.env.VITE_GOOGLE_SHEET_URL;

async function run() {
  if (!SCRIPT_URL) {
    console.error("VITE_GOOGLE_SHEET_URL not set");
    return;
  }
  // Let's call syncRecord on googleSheetService
  // We can write a direct fetch representing syncRecord
  const payload = {
    id: "u11fuobKKiEfHrtmqMlI", // first record from our previous list
    fullName: "อนุวรรตน์ เทียบทัน",
    isEmbroidered: "TRUE"
  };

  console.log("Syncing record to sheet...");
  const response = await fetch(SCRIPT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      action: 'sync',
      sheet: 'Orders',
      payload: payload,
    }),
  });
  
  const text = await response.text();
  console.log("Response text:", text);
}

run();
