import fs from 'fs';
let data = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

data = data.replace(
  /\$\{item\.name\} \(\$\{item\.size \|\| "-"\}\)/g,
  '${item.name} (${formatItemSize(item.name, item.size)})'
);

data = data.replace(
  /ขนาด: \{item\.size\}/g,
  'ขนาด: {formatItemSize(item.name, item.size)}'
);

data = data.replace(
  /\{item\.size \? \` \| ขนาด: \$\{item\.size\}\` : ""\}/g,
  '{item.size ? ` | ขนาด: ${formatItemSize(item.name, item.size)}` : ""}'
);

fs.writeFileSync('src/pages/AdminDashboard.tsx', data);
console.log('Replaced successfully');
