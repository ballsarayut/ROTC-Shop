import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, limit } from 'firebase/firestore';

const app = initializeApp(JSON.parse(process.env.FIREBASE_CONFIG || '{}'));
const db = getFirestore(app);

async function run() {
  const q = query(collection(db, 'orders'), limit(5));
  const snap = await getDocs(q);
  console.log('Orders found:', snap.docs.length);
  snap.docs.forEach(d => console.log(d.id, d.data().totalAmount));
}

run().catch(console.error);
