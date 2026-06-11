import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = firebaseConfig.firestoreDatabaseId ? getFirestore(app, firebaseConfig.firestoreDatabaseId) : getFirestore(app);

async function run() {
  const snap = await getDocs(collection(db, 'products'));
  const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log("Current Products in Firestore:");
  for (const p of products) {
    if (p.name.includes("รองเท้า") || p.name.includes("ค่าจ้างเย็บ") || p.name.includes("ป้ายชื่อ") || p.name.includes("ถุงเท้า")) {
        console.log(`- ${p.name}: ${p.price}`);
    }
  }
  process.exit(0);
}
run();
