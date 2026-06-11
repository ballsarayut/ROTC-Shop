import fetch from 'node-fetch';

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyCb7Byo0Zn8-VtxQ-6xwy0K0UR42s_8U4zcUfR6ReFIlILZ18Nt-dvJLk1dd6VtgEI/exec";

async function testWithLen(len) {
  console.log(`\nTesting with string length: ${len}...`);
  const dummyString = "data:image/jpeg;base64," + "A".repeat(len - 23);

  // Read current row state first
  const readRes = await fetch(`${SCRIPT_URL}?action=read&sheet=Orders`);
  const orders = await readRes.json();
  const o = orders.find(x => x.id === 'rauspOpZgU6EPvaFe0fb');

  // Sync
  const payload = { ...o, paymentRef: dummyString };
  const writeRes = await fetch(SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'sync',
      sheet: 'Orders',
      payload: payload
    })
  });

  console.log("Write response status:", writeRes.status);
  console.log("Write response body:", await writeRes.text());

  // Verify
  const readRes2 = await fetch(`${SCRIPT_URL}?action=read&sheet=Orders`);
  const orders2 = await readRes2.json();
  const o2 = orders2.find(x => x.id === 'rauspOpZgU6EPvaFe0fb');
  console.log(`Verified length in sheet: ${o2?.paymentRef?.length || 0}`);
}

async function run() {
  await testWithLen(10000);   // 10K
  await testWithLen(45000);   // 45K (near standard 50KB limit card)
  await testWithLen(85000);   // 85K
}

run();
