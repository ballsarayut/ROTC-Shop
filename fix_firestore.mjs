import fs from 'fs';
const file = 'src/pages/AdminDashboard.tsx';
let txt = fs.readFileSync(file, 'utf8');
txt = txt.replace(/import \{ doc, updateDoc \} from "firebase\/firestore";/g, 'import { doc, setDoc } from "firebase/firestore";');
txt = txt.replace(/updateDoc\(doc\(([^,]+),([^,]+),([^)]+)\),\s*({[^}]+})\)/g, 'setDoc(doc($1, $2, $3), $4, { merge: true })');
fs.writeFileSync(file, txt);
