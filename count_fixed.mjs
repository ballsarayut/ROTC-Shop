import fs from 'fs';
const text = fs.readFileSync('fix_phones_0.log', 'utf8');
const lines = text.split('\n');
console.log(`Total lines: ${lines.length}`);
console.log(`Fixed count: ${lines.filter(l => l.includes('Fixed')).length}`);
