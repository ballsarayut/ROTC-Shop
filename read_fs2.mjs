import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const cfg = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(cfg);
const db = getFirestore(app, "ai-studio-e4f0f369-8adb-4d0d-987e-a47ef3344bd0");

async function run() {
  const snap = await getDocs(collection(db, 'orders'));
  const t = snap.docs.find(d => d.id === '4vkdnHjLGOZf3QmPfL3u');
  if(t) console.log("Phone in FS:", t.data().phone);
  process.exit();
}
run();
