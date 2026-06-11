import { initializeApp } from 'firebase/app';
import { getFirestore, getDoc, doc } from 'firebase/firestore';
import fs from 'fs';

const SCRIPT_URL = process.env.VITE_GOOGLE_SHEET_URL;

const cfg = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(cfg);
const db = getFirestore(app, "ai-studio-e4f0f369-8adb-4d0d-987e-a47ef3344bd0");

async function syncRecord(sheet, payload) {
  const sanitizedPayload = { ...payload };
  Object.keys(sanitizedPayload).forEach((key) => {
    const val = sanitizedPayload[key];
    if (val && typeof val === "object") {
      sanitizedPayload[key] = JSON.stringify(val);
    }
  });

  console.log("PAYLOAD LENGTH:", JSON.stringify(sanitizedPayload).length);

  try {
      const response = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action: "sync", sheet, payload: sanitizedPayload }),
      });
      console.log("Response status:", response.status);
      const text = await response.text();
      console.log("Response text:", text);
  } catch (e) {
      console.log("ERROR EXECUTING FETCH:", e);
  }
}

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
         console.log(id, "found in sheet");
         sheetRow.paymentRef = url;
         await syncRecord('Orders', sheetRow);
     }
  }
  process.exit();
}
run();
