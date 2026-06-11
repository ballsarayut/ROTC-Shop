const fs = require('fs');

const mappings = {
  'เสื้อยืดรองในสีกากี (มีทั้งคอวีและคอกลม)': 'https://img2.pic.in.th/521677.jpg',
  'สายรัดข้อเท้า (สีดำ)': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR-Hgwh8q9CmtJ961sp-A8XdmV-e1e14tcjyA&s',
  'เครื่องหมาย นศท. (สังกัด)': 'https://img2.pic.in.th/521664.jpg',
  'ค่าเครื่องสนาม (เป้, กระติกน้ำ, สายโยงบ่า, เข็มขัดสนาม)': 'https://img1.pic.in.th/images/ChatGPT-Image-May-19-2026-03_26_37-PM.png',
};

let content = fs.readFileSync('src/data/initialProducts.ts', 'utf8');

for (const [name, url] of Object.entries(mappings)) {
  const escapedName = name.replace(/[.*+?^$\\{\\}()|[\\]\\\\]/g, '\\\\$&');
  const regex = new RegExp(`(name:\\s*['"]` + escapedName  + `['"][\\s\\S]*?imageUrl:\\s*['"])(.*?)(['"])`);
  content = content.replace(regex, `$1${url}$3`);
}

fs.writeFileSync('src/data/initialProducts.ts', content);
console.log('Updated initialProducts.ts');
