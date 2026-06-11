const fs = require('fs');

function unescapeReplacement(path, oldStr, newStr) {
  let content = fs.readFileSync(path, 'utf8');
  content = content.replace(new RegExp(oldStr, 'g'), newStr);
  fs.writeFileSync(path, content);
}

unescapeReplacement('src/pages/Home.tsx', "includes\\\\\\('รองเท้าประกอบชุดฝึก'\\\\\\)", "includes('รองเท้าประกอบชุดฝึก')");
unescapeReplacement('src/pages/ProductDetail.tsx', "includes\\\\\\('รองเท้าประกอบชุดฝึก'\\\\\\)", "includes('รองเท้าประกอบชุดฝึก')");

unescapeReplacement('src/pages/Home.tsx', "getProductForRecommendedItem\\\\\\('รองเท้าประกอบชุดฝึก'\\\\\\)", "getProductForRecommendedItem('รองเท้าประกอบชุดฝึก')");
unescapeReplacement('src/pages/Home.tsx', "includes\\\\\\('เสื้อยืดรองในสีกากี'\\\\\\)", "includes('เสื้อยืดรองในสีกากี')");
unescapeReplacement('src/pages/Home.tsx', "getProductForRecommendedItem\\\\\\('หมวกแบเร่ต์ รด. สีเขียวขี้ม้า พร้อมหน้าหมวก'\\\\\\)", "getProductForRecommendedItem('หมวกแบเร่ต์ รด. สีเขียวขี้ม้า พร้อมหน้าหมวก')");
