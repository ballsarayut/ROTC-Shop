import fs from 'fs';
let content = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

const regex1 = /if \(action === "pdf"\) \{[\s\S]*?printWindow = iframe\.contentWindow;\s*\} else \{\s*printWindow = window\.open\("", "_blank"\);\s*\}/g;
content = content.replace(regex1, `printWindow = window.open("", "_blank");`);

const regex2 = /if \(currentAction === "pdf" \|\| currentAction === "pdf_not_ordered"\) \{[\s\S]*?printWindow = iframe\.contentWindow;\s*\} else \{\s*printWindow = window\.open\("", "_blank"\);\s*\}/g;
content = content.replace(regex2, `printWindow = window.open("", "_blank");`);

const regex3 = /if \(!isLargeDoc\) \{[\s\S]*?printWindow = iframe\.contentWindow;\s*\} else \{\s*printWindow = window\.open\("", "_blank"\);\s*\}/g;
content = content.replace(regex3, `printWindow = window.open("", "_blank");`);

fs.writeFileSync('src/pages/AdminDashboard.tsx', content);
