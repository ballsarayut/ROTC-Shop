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

async function syncPart() {
  console.log("Fetching rows from Google Sheets...");
  const rs = await fetch(SCRIPT_URL + '?action=read&sheet=Orders');
  const sheetOrders = await rs.json();
  console.log(`Found ${sheetOrders.length} rows in Google Sheets.`);

  // Find remaining rows where isEmbroidered is blank/empty
  const rawEmptyRows = sheetOrders.filter(x => x.isEmbroidered === undefined || x.isEmbroidered === null || x.isEmbroidered === '');
  console.log(`Of those, ${rawEmptyRows.length} rows have empty isEmbroidered columns.`);

  if (rawEmptyRows.length === 0) {
    console.log("All rows are already synced! Nothing to do.");
    return;
  }

  // Take a batch of 15
  const limit = 15;
  const batchToSync = rawEmptyRows.slice(0, limit);
  console.log(`Syncing a batch of ${batchToSync.length} empty rows...`);

  // Fetch Firestore values
  console.log("Fetching orders state from Firestore...");
  const fsSnapshot = await getDocs(collection(db, 'orders'));
  const fsOrdersMap = new Map();
  fsSnapshot.forEach(docSnap => {
    fsOrdersMap.set(docSnap.id, docSnap.data());
  });

  const pRecords = [];
  for (const sheetRecord of batchToSync) {
    const fsRecord = fsOrdersMap.get(sheetRecord.id) || {};
    const isEmbroidered = fsRecord.isEmbroidered === true || fsRecord.isEmbroidered === "TRUE" || fsRecord.isEmbroidered === "true";
    const isOrdered = fsRecord.isOrdered === true || fsRecord.isOrdered === "TRUE" || fsRecord.isOrdered === "true";

    const payloadToSync = { ...sheetRecord };
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

    payloadToSync.isEmbroidered = isEmbroidered ? "TRUE" : "FALSE";
    payloadToSync.isOrdered = isOrdered ? "TRUE" : "FALSE";

    if (!payloadToSync.items || payloadToSync.items.length === 0) {
      payloadToSync.items = payloadToSync.itemsRaw || payloadToSync._rawItems || [];
    }
    delete payloadToSync.itemsRaw;
    delete payloadToSync._rawItems;

    pRecords.push(payloadToSync);
  }

  console.log("Updating on Google Sheets sequentially with small delay to ensure safety...");
  let count = 0;
  for (const payload of pRecords) {
    try {
      const resp = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "sync", sheet: 'Orders', payload }),
      });
      const resData = await resp.json();
      count++;
      process.stdout.write(`[${count}/${pRecords.length}] Synced id: ${payload.id}, isEmbroidered: ${payload.isEmbroidered}\n`);
    } catch (e) {
      console.warn(`Error syncing ${payload.id}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 120));
  }
  console.log(`Batch of ${count} rows synced successfully!`);
}

syncPart().catch(console.error);
