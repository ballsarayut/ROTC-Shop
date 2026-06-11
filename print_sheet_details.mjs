import fetch from 'node-fetch';

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyCb7Byo0Zn8-VtxQ-6xwy0K0UR42s_8U4zcUfR6ReFIlILZ18Nt-dvJLk1dd6VtgEI/exec";

const targetNames = [
  "ณัฐวลัญช์ บูษย์เพชร",
  "ณัฐวลัญช์ บุษย์เพชร",
  "บูระณิมา บุญทองเล็ก",
  "ณัทธร โอฬาริ",
  "สลิลทิพย์ คงทอง"
];

async function run() {
  const res = await fetch(`${SCRIPT_URL}?action=read&sheet=Orders`);
  const orders = await res.json();
  
  for (const name of targetNames) {
    const matched = orders.filter(x => x.fullName && x.fullName.includes(name.trim()));
    console.log(`\n=== Matches for "${name}" (Found: ${matched.length}) ===`);
    matched.forEach((o, i) => {
      console.log(`Match #${i + 1}:`, JSON.stringify(o, null, 2));
    });
  }
}
run();
