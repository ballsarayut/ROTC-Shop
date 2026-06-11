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
  for (const fsOrder of fsOrders) {
    const sOrder = sheetOrders.find(o => o.id === fsOrder.id);
    if (!sOrder) continue;

    // We only care if FS has items
    if (!fsOrder.items || fsOrder.items.length === 0) continue;

    // Check if what is in Sheet is practically same length
    let sItems = [];
    try { sItems = JSON.parse(sOrder.items); } catch(e){}

    // Restore if sheet doesn't have it or we overwrote it to have exactly 14 items without proper sizes
    // And to be safe, just restore FS items to Sheet to guarantee original customer data
    const payloadObj = { ...sOrder };
    payloadObj.items = JSON.stringify(fsOrder.items);
    
    // Clean payload
    Object.keys(payloadObj).forEach(key => {
        if (typeof payloadObj[key] === 'object') {
            payloadObj[key] = JSON.stringify(payloadObj[key]);
        }
    });

    const res = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'sync', sheet: 'Orders', payload: payloadObj }),
    });

    console.log("Restored", fsOrder.id, await res.text());
    restored++;
    // wait a bit to avoid rate limits
    await new Promise(r => setTimeout(r, 800));
  }
  
  console.log("Restored", restored, "orders.");
  process.exit();
}
run();
