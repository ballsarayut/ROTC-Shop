const fs = require('fs');

const mappings = {
  'ชุดฝึกผ้าก้างปลา นศท.ชาย, หญิง': 'https://down-th.img.susercontent.com/file/3720719dab6537a427e600c78aba0574',
  'เสื้อยืดรองในสีกากี (มีทั้งคอวีและคอกลม)': 'https://img2.pic.in.th/521677.jpg',
  'หมวกแบเร่ต์ รด. สีเขียวขี้ม้า พร้อมหน้าหมวก': 'https://img.lazcdn.com/g/p/e3c40e61d43be981e9c428a6d328e0f3.jpg_720x720q80.jpg',
  'รองเท้าประกอบชุดฝึก': 'https://img2.pic.in.th/521673.jpg',
  'สายรัดข้อเท้า (สีดำ)': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR-Hgwh8q9CmtJ961sp-A8XdmV-e1e14tcjyA&s',
  'เหล็กชิดเท้าสีดำ': 'https://down-th.img.susercontent.com/file/th-11134207-7r98s-lnz6ofitmvxs3a',
  'เครื่องหมาย นศท. (สังกัด)': 'https://img2.pic.in.th/521664.jpg',
  'ถุงเท้าลูกฟูกสีดำ': 'https://down-th.img.susercontent.com/file/4441075e0485cd2991cb8359cdbe98e3',
  'เข็มขัด นศท. พร้อมหัวเข็มขัด': 'https://img1.pic.in.th/images/521670.jpg',
  'ค่าจ้างปักป้ายชื่อ': 'https://down-th.img.susercontent.com/file/th-11134207-7r98u-lyai8gll7icp4a',
  'ค่าจ้างปักเครื่องหมายสถานศึกษา': 'https://img2.pic.in.th/521699.jpg',
  'ค่าจ้างเย็บติดเครื่องหมายรวม 7 ชิ้น': 'https://img1.pic.in.th/images/1-2d57a09f8864c2141.png',
  'ค่าเครื่องสนาม (เป้, กระติกน้ำ, สายโยงบ่า, เข็มขัดสนาม)': 'https://img1.pic.in.th/images/ChatGPT-Image-May-19-2026-03_26_37-PM.png',
  'เครื่องหมายจิตอาสา': 'https://img2.pic.in.th/521696.jpg'
};

let content = fs.readFileSync('src/data/initialProducts.ts', 'utf8');

// The file has structures like:
// name: 'ชุดฝึกผ้าก้างปลา นศท.ชาย, หญิง',
// description: '...',
// price: 810,
// category: '...',
// stock: 10000,
// imageUrl: 'https://images.unsplash.com/...',

for (const [name, url] of Object.entries(mappings)) {
  const regex = new RegExp(`(name:\\s*['"]${name}['"][\\s\\S]*?imageUrl:\\s*['"])(.*?)(['"])`);
  content = content.replace(regex, `$1${url}$3`);
}

fs.writeFileSync('src/data/initialProducts.ts', content);
console.log('Updated initialProducts.ts');
