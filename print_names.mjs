import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const SCRIPT_URL = process.env.VITE_GOOGLE_SHEET_URL;

async function printAllNames() {
    const sheetRes = await fetch(`${SCRIPT_URL}?action=read&sheet=Orders`);
    const sheetOrders = await sheetRes.json();
    const names = sheetOrders.map(o => o.fullName);
    fs.writeFileSync('all_names.txt', names.join('\n'));
    console.log("Written to all_names.txt");
}

printAllNames();
