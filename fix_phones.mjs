import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const SCRIPT_URL = process.env.VITE_GOOGLE_SHEET_URL;

async function fixPhones() {
  console.log("Fetching orders from Google Sheets...");
  const sheetRes = await fetch(`${SCRIPT_URL}?action=read&sheet=Orders`);
  const sheetOrders = await sheetRes.json();
  
  let count = 0;
  for (const order of sheetOrders) {
    if (order.phone) {
      let phoneStr = String(order.phone);
      if (phoneStr.startsWith("'")) {
        phoneStr = phoneStr.substring(1);
      }
      if (!phoneStr.startsWith('0')) {
        phoneStr = '0' + phoneStr;
      }
      const newPhone = `'${phoneStr}`;
      
      if (String(order.phone) !== newPhone && String(order.phone) !== phoneStr) {
        console.log(`Updating order ${order.id} phone: ${order.phone} -> ${newPhone}`);
        // Only update the phone field to speed up, or just sync the record
        const payload = { ...order, phone: newPhone };
        
        await fetch(SCRIPT_URL, {
          method: "POST",
          body: JSON.stringify({
            action: "sync",
            sheet: "Orders",
            payload: payload
          })
        });
        await new Promise(r => setTimeout(r, 500));
        count++;
      }
    }
  }
  console.log(`Successfully updated ${count} orders.`);
}

fixPhones();
