import fetch from 'node-fetch';

const PROJECT_ID = "continual-webbing-dsjh2";
const DATABASE_ID = "ai-studio-e4f0f369-8adb-4d0d-987e-a47ef3344bd0";

async function check(id, name) {
  const restUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/orders/${id}`;
  const res = await fetch(restUrl);
  console.log(`\n--- Result for ${name} (${id}) ---`);
  console.log(`Status code: ${res.status}`);
  const json = await res.json();
  if (res.ok) {
    const fields = json.fields || {};
    console.log("Keys in FS document:", Object.keys(fields));
    console.log("paymentRef in FS:", fields.paymentRef ? fields.paymentRef.stringValue ? fields.paymentRef.stringValue.substring(0, 50) + "..." : "not string" : "empty");
    console.log("slipUrl in FS:", fields.slipUrl ? fields.slipUrl.stringValue ? fields.slipUrl.stringValue.substring(0, 50) + "..." : "not string" : "empty");
  } else {
    console.log("Error:", json.error?.message || json);
  }
}

async function run() {
  await check("4iOjTrtZ34pWcDYQZrjy", "ณัทธร โอฬาริ");
  await check("BZACRRGG", "สลิลทิพย์ คงทอง");
  await check("rauspOpZgU6EPvaFe0fb", "ณัฐวลัญช์ บุษย์เพชร");
  await check("2SR2KXlowWH6Yx4ucvJr", "บูระณิมา บุญทองเล็ก");
}

run();
