import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, getDoc, doc } from 'firebase/firestore';

const SCRIPT_URL = process.env.VITE_GOOGLE_SHEET_URL;
const cfg = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(cfg);
const db = getFirestore(app, "ai-studio-e4f0f369-8adb-4d0d-987e-a47ef3344bd0");

async function run() {
  const sheetRes = await fetch(SCRIPT_URL + "?action=read&sheet=Orders");
  const sheetData = await sheetRes.json();
  
  const ids = ['yUz3sNCjRTsaoOqymg9F', 'u62J62VsnNMfQML04Ahd', 'R93nB1QS8Gm8QWONNOwt'];

  for (const id of ids) {
      console.log("Restoring:", id);
      const snap = await getDoc(doc(db, 'orders', id));
      if (!snap.exists()) continue;
      
      const b64 = snap.data().paymentRef || snap.data().slipUrl;
      const sheetRow = sheetData.find(row => row.id === id);
      if (!sheetRow) continue;
      
      sheetRow.paymentRef = b64;
      const payloadObj = { ...sheetRow };
      Object.keys(payloadObj).forEach(key => {
        if (typeof payloadObj[key] === 'object') {
            payloadObj[key] = JSON.stringify(payloadObj[key]);
        }
      });
      
      try {
          const res = await fetch(SCRIPT_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain' },
              body: JSON.stringify({ action: 'sync', sheet: 'Orders', payload: payloadObj }),
          });
          const text = await res.text();
          console.log(id, "Response:", res.status, text);
      } catch (e) {
          console.error(id, "Failed:", e.message);
      }
  }
}
run();
