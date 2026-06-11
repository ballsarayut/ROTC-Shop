const fs = require('fs');
const content = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

const sIdx = content.indexOf('const PrintOrdersManagement =');
let eIdx = content.indexOf('  };\n\n  return (', sIdx);
if (eIdx === -1) {
  eIdx = content.indexOf('  const printStyles = ', sIdx);
}
if (eIdx === -1) {
  eIdx = content.indexOf('          <PrintOrdersManagement', sIdx);
}

const componentCode = content.substring(sIdx, content.indexOf('  };', sIdx) + 4);
fs.writeFileSync('/tmp/PrintOrders.tsx', componentCode);
console.log("Extracted to /tmp/PrintOrders.tsx, length:", componentCode.length);
