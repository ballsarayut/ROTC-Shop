import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = firebaseConfig.firestoreDatabaseId ? getFirestore(app, firebaseConfig.firestoreDatabaseId) : getFirestore(app);

async function scan() {
    const snap = await getDocs(collection(db, 'orders'));
    const names = ['ปิติพงษ์', 'จักรกฤษณ์', 'กันตินันท์'];
    
    const found = snap.docs.map(d => ({id: d.id, ...d.data()})).filter(o => names.some(n => o.fullName && o.fullName.includes(n)));
    console.log(JSON.stringify(found, null, 2));
    process.exit(0);
}

scan();
