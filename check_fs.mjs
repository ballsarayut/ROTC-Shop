import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const cfg = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(cfg);
const db = getFirestore(app, "ai-studio-e4f0f369-8adb-4d0d-987e-a47ef3344bd0");

async function run() {
  try {
    const snap = await getDocs(collection(db, 'orders'));
    console.log("Found orders in FS:", snap.docs.length);
    let sample = snap.docs.filter(d => Number(d.data().totalAmount) === 2390 || Number(d.data().subtotal) === 2390);
    console.log("Sample 2390 orders in FS:", sample.length);
    if(sample.length > 0) {
      console.log(sample[0].id, JSON.stringify(sample[0].data().items, null, 2));
    }
  } catch(e) {
    console.log("Error:", e);
  }
  process.exit();
}
run();
