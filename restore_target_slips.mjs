import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, getDoc, doc } from 'firebase/firestore';
import fetch from 'node-fetch';

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyCb7Byo0Zn8-VtxQ-6xwy0K0UR42s_8U4zcUfR6ReFIlILZ18Nt-dvJLk1dd6VtgEI/exec";

const firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = firebaseConfig.firestoreDatabaseId ? getFirestore(app, firebaseConfig.firestoreDatabaseId) : getFirestore(app);

const targetIds = {
  "ณัฐวลัญช์ บุษย์เพชร": "rauspOpZgU6EPvaFe0fb",
  "บูระณิมา บุญทองเล็ก": "2SR2KXlowWH6Yx4ucvJr",
  "ณัทธร โอฬาริ": "4iOjTrtZ34pWcDYQZrjy",
  "สลิลทิพย์ คงทอง": "BZACRRGG"
};

async function run() {
  console.log("Starting targeted slip restoration from Firestore to Google Sheets...");
  
  // 1. Fetch current Sheet orders to ensure we preserve all other data
  console.log("Fetching existing orders from Google Sheets to ensure we match records...");
  const sheetRes = await fetch(`${SCRIPT_URL}?action=read&sheet=Orders`);
  if (!sheetRes.ok) {
    throw new Error(`Failed to fetch Google Sheets data: StatusCode ${sheetRes.status}`);
  }
  const sheetOrders = await sheetRes.json();
  console.log(`Loaded ${sheetOrders.length} orders from Google Sheet.`);

  let restoredCount = 0;

  for (const [name, id] of Object.entries(targetIds)) {
    console.log(`\nProcessing ${name} (ID: ${id})...`);
    
    // Find matching sheet row
    const sheetRow = sheetOrders.find(row => row.id === id);
    if (!sheetRow) {
      console.log(`Warning: Row with ID "${id}" for "${name}" not found in Google Sheets.`);
      continue;
    }

    try {
      // Fetch directly from Firestore by ID
      const snap = await getDoc(doc(db, 'orders', id));
      if (!snap.exists()) {
        console.log(`Error: Document "${id}" for "${name}" does not exist in Firestore.`);
        continue;
      }

      const fbData = snap.data();
      const fbSlip = fbData.paymentRef || fbData.slipUrl;

      if (!fbSlip) {
        console.log(`Error: Document in Firestore does not contain any slip images (paymentRef/slipUrl is empty).`);
        continue;
      }

      console.log(`Found slip in Firestore! Length: ${fbSlip.length}. Restoring to Google Sheets...`);

      // Construct payload maintaining exactly existing row data isEmbroidered, isOrdered, etc.
      // We only restore paymentRef and/or slipUrl.
      const payloadObj = { ...sheetRow };
      
      // If it's a data URI or base64, set paymentRef, else set slipUrl. or both to be safe
      if (fbSlip.startsWith('data:image') || fbSlip.length > 500) {
        payloadObj.paymentRef = fbSlip;
        payloadObj.slipUrl = ""; // or keep existing
      } else {
        payloadObj.slipUrl = fbSlip;
        payloadObj.paymentRef = "";
      }

      // Format payload objects to JSON strings as required by Apps Script handler
      Object.keys(payloadObj).forEach(key => {
        if (typeof payloadObj[key] === 'object') {
          payloadObj[key] = JSON.stringify(payloadObj[key]);
        }
      });

      // Sync back to Google Sheets
      const syncRes = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'sync',
          sheet: 'Orders',
          payload: payloadObj
        })
      });

      const responseText = await syncRes.text();
      console.log(`Status for ${name}:`, syncRes.status, responseText);
      restoredCount++;
      
    } catch (e) {
      console.error(`Failed to process ${name} (${id}):`, e.message);
    }
  }

  console.log(`\nRestoration complete. Restored ${restoredCount}/${Object.keys(targetIds).length} slips.`);
  process.exit(0);
}

run().catch(console.error);
