import fetch from 'node-fetch';

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyCb7Byo0Zn8-VtxQ-6xwy0K0UR42s_8U4zcUfR6ReFIlILZ18Nt-dvJLk1dd6VtgEI/exec";

async function run() {
  const res = await fetch(`${SCRIPT_URL}?action=read&sheet=Orders`);
  const orders = await res.json();
  if (orders.length > 0) {
    console.log("Headers in Google Sheets:", Object.keys(orders[0]));
  } else {
    console.log("No orders found");
  }
}
run();
