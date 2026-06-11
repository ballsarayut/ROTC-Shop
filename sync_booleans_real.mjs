import dotenv from 'dotenv';
dotenv.config();

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const SCRIPT_URL = process.env.VITE_GOOGLE_SHEET_URL;

async function syncAllBooleans() {
  // 1. Fetch current rows from Google Sheet
  console.log("Fetching rows from Google Sheets...");
  const rs = await fetch(SCRIPT_URL + '?action=read&sheet=Orders');
  const sheetOrders = await rs.json();
  console.log(`Found ${sheetOrders.length} rows in Google Sheets.`);

  // 2. Fetch all orders from Firestore to have the source of truth in memory
  console.log("Fetching all orders from Firestore...");
  const fsSnapshot = await getDocs(collection(db, 'orders'));
  const fsOrdersMap = new Map();
  fsSnapshot.forEach(docSnap => {
    fsOrdersMap.set(docSnap.id, docSnap.data());
  });
  console.log(`Found ${fsOrdersMap.size} documents in Firestore.`);

  const pRecords = [];
  
  for (const sheetRecord of sheetOrders) {
    const id = sheetRecord.id;
    if (!id) continue;

    const fsRecord = fsOrdersMap.get(id) || {};
    
    // Determine target boolean values
    const isEmbroidered = fsRecord.isEmbroidered === true || fsRecord.isEmbroidered === "TRUE" || fsRecord.isEmbroidered === "true";
    const isOrdered = fsRecord.isOrdered === true || fsRecord.isOrdered === "TRUE" || fsRecord.isOrdered === "true";

    const payloadToSync = { ...sheetRecord };
    
    // Format payload similar to googleSheetService
    Object.keys(payloadToSync).forEach(key => {
      const val = payloadToSync[key];
      if (key === 'phone') {
        let phoneStr = String(val || '');
        if (phoneStr.startsWith("'")) phoneStr = phoneStr.substring(1);
        if (phoneStr && !phoneStr.startsWith('0')) phoneStr = '0' + phoneStr;
        payloadToSync[key] = `'${phoneStr}`;
      } else if (typeof val === 'boolean') {
        payloadToSync[key] = val ? "TRUE" : "FALSE";
      } else if (val && typeof val === 'object' && val.toDate) {
        payloadToSync[key] = val.toDate().toISOString();
      } else if (val instanceof Date) {
        payloadToSync[key] = val.toISOString();
      } else if (val && typeof val === 'object') {
        payloadToSync[key] = JSON.stringify(val);
      }
    });

    // Explicitly enforce capitalized "TRUE" / "FALSE" match to user's guidelines
    payloadToSync.isEmbroidered = isEmbroidered ? "TRUE" : "FALSE";
    payloadToSync.isOrdered = isOrdered ? "TRUE" : "FALSE";

    if (!payloadToSync.items || payloadToSync.items.length === 0) {
      payloadToSync.items = payloadToSync.itemsRaw || payloadToSync._rawItems || [];
    }
    delete payloadToSync.itemsRaw;
    delete payloadToSync._rawItems;

    pRecords.push(payloadToSync);
  }

  console.log(`Starting synchronization of ${pRecords.length} records...`);

  // -- Mode 1: Try Ultra-fast batchSync --
  console.log("Attempting ultra-fast batch synchronization...");
  try {
    const batchResponse = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "batchSync", sheet: 'Orders', payload: pRecords }),
    });
    const batchResult = await batchResponse.json();
    if (batchResult && batchResult.status === 'success') {
      console.log(`🎉 Successfully batch-synced all ${pRecords.length} records in one go!`);
      return;
    } else {
      console.log(`batchSync returned non-success response: ${JSON.stringify(batchResult)}. Falling back...`);
    }
  } catch (err) {
    console.log(`batchSync attempt failed (probably due to legacy Apps Script version): ${err.message}. Falling back...`);
  }

  // -- Mode 2: Sequential Fallback (safe, sequential, prevents spreadsheet locks) --
  console.log("Running safe sequential synchronization fallback...");
  let count = 0;
  for (const payload of pRecords) {
    try {
      const response = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "sync", sheet: 'Orders', payload }),
      });
      const resData = await response.json();
      count++;
      if (count % 10 === 0 || count === pRecords.length) {
        console.log(`Synced ${count}/${pRecords.length} records sequentially...`);
      }
    } catch (e) {
      console.warn(`Failed to sync record ${payload.id}: ${e.message}`);
    }
    // Subtle delay to alleviate sheet locking
    await new Promise(r => setTimeout(r, 100));
  }

  console.log("\nFinished fully synchronizing all sheet rows successfully.");
}

syncAllBooleans().catch(console.error);
