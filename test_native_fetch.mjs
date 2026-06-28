import fetch from 'node-fetch';

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyCb7Byo0Zn8-VtxQ-6xwy0K0UR42s_8U4zcUfR6ReFIlILZ18Nt-dvJLk1dd6VtgEI/exec";

async function testNativeFetch() {
  console.log("--- Native fetch ---");
  try {
    const url = `${SCRIPT_URL}?action=read&sheet=Orders&_t=${Date.now()}`;
    const res = await globalThis.fetch(url, { redirect: 'follow' });
    console.log("Status:", res.status);
    console.log("OK:", res.ok);
    const text = await res.text();
    console.log("Text length:", text.length);
    console.log("Text preview:", text.substring(0, 150));
  } catch (err) {
    console.error("Native fetch failed:", err);
  }

  console.log("--- node-fetch ---");
  try {
    const url = `${SCRIPT_URL}?action=read&sheet=Orders&_t=${Date.now()}`;
    const res = await fetch(url, { redirect: 'follow' });
    console.log("Status:", res.status);
    console.log("OK:", res.ok);
    const text = await res.text();
    console.log("Text length:", text.length);
    console.log("Text preview:", text.substring(0, 150));
  } catch (err) {
    console.error("node-fetch failed:", err);
  }
}

testNativeFetch();
