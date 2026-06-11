import fetch from 'node-fetch';

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyCb7Byo0Zn8-VtxQ-6xwy0K0UR42s_8U4zcUfR6ReFIlILZ18Nt-dvJLk1dd6VtgEI/exec";

const ids = [
  'yUz3sNCjRTsaoOqymg9F',
  'u62J62VsnNMfQML04Ahd',
  'R93nB1QS8Gm8QWONNOwt'
];

async function run() {
  const res = await fetch(`${SCRIPT_URL}?action=read&sheet=Orders`);
  const orders = await res.json();
  for (const id of ids) {
    const o = orders.find(x => x.id === id);
    if (o) {
      console.log(`ID: ${id}, Name: ${o.fullName}`);
      console.log(`  slipUrl length: ${o.slipUrl ? o.slipUrl.length : 0}`);
      console.log(`  paymentRef length: ${o.paymentRef ? o.paymentRef.length : 0}`);
      if (o.paymentRef) console.log(`  paymentRef start: ${o.paymentRef.substring(0, 50)}`);
      if (o.slipUrl) console.log(`  slipUrl start: ${o.slipUrl.substring(0, 50)}`);
    } else {
      console.log(`ID: ${id} NOT FOUND`);
    }
  }
}
run();
