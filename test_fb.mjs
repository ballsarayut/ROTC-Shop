import { initializeApp } from 'firebase/app';
import { getFirestore, getDoc, doc } from 'firebase/firestore';
import fs from 'fs';

const cfg = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(cfg);
const db = getFirestore(app, "ai-studio-e4f0f369-8adb-4d0d-987e-a47ef3344bd0");

async function run() {
  for (const id of ['R93nB1QS8Gm8QWONNOwt', 'u62J62VsnNMfQML04Ahd', 'yUz3sNCjRTsaoOqymg9F']) {
     const snap = await getDoc(doc(db, 'orders', id));
     if (snap.exists()) {
        const url = snap.data().slipUrl || snap.data().paymentRef;
        console.log(id, "length:", url ? url.length : 0);
     }
  }
  process.exit();
}
run();
