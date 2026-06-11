import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = firebaseConfig.firestoreDatabaseId ? getFirestore(app, firebaseConfig.firestoreDatabaseId) : getFirestore(app);

async function findOrders() {
    const names = ['ปิติพงษ์ เนียมนวล', 'จักรกฤษณ์ สุวรรณ์', 'กันตินันท์ ฮั่นตุ่น'];
    
    try {
        const q = query(collection(db, 'orders'), where('fullName', 'in', names));
        const snap = await getDocs(q);
        const orders = snap.docs.map(d => ({id: d.id, ...d.data()}));
        console.log("Found orders:", JSON.stringify(orders, null, 2));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

findOrders();
