import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import fs from 'fs';

const SCRIPT_URL = process.env.VITE_GOOGLE_SHEET_URL;

async function run() {
  const sheetRes = await fetch(SCRIPT_URL + "?action=read&sheet=Orders");
  const sheetData = await sheetRes.json();
  
  const id = 'R93nB1QS8Gm8QWONNOwt';
  const sheetRow = sheetData.find(row => row.id === id);
  if (sheetRow) {
      sheetRow.paymentRef = "THIS IS A TEST SMALL SLIP";
      
      const payloadObj = { ...sheetRow };
      Object.keys(payloadObj).forEach(key => {
        if (typeof payloadObj[key] === 'object') {
            payloadObj[key] = JSON.stringify(payloadObj[key]);
        }
      });
      const response = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync", sheet: 'Orders', payload: payloadObj }),
      });
      console.log(await response.text());
  }
}
run();
