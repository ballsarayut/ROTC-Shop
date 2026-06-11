import dotenv from 'dotenv';
dotenv.config();

const SCRIPT_URL = process.env.VITE_GOOGLE_SHEET_URL;

async function run() {
  if (!SCRIPT_URL) return;
  const url = `${SCRIPT_URL}?action=read&sheet=Orders`;
  const response = await fetch(url);
  const data: any = await response.json();
  if (data && data.length > 0) {
    const matched = data.filter((r: any) => r.fullName && r.fullName.includes('เกวลิน'));
    matched.forEach((r: any) => {
      console.log(`Matched name: "${r.fullName}" with ID: "${r.id}"`);
    });
  }
}

run();
