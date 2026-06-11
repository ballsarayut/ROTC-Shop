const fs = require('fs');
const content = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

const sIdx = content.indexOf('const PrintOrdersManagement =');
const printSettingsIdx = content.indexOf('  const [printSettings')

let eIdx = content.indexOf('\n  const ', sIdx + 100);
if(printSettingsIdx > -1) {
  eIdx = content.lastIndexOf('  };\n', printSettingsIdx);
}


const componentCode = content.substring(sIdx, eIdx + 4);
fs.writeFileSync('PrintOrders.tsx', componentCode);
console.log("Extracted to PrintOrders.tsx, length:", componentCode.length);
