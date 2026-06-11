import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

import { SCHOOL_DETAILS } from './src/constants.js'; // wait, it's TS, running through npx tsx

const SCRIPT_URL = process.env.VITE_GOOGLE_SHEET_URL;

async function run() {
  const oRes = await fetch(SCRIPT_URL + "?action=read&sheet=Schools");
  const schools = await oRes.json();
  
  if (!Array.isArray(schools)) {
      console.log("Failed to load schools", schools);
      process.exit(1);
  }

  let updatedCount = 0;
  let toUpdate = [];

  for (let i = 0; i < schools.length; i++) {
    const school = schools[i];
    let details = SCHOOL_DETAILS[school.name];

    if (!details) {
      const normalize = (name) =>
        name
          .replace(/รร\./g, "โรงเรียน")
          .replace(/ /g, "")
          .replace(/[๐-๙]/g, (d) =>
            "๐๑๒๓๔๕๖๗๘๙".indexOf(d).toString()
          );
      const normalizedSchoolName = normalize(school.name);

      const match = Object.entries(SCHOOL_DETAILS).find(
        ([key]) => normalize(key) === normalizedSchoolName
      );
      if (match) {
        details = match[1];
      }
    }

    if (details) {
      const needsUpdate = !school.shippingAddress || !school.contactPerson || !school.contactPhone;

      if (needsUpdate) {
        const updateData = {
          shippingAddress: (school.shippingAddress && school.shippingAddress !== "") ? school.shippingAddress : details.address,
          contactPerson: (school.contactPerson && school.contactPerson !== "") ? school.contactPerson : details.contact,
          contactPhone: (school.contactPhone && school.contactPhone !== "") ? school.contactPhone : details.phone,
          updatedAt: new Date().toISOString(),
        };

        const payloadObj = { id: school.id, ...school, ...updateData };
        Object.keys(payloadObj).forEach(key => {
            if (typeof payloadObj[key] === 'object') {
                payloadObj[key] = JSON.stringify(payloadObj[key]);
            }
        });
        
        toUpdate.push(payloadObj);
        updatedCount++;
      }
    }
  }

  console.log("Need to update:", updatedCount);
  for(let i=0; i<toUpdate.length; i+=10) {
      const chunk = toUpdate.slice(i, i+10);
      await Promise.all(chunk.map(payloadObj => {
          return fetch(SCRIPT_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain' },
              body: JSON.stringify({ action: 'sync', sheet: 'Schools', payload: payloadObj }),
          }).then(res => res.text()).then(t => console.log("Updated", payloadObj.name));
      }));
  }
}

run();
