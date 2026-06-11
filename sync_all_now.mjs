import dotenv from 'dotenv';
dotenv.config();

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';

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

async function forceSync() {
  const snapshot = await getDocs(collection(db, 'orders'));
  const orders = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

  console.log(`Found ${orders.length} orders. Processing...`);

  let synced = 0;
  for (const record of orders) {
    // Only resync if we have specific status!
    const isEmbroidered = [true, "TRUE", "true"].includes(record.isEmbroidered);
    const isOrdered = [true, "TRUE", "true"].includes(record.isOrdered);
    
    if (isEmbroidered || isOrdered || record.isEmbroidered != null || record.isOrdered != null) {
      
      const payloadToSync = { ...record, isEmbroidered, isOrdered };
      
      // Transform logic
      Object.keys(payloadToSync).forEach(key => {
        const val = payloadToSync[key];
        if (key === 'phone') {
          let phoneStr = String(val || '');
          if (phoneStr.startsWith("'")) phoneStr = phoneStr.substring(1);
          if (phoneStr && !phoneStr.startsWith('0')) {
             phoneStr = '0' + phoneStr;
          }
          payloadToSync[key] = `'${phoneStr}`;
        } else if (typeof val === 'boolean') {
          payloadToSync[key] = val ? "TRUE" : "FALSE";
        } else if (val === 'TRUE' || val === 'FALSE') {
          // keep
        } else if (val && typeof val === 'object' && val.toDate) {
          payloadToSync[key] = val.toDate().toISOString();
        } else if (val instanceof Date) {
          payloadToSync[key] = val.toISOString();
        } else if (val && typeof val === 'object') {
          payloadToSync[key] = JSON.stringify(val);
        }
      });
      
      // Force string just in case
      payloadToSync.isEmbroidered = isEmbroidered ? "TRUE" : "FALSE";
      payloadToSync.isOrdered = isOrdered ? "TRUE" : "FALSE";

      // Re-hydrate items if missing
      if (!payloadToSync.items || payloadToSync.items.length === 0) {
          payloadToSync.items = payloadToSync.itemsRaw || payloadToSync._rawItems || [];
      }
      delete payloadToSync.itemsRaw;
      delete payloadToSync._rawItems;

      let success = false;
      let retries = 3;
      while(!success && retries > 0) {
        try {
          const res = await fetch(SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "sync", sheet: 'Orders', payload: payloadToSync }),
          });
          if (res.ok) success = true;
        } catch (e) {
          retries--;
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      process.stdout.write(success ? '.' : 'F');
      synced++;
    }
  }
  console.log(`\nFinished, synced ${synced} docs.`);
}

forceSync().catch(console.error);
