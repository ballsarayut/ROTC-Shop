import dotenv from 'dotenv';
dotenv.config();

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const SCRIPT_URL = process.env.VITE_GOOGLE_SHEET_URL;

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

async function forceSync() {
  const snapshot = await db.collection('orders').get();
  const orders = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

  console.log(`Found ${orders.length} orders.`);

  let synced = 0;
  for (const record of orders) {
    if (record.isEmbroidered || record.isOrdered || ['TRUE', 'FALSE', true, false].includes(record.isEmbroidered)) {
      
      const payloadToSync = { ...record };
      
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
          // keep as is
        } else if (val && typeof val === 'object' && val.toDate) {
          payloadToSync[key] = val.toDate().toISOString();
        } else if (val instanceof Date) {
          payloadToSync[key] = val.toISOString();
        } else if (val && typeof val === 'object') {
          payloadToSync[key] = JSON.stringify(val);
        }
      });
      
      // Ensure specific keys
      if ('isEmbroidered' in payloadToSync) {
         if (payloadToSync.isEmbroidered === true) payloadToSync.isEmbroidered = "TRUE";
         if (payloadToSync.isEmbroidered === false) payloadToSync.isEmbroidered = "FALSE";
      }
      if ('isOrdered' in payloadToSync) {
         if (payloadToSync.isOrdered === true) payloadToSync.isOrdered = "TRUE";
         if (payloadToSync.isOrdered === false) payloadToSync.isOrdered = "FALSE";
      }

      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ action: "sync", sheet: 'Orders', payload: payloadToSync }),
      });
      console.log(`Synced ${record.id}: isEmbroidered=${payloadToSync.isEmbroidered}, isOrdered=${payloadToSync.isOrdered}, ok=${res.ok}`);
      synced++;
    }
  }
  console.log(`Finished, synced ${synced} docs.`);
}

forceSync().catch(console.error);
