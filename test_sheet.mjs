import dotenv from 'dotenv';
dotenv.config();

const SCRIPT_URL = process.env.VITE_GOOGLE_SHEET_URL;
async function run() {
    const url = `${SCRIPT_URL}?action=read&sheet=Products`;
    const response = await fetch(url);
    const products = await response.json();
    for (const p of products) {
        if (p.name && (p.name.includes("รองเท้า") || p.name.includes("ค่าจ้างเย็บ") || p.name.includes("ป้ายชื่อ") || p.name.includes("ถุงเท้า"))) {
            console.log(`- ${p.name}: ${p.price}`);
        }
    }
}
run();
