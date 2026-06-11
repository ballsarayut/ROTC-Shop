import fs from 'fs';
let content = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

content = content.replace(/const handlePrint = async \(/g, 'const handlePrint = (');

fs.writeFileSync('src/pages/AdminDashboard.tsx', content);
