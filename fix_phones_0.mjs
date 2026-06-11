import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const SCRIPT_URL = process.env.VITE_GOOGLE_SHEET_URL;

const cfg = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(cfg);
const db = getFirestore(app, "ai-studio-e4f0f369-8adb-4d0d-987e-a47ef3344bd0");

async function fixPhones() {
  const snap = await getDocs(collection(db, 'orders'));
  const fsOrders = snap.docs.map(d => ({id: d.id, ...d.data() }));

  const oRes = await fetch(SCRIPT_URL + "?action=read&sheet=Orders");
  const sheetOrders = await oRes.json();

  let toUpdate = [];
  for (const fsOrder of fsOrders) {
      if (fsOrder.phone) {
          const sOrder = sheetOrders.find(o => o.id === fsOrder.id);
          if (sOrder && (String(sOrder.phone) !== String(fsOrder.phone)) && String(sOrder.phone) === String(fsOrder.phone).substring(1)) {
              console.log("Fixing phone for", sOrder.id, fsOrder.phone);
              const payloadObj = { ...sOrder };
              
              // Apply phone with quote
              let p = String(fsOrder.phone);
              if (p && !p.startsWith('0')) p = '0' + p;
              payloadObj.phone = "'" + p;

              Object.keys(payloadObj).forEach(key => {
                  if (typeof payloadObj[key] === 'object') {
                      payloadObj[key] = JSON.stringify(payloadObj[key]);
                  }
              });
              toUpdate.push(payloadObj);
          } else if (sOrder && (!String(sOrder.phone).startsWith('0'))) {
              // Just in case, if it should start with 0
              let p = String(sOrder.phone);
              if (p && !p.startsWith('0')) p = '0' + p;
              console.log("Adding 0 to", sOrder.id, p);
              const payloadObj = { ...sOrder };
              payloadObj.phone = "'" + p;
              Object.keys(payloadObj).forEach(key => {
                  if (typeof payloadObj[key] === 'object') {
                      payloadObj[key] = JSON.stringify(payloadObj[key]);
                  }
              });
              toUpdate.push(payloadObj);
          }
      }
  }

  console.log("Updating", toUpdate.length, "phones...");
  // update
  for(let i=0; i<toUpdate.length; i+=10) {
      const chunk = toUpdate.slice(i, i+10);
      await Promise.all(chunk.map(payloadObj => {
          return fetch(SCRIPT_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain' },
              body: JSON.stringify({ action: 'sync', sheet: 'Orders', payload: payloadObj }),
          }).then(res => res.text()).then(t => console.log("Fixed", payloadObj.id));
      }));
  }
  process.exit();
}
fixPhones();
