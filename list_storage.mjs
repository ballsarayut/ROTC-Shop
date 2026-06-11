import { initializeApp } from 'firebase/app';
import { getStorage, ref, listAll, getDownloadURL } from 'firebase/storage';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const storage = getStorage(app);

async function listFiles(dirPath = '') {
  try {
    const dirRef = ref(storage, dirPath);
    const res = await listAll(dirRef);
    console.log(`\n--- Files in folder: "${dirPath}" ---`);
    for (const itemRef of res.items) {
      const url = await getDownloadURL(itemRef);
      console.log(`${itemRef.name}: ${url}`);
    }
    for (const prefixRef of res.prefixes) {
      await listFiles(prefixRef.fullPath);
    }
  } catch (error) {
    console.error(`Error listing files in "${dirPath}":`, error);
  }
}

listFiles();
