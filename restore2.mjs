import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc } from 'firebase/firestore';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const SCRIPT_URL = process.env.VITE_GOOGLE_SHEET_URL;

const cfg = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(cfg);
const db = getFirestore(app, "ai-studio-e4f0f369-8adb-4d0d-987e-a47ef3344bd0");

async function run() {
  console.log("Fetching orders from FS...");
  const snap = await getDocs(collection(db, 'orders'));
  const fsOrders = snap.docs.map(d => ({id: d.id, ...d.data() }));

  console.log("Fetching orders from Google Sheets...");
  const oRes = await fetch(SCRIPT_URL + "?action=read&sheet=Orders");
  const sheetOrders = await oRes.json();

  let restored = 0;
  const chunked = [];
  
  for (const fsOrder of fsOrders) {
    const sOrder = sheetOrders.find(o => o.id === fsOrder.id);
    if (!sOrder) continue;

    if (!fsOrder.items || fsOrder.items.length === 0) continue;

    const payloadObj = { ...sOrder };
    payloadObj.items = JSON.stringify(fsOrder.items);
    
    // Clean payload
    Object.keys(payloadObj).forEach(key => {
        if (typeof payloadObj[key] === 'object') {
            payloadObj[key] = JSON.stringify(payloadObj[key]);
        }
    });
    chunked.push(payloadObj);
  }

  // chunk by 10 to speed up
  for(let i=0; i<chunked.length; i+=10) {
      const chunk = chunked.slice(i, i+10);
      await Promise.all(chunk.map(payloadObj => {
          return fetch(SCRIPT_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain' },
              body: JSON.stringify({ action: 'sync', sheet: 'Orders', payload: payloadObj }),
          }).then(res => res.text()).then(t => console.log("Restored", payloadObj.id, t)).catch(e => console.error(e));
      }));
  }
  
  console.log("Fully Restored", chunked.length, "orders.");
  process.exit();
}
run();
