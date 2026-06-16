const fs = require('fs');
const file = 'src/pages/AdminDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace all <td>${o.fullName}</td> with the new formatted version
content = content.replace(/<td>\$\{o\.fullName\}<\/td>/g, "<td>${o.fullName} ${(o.gender === 'ชาย' || o.gender === 'ช' || o.gender?.toLowerCase() === 'male' || o.gender?.toLowerCase() === 'm') ? '(ช)' : (o.gender === 'หญิง' || o.gender === 'ญ' || o.gender?.toLowerCase() === 'female' || o.gender?.toLowerCase() === 'f') ? '(ญ)' : ''}</td>");

// Replace the occurrence in printSignSheet
content = content.replace(/<td style="border: 1px solid #cad4cf; padding: 6px 10px; font-weight: bold; font-size: 12px; text-align: left;">\$\{o\.fullName\}<\/td>/g, "<td style=\"border: 1px solid #cad4cf; padding: 6px 10px; font-weight: bold; font-size: 12px; text-align: left;\">${o.fullName} ${(o.gender === 'ชาย' || o.gender === 'ช' || o.gender?.toLowerCase() === 'male' || o.gender?.toLowerCase() === 'm') ? '(ช)' : (o.gender === 'หญิง' || o.gender === 'ญ' || o.gender?.toLowerCase() === 'female' || o.gender?.toLowerCase() === 'f') ? '(ญ)' : ''}</td>");

fs.writeFileSync(file, content);
console.log('Update complete.');
