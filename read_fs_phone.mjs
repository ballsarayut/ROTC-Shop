import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const cfg = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(cfg);
const db = getFirestore(app, "ai-studio-e4f0f369-8adb-4d0d-987e-a47ef3344bd0");

async function run() {
  const snap = await getDocs(collection(db, 'orders'));
  const testOrder = snap.docs.find(d => d.id === 'u11fuobKKiEfHrtmqMlI');
  if(testOrder) {
      console.log("Firestore Phone:", testOrder.data().phone, typeof testOrder.data().phone);
  }
  process.exit();
}
run();
