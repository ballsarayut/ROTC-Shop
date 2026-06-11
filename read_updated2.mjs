import dotenv from 'dotenv';
dotenv.config();

const SCRIPT_URL = process.env.VITE_GOOGLE_SHEET_URL;

async function run() {
  const fetchRes = await fetch(SCRIPT_URL + "?action=read&sheet=Orders");
  const data = await fetchRes.json();
  const sampleIds = ['4vkdnHjLGOZf3QmPfL3u', 'u11fuobKKiEfHrtmqMlI', '7zXop7lYTVSwi7gi3sLI', 'DwFWuksbFA9ohmuHGwXm'];
  for (const id of sampleIds) {
    const test = data.find(d => d.id === id);
    if (!test) console.log(id, "Not found");
    else {
        const items = JSON.parse(test.items);
        console.log("ID:", id);
        items.slice(0, 3).forEach(i => console.log("  ", i.name, "size:", i.size));
    }
  }
}
run();
