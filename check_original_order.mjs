import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

// Need to read firebase-applet-config.json
import fs from 'fs';
const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));

const app = initializeApp(config);
const db = getFirestore(app);

async function run() {
  const id = 'u11fuobKKiEfHrtmqMlI';
  const docRef = doc(db, 'orders', id);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    console.log("Original items:", JSON.stringify(snap.data().items, null, 2));
  } else {
    console.log("Not found in Firestore");
  }
}

run().catch(console.error);
