import dotenv from 'dotenv';
dotenv.config();

const SCRIPT_URL = process.env.VITE_GOOGLE_SHEET_URL;

async function run() {
  console.log("Fetching products...");
  const pRes = await fetch(SCRIPT_URL + "?action=read&sheet=Products");
  const dProducts = await pRes.json();
  
  const productsMap = new Map();
  for (const p of dProducts) {
    if (p.name) productsMap.set(p.name.trim(), p);
  }

  const RECOMMENDED_ITEMS = [
    "ชุดฝึกผ้าก้างปลา นศท.ชาย, หญิง",
    "เสื้อยืดรองในสีกากีแกมเขียว  2 ตัว/แพ็ค",
    "หมวกแบเร่ต์ รด. สีเขียวขี้ม้า",
    "รองเท้าประกอบชุดฝึก",
    "ห่วงขาแบบผ้า",
    "เหล็กชิดเท้าสีดำ",
    "เครื่องหมาย นศท.",
    "ถุงเท้าลูกฟูกสีดำ",
    "สายเข็มขัด รด. พร้อมหัวเข็มขัดเหล็กสีรมดำ",
    "ค่าจ้างปักป้ายชื่อ",
    "ค่าจ้างปักเครื่องหมายสถานศึกษา",
    "ค่าจ้างเย็บติดเครื่องหมายรวม 7 ชิ้น",
    "ค่าเครื่องสนาม (เป้, กระติกน้ำ, สายโยงบ่า, เข็มขัดสนาม)",
    "เครื่องหมายจิตอาสา"
  ];

  const packageItems = [];
  let tPrice = 0;
  for (const name of RECOMMENDED_ITEMS) {
    const p = productsMap.get(name);
    if (p) {
        packageItems.push({
            productId: p.id,
            name: p.name,
            price: Number(p.price) || 0,
            quantity: 1,
            size: p.sizes ? (typeof p.sizes === 'string' ? p.sizes.split(',')[0] : p.sizes[0]) : "",
            gender: p.genders ? (typeof p.genders === 'string' ? p.genders.split(',')[0] : p.genders[0]) : "",
            imageUrl: p.imageUrl
        });
        tPrice += Number(p.price) || 0;
    }
  }

  console.log("Fetching Orders...");
  const oRes = await fetch(SCRIPT_URL + "?action=read&sheet=Orders");
  const orders = await oRes.json();
  
  let restored = 0;
  for (const o of orders) {
     if (Number(o.totalAmount) === 2390 || Number(o.subtotal) === 2390) {
         let currentItems = [];
         try {
             currentItems = JSON.parse(o.items);
         } catch (e) { }

         if (!Array.isArray(currentItems) || currentItems.length < 10) {
            console.log("Restoring order:", o.id);
            const size = currentItems[0] && currentItems[0].size ? currentItems[0].size : "M";
            const gender = currentItems[0] && currentItems[0].gender ? currentItems[0].gender : "ชาย";
            
            const newItems = JSON.parse(JSON.stringify(packageItems));
            for (const item of newItems) {
                if (item.name.includes("ชุดฝึก") || item.name.includes("รองเท้า")) {
                    item.size = size;
                    item.gender = gender;
                }
            }

            const payloadObj = { ...o };
            payloadObj.items = JSON.stringify(newItems);
            
            Object.keys(payloadObj).forEach(key => {
                if (typeof payloadObj[key] === 'object') {
                    payloadObj[key] = JSON.stringify(payloadObj[key]);
                }
            });

            // Post
            const res = await fetch(SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: 'sync', sheet: 'Orders', payload: payloadObj }),
            });
            console.log("Updated", o.id, await res.text());
            restored++;
            await new Promise(r => setTimeout(r, 1000));
         }
     }
  }
  
  console.log("Restored", restored, "orders.");
}

run();
