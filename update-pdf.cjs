const fs = require('fs');
const file = 'src/pages/AdminDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// Also fix product summary filtering
content = content.replace(/\(order\.items \|\| \[\]\)\.forEach\(/g, '(getFilteredItems(order.items || [])).forEach(');

fs.writeFileSync(file, content);
console.log("Updated product summary rendering");
