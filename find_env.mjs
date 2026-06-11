import fs from 'fs';
const files = fs.readdirSync('.');
console.log(files.filter(f => f.startsWith('.env')));
