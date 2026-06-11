import fs from 'fs';
const file = 'src/pages/AdminDashboard.tsx';
let txt = fs.readFileSync(file, 'utf8');
txt = txt.replace(/const payloadToSync = /g, 'const payloadToSync: any = ');
// Also payload was used somewhere
txt = txt.replace(/const payload = /g, 'const payload: any = ');
fs.writeFileSync(file, txt);
