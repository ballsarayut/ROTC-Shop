import fs from 'fs';
let content = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

// Replace the html2pdf logic with window.print() + onafterprint
const pdfLogic1 = /if \('\$\{action\}' === 'pdf'\) \{[\s\S]*?window\.html2pdf\(\)\.set\(opt\)[\s\S]*?\.catch\(console\.error\);\s*\} else \{/g;
content = content.replace(pdfLogic1, `
                  if ('\${action}' === 'pdf') {
                    document.title = 'shipping_label_\${order?.id || "label"}';
                    setTimeout(() => window.print(), 500);
                  } else {`);

const pdfLogic2 = /if \('\$\{currentAction\}' === 'pdf' \|\| '\$\{currentAction\}' === 'pdf_not_ordered'\) \{[\s\S]*?window\.html2pdf\(\)\.set\(opt\)[\s\S]*?\.catch\(console\.error\);\s*\} else \{/g;
content = content.replace(pdfLogic2, `
                  if ('\${currentAction}' === 'pdf' || '\${currentAction}' === 'pdf_not_ordered') {
                    document.title = 'order_report_\${dateStr}';
                    setTimeout(() => window.print(), 500);
                  } else {`);

const pdfLogic3 = /if \(\$\{isLargeDoc\}\) \{[\s\S]*?window\.print\(\);\s*\} else \{[\s\S]*?const element = document\.getElementById\('pdf-content'\);[\s\S]*?window\.html2pdf\(\)\.set\(opt\)[\s\S]*?\.catch\(console\.error\);\s*\}/g;
content = content.replace(pdfLogic3, `window.print();`);

const scriptHtml2Pdf = /<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/html2pdf\.js\/0\.10\.1\/html2pdf\.bundle\.min\.js"><\/script>/g;
content = content.replace(scriptHtml2Pdf, '');

fs.writeFileSync('src/pages/AdminDashboard.tsx', content);
