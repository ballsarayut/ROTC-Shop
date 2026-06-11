import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, query, where, addDoc } from 'firebase/firestore';
import fs from 'fs';

const rawConfig = fs.readFileSync('firebase-applet-config.json', 'utf8');
const firebaseConfig = JSON.parse(rawConfig);
const app = initializeApp(firebaseConfig);
const db = firebaseConfig.firestoreDatabaseId ? getFirestore(app, firebaseConfig.firestoreDatabaseId) : getFirestore(app);

const missingProduct = {
  "name": "เสื้อยืดรองในสีกากี (มีทั้งคอวีและคอกลม)",
  "description": "เสื้อยืดคอกลมสีกากี สำหรับสวมใส่ด้านในชุดฝึก",
  "price": 90,
  "category": "ชุดฝึก/เครื่องแบบ",
  "stock": 1000,
  "imageUrl": "https://img2.pic.in.th/521677.jpg",
  "sizes": [
    "S",
    "M",
    "L",
    "XL",
    "2XL"
  ],
  "createdAt": new Date()
};

async function run() {
  const q = query(collection(db, 'products'));
  const snap = await getDocs(q);
  
  let found = false;
  for (const d of snap.docs) {
    if (d.data().name.includes('เสื้อยืดรองในสีกากี (มีทั้งคอวีและคอกลม)') && d.data().price === 90) {
      found = true;
      console.log('Already exists in DB: ', d.id);
    }
  }

  if (!found) {
    console.log('Adding missing product to DB...');
    await addDoc(collection(db, 'products'), missingProduct);
    console.log('Added successfully.');
  }

  process.exit(0);
}
run().catch(console.error);
