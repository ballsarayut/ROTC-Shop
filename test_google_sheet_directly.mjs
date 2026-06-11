import fetch from 'node-fetch';

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyCb7Byo0Zn8-VtxQ-6xwy0K0UR42s_8U4zcUfR6ReFIlILZ18Nt-dvJLk1dd6VtgEI/exec";

async function run() {
  // Let's first read the row as it is
  const readRes = await fetch(`${SCRIPT_URL}?action=read&sheet=Orders`);
  const orders = await readRes.json();
  const o = orders.find(x => x.id === 'rauspOpZgU6EPvaFe0fb');
  console.log("Before sync:");
  console.log("Name:", o?.fullName);
  console.log("paymentRef length:", o?.paymentRef?.length || 0);

  // Let's modify it and sync
  const payload = { ...o, paymentRef: "TEST_PAYMENT_REF_12345" };
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

  // Read again
  const readRes2 = await fetch(`${SCRIPT_URL}?action=read&sheet=Orders`);
  const orders2 = await readRes2.json();
  const o2 = orders2.find(x => x.id === 'rauspOpZgU6EPvaFe0fb');
  console.log("After sync:");
  console.log("Name:", o2?.fullName);
  console.log("paymentRef:", o2?.paymentRef);
}

run();
