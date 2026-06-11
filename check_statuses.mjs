import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = firebaseConfig.firestoreDatabaseId ? getFirestore(app, firebaseConfig.firestoreDatabaseId) : getFirestore(app);

async function run() {
  const q = await getDocs(collection(db, 'orders'));
  const statuses = {};
  q.docs.forEach(d => {
    let s = d.data().status;
    if (s === undefined) s = "undefined";
    else if (s === null) s = "null";
    else if (s === "") s = "empty_string";
    statuses[s] = (statuses[s] || 0) + 1;
  });
  console.log('Statuses:', statuses);
  console.log('Total in Firestore:', q.docs.length);
  process.exit(0);
}
run();
