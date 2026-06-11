import fetch from "node-fetch";

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyCb7Byo0Zn8-VtxQ-6xwy0K0UR42s_8U4zcUfR6ReFIlILZ18Nt-dvJLk1dd6VtgEI/exec";

async function run() {
  const res = await fetch(`${SCRIPT_URL}?action=read&sheet=Orders`);
  const orders = await res.json();
  const orderWithRemark = orders.find(o => o.id === "#EK7FWL6N" || o.id === "#MU6QHR1Y");
  console.log("Found order:", orderWithRemark ? orderWithRemark.id : "No");
  if(orderWithRemark) {
      console.log("Remarks field:", orderWithRemark.remarks);
      console.log("All fields:", Object.keys(orderWithRemark));
  }
}
run();
