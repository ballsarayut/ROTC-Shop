const fs = require('fs');

function replaceStr(path, oldStr, newStr) {
  let content = fs.readFileSync(path, 'utf8');
  content = content.split(oldStr).join(newStr);
  fs.writeFileSync(path, content);
}

replaceStr('src/pages/Home.tsx', "includes\\('รองเท้าประกอบชุดฝึก'\\)", "includes('รองเท้าประกอบชุดฝึก')");
replaceStr('src/pages/ProductDetail.tsx', "includes\\('รองเท้าประกอบชุดฝึก'\\)", "includes('รองเท้าประกอบชุดฝึก')");
replaceStr('src/pages/Home.tsx', "getProductForRecommendedItem\\('รองเท้าประกอบชุดฝึก'\\)", "getProductForRecommendedItem('รองเท้าประกอบชุดฝึก')");
replaceStr('src/pages/Home.tsx', "includes\\('เสื้อยืดรองในสีกากี'\\)", "includes('เสื้อยืดรองในสีกากี')");
replaceStr('src/pages/Home.tsx', "getProductForRecommendedItem\\('หมวกแบเร่ต์ รด. สีเขียวขี้ม้า พร้อมหน้าหมวก'\\)", "getProductForRecommendedItem('หมวกแบเร่ต์ รด. สีเขียวขี้ม้า พร้อมหน้าหมวก')");
