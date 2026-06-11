import dotenv from 'dotenv';
dotenv.config();

const SCRIPT_URL = process.env.VITE_GOOGLE_SHEET_URL;

async function run() {
  const fetchRes = await fetch(SCRIPT_URL + "?action=read&sheet=Orders");
  const data = await fetchRes.json();
  const test = data.find(d => d.id === '4vkdnHjLGOZf3QmPfL3u');
  console.log("ITEMS JSON:", JSON.stringify(test.items));
}
run();
