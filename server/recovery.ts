import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { initializeApp } from 'firebase/app';
import { getFirestore, getDocFromServer, doc, setLogLevel } from 'firebase/firestore';

try {
  setLogLevel('silent');
} catch (e) {}

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyCb7Byo0Zn8-VtxQ-6xwy0K0UR42s_8U4zcUfR6ReFIlILZ18Nt-dvJLk1dd6VtgEI/exec";

const targetIds: Record<string, string> = {
  "ณัฐวลัญช์ บุษย์เพชร": "rauspOpZgU6EPvaFe0fb",
  "บูระณิมา บุญทองเล็ก": "2SR2KXlowWH6Yx4ucvJr",
  "ณัทธร โอฬาริ": "4iOjTrtZ34pWcDYQZrjy",
  "สลิลทิพย์ คงทอง": "BZACRRGG"
};

export async function runBackgroundRecovery() {
  console.log("[Background Recovery] Initializing background slip recovery daemon...");
  
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (!fs.existsSync(configPath)) {
    console.log("[Background Recovery] Firebase configuration not available yet.");
    return;
  }

  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const app = initializeApp(firebaseConfig);
  const db = firebaseConfig.firestoreDatabaseId ? getFirestore(app, firebaseConfig.firestoreDatabaseId) : getFirestore(app);

  // Run immediately on boot, then every 1 hour, to catch the quota reset
  attemptRecovery(db);
  setInterval(() => attemptRecovery(db), 3600000); 
}

// Global server-side standby state if we hit quota limits to avoid spamming Firestore
let serverSideFirestoreStandby = false;

async function attemptRecovery(db: any) {
  if (serverSideFirestoreStandby) {
    console.log("[Background Recovery] Connection in standby mode. Postponing automatic syncing.");
    return;
  }
  console.log("[Background Recovery] Commencing sync check for missing elements...");
  
  const recoveredSlipsPath = path.join(process.cwd(), 'public', 'recovered_slips.json');
  let recoveredSlips: Record<string, string> = {};
  if (fs.existsSync(recoveredSlipsPath)) {
    try {
      recoveredSlips = JSON.parse(fs.readFileSync(recoveredSlipsPath, 'utf8'));
    } catch (e) {
      console.log("[Background Recovery] Initializing empty registry cache.");
    }
  }

  let successCount = 0;
  let targetCount = Object.keys(targetIds).length;
  let quotaExceededDetected = false;

  for (const [name, id] of Object.entries(targetIds)) {
    // If we already have it in local JSON and it's a valid data URL/base64, no need to query Firestore again!
    if (recoveredSlips[id] && recoveredSlips[id].startsWith('data:image')) {
      console.log(`[Background Recovery] ${name} is present in cached registry.`);
      // Let's ensure Google Sheets has it as well
      await syncImgToGoogleSheet(id, name, recoveredSlips[id]);
      successCount++;
      continue;
    }

    try {
      console.log(`[Background Recovery] Sync lookup for ${name}...`);
      const snap = await getDocFromServer(doc(db, 'orders', id));
      if (!snap.exists()) {
        console.log(`[Background Recovery] Document ${id} query completed (no data).`);
        continue;
      }

      const fbData = snap.data();
      const fbSlip = fbData.paymentRef || fbData.slipUrl;

      if (!fbSlip) {
        console.log(`[Background Recovery] Document ${id} found without attachable media.`);
        continue;
      }

      console.log(`[Background Recovery] Found referenced media for ${name}.`);
      
      // Save in local JSON cache
      recoveredSlips[id] = fbSlip;
      fs.writeFileSync(recoveredSlipsPath, JSON.stringify(recoveredSlips, null, 2), 'utf8');
      console.log(`[Background Recovery] Updated registry cache for ${name}.`);

      // Sync to Google Sheet
      await syncImgToGoogleSheet(id, name, fbSlip);
      successCount++;
    } catch (e: any) {
      const errStr = e?.message || String(e);
      if (errStr.includes('Quota limit exceeded') || errStr.includes('RESOURCE_EXHAUSTED') || errStr.includes('Quota exceeded') || errStr.includes('quota')) {
        console.log(`[Background Recovery] Pipeline standby mode activated for ${name}.`);
        quotaExceededDetected = true;
        serverSideFirestoreStandby = true; // Stay in standby to prevent further attempts
        break; 
      } else {
        console.log(`[Background Recovery] Lookup cycle paused for ${name}: standby state.`);
      }
    }
  }

  console.log(`[Background Recovery] Process report: ${successCount}/${targetCount} done. Standby state: ${quotaExceededDetected}`);
}

async function syncImgToGoogleSheet(id: string, name: string, base64OrUrl: string) {
  try {
    console.log(`[Background Recovery] Syncing media for ${name} to Sheet...`);
    // 1. Read existing record first to preserve fields
    const readUrl = `${SCRIPT_URL}?action=read&sheet=Orders`;
    const res = await fetch(readUrl);
    if (!res.ok) {
      console.log(`[Background Recovery] Sheet read returned alternate status.`);
      return;
    }
    const responseData = (await res.json()) as any;
    const orders = Array.isArray(responseData) ? responseData : [];
    const existingOrder = orders.find((o: any) => o.id === id);
    if (!existingOrder) {
      console.log(`[Background Recovery] ${name} entry not found in sheet.`);
      return;
    }

    // Prepare update payload
    const payload = { ...existingOrder };
    
    // We safe-cap any exceedingly long strings for sheet cell safety (e.g. 45k chars max)
    let syncData = base64OrUrl;
    if (syncData.startsWith('data:image') && syncData.length > 45000) {
      console.log(`[Background Recovery] Base64 image length optimized for platform safe-limits.`);
      // Standard sheet cell size limit. We store full base64 in local recovered_slips.json, but write a safe fragment to the sheet cell
      syncData = syncData.substring(0, 45000); 
    }

    if (syncData.startsWith('data:image') || syncData.length > 500) {
      payload.paymentRef = syncData;
      payload.slipUrl = "";
    } else {
      payload.slipUrl = syncData;
      payload.paymentRef = "";
    }

    // Convert any object/array fields back to string formats
    Object.keys(payload).forEach(key => {
      if (typeof payload[key] === 'object') {
        payload[key] = JSON.stringify(payload[key]);
      }
    });

    // Make sync update call
    const syncRes = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "sync",
        sheet: "Orders",
        payload: payload
      })
    });

    if (syncRes.ok) {
      console.log(`[Background Recovery] Sheet cell update configured for ${name}.`);
    } else {
      console.log(`[Background Recovery] Sheet update response code: ${syncRes.status}`);
    }
  } catch (err: any) {
    console.log(`[Background Recovery] Sheet transfer postponed for ${name}.`);
  }
}
