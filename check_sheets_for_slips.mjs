import fetch from 'node-fetch';

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyCb7Byo0Zn8-VtxQ-6xwy0K0UR42s_8U4zcUfR6ReFIlILZ18Nt-dvJLk1dd6VtgEI/exec";

const targetIds = {
  "ณัฐวลัญช์ บุษย์เพชร": "rauspOpZgU6EPvaFe0fb",
  "บูระณิมา บุญทองเล็ก": "2SR2KXlowWH6Yx4ucvJr",
  "ณัทธร โอฬาริ": "4iOjTrtZ34pWcDYQZrjy",
  "สลิลทิพย์ คงทอง": "BZACRRGG"
};

async function run() {
  console.log("Fetching orders from Google Sheets...");
  const res = await fetch(`${SCRIPT_URL}?action=read&sheet=Orders`);
  if (!res.ok) {
    throw new Error(`HTTP Error: ${res.status}`);
  }
  const orders = await res.json();
  console.log(`Fetched ${orders.length} orders from Google Sheets.`);

  for (const [name, id] of Object.entries(targetIds)) {
    const o = orders.find(item => item.id === id);
    if (!o) {
      console.log(`- ${name} (${id}) NOT FOUND in Google Sheets`);
    } else {
      console.log(`- ${name} (${id}):`);
      console.log(`  status: ${o.status}`);
      console.log(`  slipUrl length: ${o.slipUrl ? o.slipUrl.length : 0}`);
      console.log(`  paymentRef length: ${o.paymentRef ? o.paymentRef.length : 0}`);
    }
  }
}

run().catch(console.error);
