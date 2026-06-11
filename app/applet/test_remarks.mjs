import fetch from "node-fetch";

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyCb7Byo0Zn8-VtxQ-6xwy0K0UR42s_8U4zcUfR6ReFIlILZ18Nt-dvJLk1dd6VtgEI/exec";

async function run() {
  const res = await fetch(`${SCRIPT_URL}?action=read&sheet=Orders`);
  const orders = await res.json();
  const valid = orders.filter(o => o.remarks && o.remarks !== "");
  console.log("Orders with remarks:", valid.map(o => ({ id: o.id, remarks: o.remarks })));
}
run();
