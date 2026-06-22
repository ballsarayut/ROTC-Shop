import dotenv from "dotenv";
dotenv.config();

const SCRIPT_URL = process.env.VITE_GOOGLE_SHEET_URL || "https://script.google.com/macros/s/AKfycbyCb7Byo0Zn8-VtxQ-6xwy0K0UR42s_8U4zcUfR6ReFl1ILZ18Nt-dvJLk1dd6VtgEI/exec";

async function syncRecord(sheet: string, payload: any) {
  const sanitizedPayload = { ...payload };
  Object.keys(sanitizedPayload).forEach((key) => {
    const val = sanitizedPayload[key];
    if (val && typeof val === "object") {
      sanitizedPayload[key] = JSON.stringify(val);
    }
  });

  const response = await fetch(SCRIPT_URL as string, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "sync", sheet, payload: sanitizedPayload }),
  });
  const text = await response.text();
  console.log("Response:", text);
}

fetch((SCRIPT_URL || "") + "?action=read&sheet=Orders")
  .then(r => r.json())
  .then(async (data: any[]) => {
    const brokenOrders = data.filter(d => (Array.isArray(d.items) && d.items.length === 0) || d.items === '[]' || d.items === '""');
    console.log("Broken orders count:", brokenOrders.length);
    
    // Default items to reset
    const defaultItems = [
      {
        productId: "xKwNaPzMOTiPj4ZkrLMA",
        name: "ชุดฝึกผ้าก้างปลา นศท.ชาย, หญิง",
        price: 810,
        gender: "ชาย",
        quantity: 1,
        imageUrl: "https://down-th.img.susercontent.com/file/3720719dab6537a427e163bbee1c33c3",
        size: "M",
      },
    ];

    const chunk = brokenOrders.slice(0, Math.min(27, brokenOrders.length)); // let's try 30
    console.log(`Fixing chunk`);
    await Promise.allSettled(chunk.map(async (o: any) => {
      o.items = JSON.stringify(defaultItems);
      await syncRecord("Orders", o);
    }));
    console.log("Done");
  }).catch(e => console.error(e));
