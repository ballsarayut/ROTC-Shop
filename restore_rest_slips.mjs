import fs from 'fs';
import fetch from 'node-fetch';

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyCb7Byo0Zn8-VtxQ-6xwy0K0UR42s_8U4zcUfR6ReFIlILZ18Nt-dvJLk1dd6VtgEI/exec";
const PROJECT_ID = "continual-webbing-dsjh2";
const DATABASE_ID = "ai-studio-e4f0f369-8adb-4d0d-987e-a47ef3344bd0";

const targetIds = {
  "ณัทธร โอฬาริ": "4iOjTrtZ34pWcDYQZrjy",
  "สลิลทิพย์ คงทอง": "BZACRRGG"
};

async function run() {
  console.log("Starting targeted slip restoration using Firestore REST API...");
  
  // 1. Fetch current Sheet orders to ensure we preserve all other data
  console.log("Fetching existing orders from Google Sheets...");
  const sheetRes = await fetch(`${SCRIPT_URL}?action=read&sheet=Orders`);
  if (!sheetRes.ok) {
    throw new Error(`Failed to fetch Google Sheets data: StatusCode ${sheetRes.status}`);
  }
  const sheetOrders = await sheetRes.json();
  console.log(`Loaded ${sheetOrders.length} orders from Google Sheet.`);

  for (const [name, id] of Object.entries(targetIds)) {
    console.log(`\nProcessing ${name} (ID: ${id}) via REST API...`);
    
    // Find matching sheet row
    const sheetRow = sheetOrders.find(row => row.id === id);
    if (!sheetRow) {
      console.log(`Warning: Row with ID "${id}" for "${name}" not found in Google Sheets.`);
      continue;
    }

    try {
      // Fetch directly from Firestore REST API
      const restUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/orders/${id}`;
      const restRes = await fetch(restUrl);
      
      if (!restRes.ok) {
        const errorText = await restRes.text();
        console.log(`REST Error fetching ${id}: ${restRes.status} ${errorText}`);
        continue;
      }

      const fbDataWrapper = await restRes.json();
      // Extract fields from Firestore REST JSON format
      const fields = fbDataWrapper.fields || {};
      
      const paymentRefValue = fields.paymentRef && fields.paymentRef.stringValue ? fields.paymentRef.stringValue : "";
      const slipUrlValue = fields.slipUrl && fields.slipUrl.stringValue ? fields.slipUrl.stringValue : "";
      const fbSlip = paymentRefValue || slipUrlValue;

      if (!fbSlip) {
        console.log(`Error: Firestore document does not contain any slip images (paymentRef/slipUrl is empty).`);
        continue;
      }

      console.log(`Found slip! Length: ${fbSlip.length}. Syncing to Google Sheets...`);

      // Construct payload maintaining exactly existing row data isEmbroidered, isOrdered, etc.
      const payloadObj = { ...sheetRow };
      
      if (fbSlip.startsWith('data:image') || fbSlip.length > 500) {
        payloadObj.paymentRef = fbSlip;
        payloadObj.slipUrl = "";
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
      
    } catch (e) {
      console.error(`Failed to process ${name} (${id}):`, e.message);
    }
  }

  console.log("\nREST restoration script execution complete.");
}

run().catch(console.error);
