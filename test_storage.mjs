import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';

const cfg = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(cfg);
const db = getFirestore(app, "ai-studio-e4f0f369-8adb-4d0d-987e-a47ef3344bd0");
const storage = getStorage(app, "gs://ai-studio-e4f0f369-8adb-4d0d-987e-a47ef3344bd0.firebasestorage.app");

async function run() {
   try {
       const snap = await getDoc(doc(db, 'orders', 'R93nB1QS8Gm8QWONNOwt'));
       const b64 = snap.data().paymentRef || snap.data().slipUrl;
       
       const sRef = ref(storage, 'slips/test_slip.jpg');
       await uploadString(sRef, b64, 'data_url');
       const url = await getDownloadURL(sRef);
       console.log("Success:", url);
   } catch(e) {
       console.error("Storage Error:", e);
   }
   process.exit();
}
run();
