import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = firebaseConfig.firestoreDatabaseId ? getFirestore(app, firebaseConfig.firestoreDatabaseId) : getFirestore(app);

async function run() {
  const snap = await getDocs(collection(db, 'products'));
  const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log("Updating Products...");
  const updates = {
    'ถุงเท้าลูกฟูกสีดำ': 30
  };
  
  const updatePromises = [];
  for (const p of products) {
    if (updates[p.name]) {
        console.log(`Updating ${p.name} from ${p.price} to ${updates[p.name]}`);
        updatePromises.push(updateDoc(doc(db, 'products', p.id), { price: updates[p.name] }));
    }
  }
  await Promise.all(updatePromises);
  console.log("Done");
  process.exit(0);
}
run();
