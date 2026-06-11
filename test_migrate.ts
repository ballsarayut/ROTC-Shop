import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const SCRIPT_URL = process.env.VITE_GOOGLE_SHEET_URL;
console.log('Script URL:', SCRIPT_URL);

const firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);

// Specify the custom database name!
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function test() {
  console.log('Testing Firestore getDocs with databaseid:', firebaseConfig.firestoreDatabaseId);
  const snap = await getDocs(collection(db, 'schools'));
  console.log('Firestore connected successfully! Current schools size:', snap.size);

  if (SCRIPT_URL) {
    console.log('Testing Google Sheets read...');
    const url = `${SCRIPT_URL}?action=read&sheet=TrainingCenters`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      console.log('Google Sheets connected successfully! Current centers:', data.length);
    } else {
      console.log('Google Sheets read returned status:', res.status);
    }
  }
}

test()
  .then(() => {
    console.log('Test completed successfully, exiting...');
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
