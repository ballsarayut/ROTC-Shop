import fetch from 'node-fetch';

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyCb7Byo0Zn8-VtxQ-6xwy0K0UR42s_8U4zcUfR6ReFIlILZ18Nt-dvJLk1dd6VtgEI/exec";

async function run() {
  const readRes = await fetch(`${SCRIPT_URL}?action=read&sheet=Orders`);
  const orders = await readRes.json();
  const o = orders.find(x => x.id === 'rauspOpZgU6EPvaFe0fb');
  console.log("Current paymentRef in Google Sheet:");
  console.log("Length:", o?.paymentRef?.length || 0);
  console.log("Starts with:", o?.paymentRef ? o.paymentRef.substring(0, 50) : "empty");
}

run();
