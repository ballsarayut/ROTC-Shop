import { initializeApp } from 'firebase/app';
import { getFirestore, getDoc, doc } from 'firebase/firestore';
import fs from 'fs';

const SCRIPT_URL = process.env.VITE_GOOGLE_SHEET_URL;

const cfg = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(cfg);
const db = getFirestore(app, "ai-studio-e4f0f369-8adb-4d0d-987e-a47ef3344bd0");

async function run() {
  const sheetRes = await fetch(SCRIPT_URL + "?action=read&sheet=Orders");
  const sheetData = await sheetRes.json();
  
  const id = 'R93nB1QS8Gm8QWONNOwt';
  const snap = await getDoc(doc(db, 'orders', id));
  
  if (snap.exists()) {
     const fsData = snap.data();
     const url = fsData.slipUrl || fsData.paymentRef;
     
     const sheetRow = sheetData.find(row => row.id === id);
     if (sheetRow) {
         sheetRow.paymentRef = url;
         
         const payloadObj = { ...sheetRow };
         Object.keys(payloadObj).forEach(key => {
            if (typeof payloadObj[key] === 'object') {
                payloadObj[key] = JSON.stringify(payloadObj[key]);
            }
         });
         
         const response = await fetch(SCRIPT_URL, {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({ action: "delete", sheet: 'Orders', payload: { id } }),
         });
         console.log("Delete:", await response.text());
         
         const appendRaw = await fetch(SCRIPT_URL, {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({ action: "sync", sheet: 'Orders', payload: payloadObj }),
         });
         console.log("Append:", await appendRaw.text());
     }
  }
}
run();
