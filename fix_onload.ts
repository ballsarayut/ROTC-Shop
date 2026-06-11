import fs from 'fs';
let content = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

const regex1 = /window\.onload = \(\) => \{\s*document\.fonts\.ready\.then\(\(\) => \{\s*setTimeout\(\(\) => \{\s*if \('\$\{currentAction\}' === 'pdf' \|\| '\$\{currentAction\}' === 'pdf_not_ordered'\) \{\s*document\.title = 'order_report_\$\{dateStr\}';\s*setTimeout\(\(\) => window\.print\(\), 500\);\s*\} else \{\s*window\.print\(\);\s*\}\s*\}, 500\);\s*\}\);\s*\};/g;

content = content.replace(regex1, `
            const printCurrent = () => {
              if ('\${currentAction}' === 'pdf' || '\${currentAction}' === 'pdf_not_ordered') {
                document.title = 'order_report_\${dateStr}';
                setTimeout(() => window.print(), 500);
              } else {
                window.print();
              }
            };
            if (document.fonts) {
              document.fonts.ready.then(() => { setTimeout(printCurrent, 500); });
            } else {
              setTimeout(printCurrent, 500);
            }
`);

const regex2 = /window\.onload = \(\) => \{\s*document\.fonts\.ready\.then\(\(\) => \{\s*setTimeout\(\(\) => \{\s*if \('\$\{action\}' === 'pdf'\) \{\s*document\.title = 'shipping_label_\$\{order\?\.id \|\| "label"\}';\s*setTimeout\(\(\) => window\.print\(\), 500\);\s*\} else \{\s*window\.print\(\);\s*\}\s*\}, 500\);\s*\}\);\s*\};/g;

content = content.replace(regex2, `
            const printAction = () => {
              if ('\${action}' === 'pdf') {
                document.title = 'shipping_label_\${order?.id || "label"}';
                setTimeout(() => window.print(), 500);
              } else {
                window.print();
              }
            };
            if (document.fonts) {
              document.fonts.ready.then(() => { setTimeout(printAction, 500); });
            } else {
              setTimeout(printAction, 500);
            }
`);

const regex3 = /window\.onload = \(\) => \{\s*document\.fonts\.ready\.then\(\(\) => \{\s*setTimeout\(\(\) => \{\s*window\.print\(\);\s*\}, 500\);\s*\}\);\s*\};/g;

content = content.replace(regex3, `
            const p = () => { setTimeout(() => window.print(), 500); };
            if (document.fonts) {
              document.fonts.ready.then(p);
            } else {
              p();
            }
`);

fs.writeFileSync('src/pages/AdminDashboard.tsx', content);
