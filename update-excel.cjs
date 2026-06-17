const fs = require('fs');
const file = 'src/pages/AdminDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add getFilteredItems function
const helperFunction = `
  const getFilteredItems = (items: OrderItem[]) => {
    return items.filter(item => {
      const pMatch = filterProduct === "all" || item.name === filterProduct;
      const sMatch = filterSize === "all" || item.size === filterSize;
      return pMatch && sMatch;
    });
  };

  const filteredOrders = orders`;

content = content.replace('const filteredOrders = orders', helperFunction);

// Update filteredOrders logic
content = content.replace(
`      const matchesProduct =
        filterProduct === "all" ||
        o.items.some((item) => item.name === filterProduct);
      const matchesSize =
        filterSize === "all" ||
        o.items.some((item) => item.size === filterSize);`,
`      const hasMatchingItem = o.items.some((item) => {
        const pMatch = filterProduct === "all" || item.name === filterProduct;
        const sMatch = filterSize === "all" || item.size === filterSize;
        return pMatch && sMatch;
      });`);

content = content.replace(
`        matchesGender &&
        matchesProduct &&
        matchesSize &&
        matchesDate`,
`        matchesGender &&
        hasMatchingItem &&
        matchesDate`);

// Update EXCEL mapping
content = content.replace(
`      const itemsStr = order.items
        .map((item) => \`\${item.name} (\${formatItemSize(item.name, item.size)}) x\${item.quantity}\`)`,
`      const itemsStr = sortOrderItemsBySize(getFilteredItems(order.items))
        .map((item) => \`\${item.name} (\${formatItemSize(item.name, item.size)}) x\${item.quantity}\`)`);

// Update PDF mapping
// We need to replace `sortOrderItemsBySize(o.items)` with `sortOrderItemsBySize(getFilteredItems(o.items))` everywhere.
content = content.replace(/sortOrderItemsBySize\(o\.items\)/g, 'sortOrderItemsBySize(getFilteredItems(o.items))');

// The Table? Does the table use o.items or getFilteredItems?
// The table is using o.items currently. The user specifically mentioned "เวลาส่งออก excel มาหลายรายการเลย" (when exporting to excel, it came multiple items).
// Maybe also apply this to the UI table so it's consistent.
// Let's replace `order.items.map` in the Table with `getFilteredItems(order.items).map`
// Wait, I will use regex:
// In the table, the items loop is typically `sortOrderItemsBySize(order.items).map`
content = content.replace(/sortOrderItemsBySize\(order\.items\)/g, 'sortOrderItemsBySize(getFilteredItems(order.items))');

fs.writeFileSync(file, content);
console.log("Replaced successfully!");
