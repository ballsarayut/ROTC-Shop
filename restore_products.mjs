const fs = require('fs');

async function fix() {
  const url = process.env.VITE_GOOGLE_SHEET_URL + '?action=read&sheet=Products';
  const res = await fetch(url);
  const data = await res.json();
  
  // Find images from the real data
  const findImg = (keywords) => {
    for (let k of keywords) {
      let f = data.find(p => p.name && p.name.includes(k));
      if (f && f.imageUrl) return f.imageUrl;
    }
    return 'https://images.unsplash.com/photo-1590001158193-7903d8e70ad1?auto=format&fit=crop&q=80&w=800'; // fallback
  };

  const expected = [
    {
      id: "prod-1",
      name: "ชุดฝึกผ้าก้างปลา นศท.ชาย, หญิง",
      description: "ชุดฝึกมาตรฐานสำหรับนักศึกษาวิชาทหารชายและหญิง",
      price: 810,
      category: "ชุดฝึก/เครื่องแบบ",
      stock: 1000,
      imageUrl: findImg(["ชุดฝึกผ้าก้างปลา"]),
      sizes: ["26", "27", "28", "29", "30", "31", "32", "33", "34", "35", "36", "37", "38", "39", "40"],
      genders: ["ชาย", "หญิง"],
      createdAt: new Date().toISOString()
    },
    {
      id: "prod-2",
      name: "เสื้อยืดรองในสีกากี (มีทั้งคอวีและคอกลม)",
      description: "เสื้อยืดคอกลมสีกากี สำหรับสวมใส่ด้านในชุดฝึก",
      price: 90,
      category: "ชุดฝึก/เครื่องแบบ",
      stock: 1000,
      imageUrl: findImg(["เสื้อยืดรองใน"]),
      sizes: ["S", "M", "L", "XL", "2XL"],
      createdAt: new Date().toISOString()
    },
    {
      id: "prod-3",
      name: "หมวกแบเร่ต์ รด. สีเขียวขี้ม้า พร้อมหน้าหมวก",
      description: "หมวกแบเร่ต์สีเขียวขี้ม้าสำหรับนักศึกษาวิชาทหาร พร้อมหน้าหมวก",
      price: 130,
      category: "ชุดฝึก/เครื่องแบบ",
      stock: 1000,
      imageUrl: findImg(["หมวกแบเร่ต์"]),
      sizes: ["5", "6", "7", "8"],
      createdAt: new Date().toISOString()
    },
    {
      id: "prod-4",
      name: "รองเท้าประกอบชุดฝึก",
      description: "รองเท้าคอมแบทสำหรับประกอบชุดฝึก นศท.",
      price: 490,
      category: "รองเท้าจังเกิ้ลหนังแท้สีดำ",
      stock: 1000,
      imageUrl: findImg(["รองเท้า"]),
      sizes: ["35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45"],
      createdAt: new Date().toISOString()
    },
    {
      id: "prod-5",
      name: "สายรัดข้อเท้า (สีดำ)",
      description: "สายรัดข้อเท้าสำหรับรัดขากางเกงชุดฝึก",
      price: 20,
      category: "รองเท้าจังเกิ้ลหนังแท้สีดำ",
      stock: 1000,
      imageUrl: findImg(["ห่วงขาแบบผ้า", "สายรัดข้อเท้า"]),
      createdAt: new Date().toISOString()
    },
    {
      id: "prod-6",
      name: "เหล็กชิดเท้าสีดำ",
      description: "เหล็กชิดเท้าสำหรับติดรองเท้า",
      price: 20,
      category: "รองเท้าจังเกิ้ลหนังแท้สีดำ",
      stock: 1000,
      imageUrl: findImg(["เหล็กชิดเท้าสีดำ"]),
      createdAt: new Date().toISOString()
    },
    {
      id: "prod-7",
      name: "เครื่องหมาย นศท. (สังกัด)",
      description: "เครื่องหมายสังกัด นศท.",
      price: 20,
      category: "ชุดฝึก/เครื่องแบบ",
      stock: 1000,
      imageUrl: findImg(["เครื่องหมาย นศท."]),
      createdAt: new Date().toISOString()
    },
    {
      id: "prod-8",
      name: "ถุงเท้าลูกฟูกสีดำ",
      description: "ถุงเท้าลูกฟูกสีดำ สำหรับใส่คู่กับรองเท้าฝึก",
      price: 35,
      category: "รองเท้าจังเกิ้ลหนังแท้สีดำ",
      stock: 1000,
      imageUrl: findImg(["ถุงเท้าลูกฟูกสีดำ"]),
      createdAt: new Date().toISOString()
    },
    {
      id: "prod-9",
      name: "เข็มขัด นศท. พร้อมหัวเข็มขัด",
      description: "เข็มขัด นศท. พร้อมหัวเข็มขัด",
      price: 70,
      category: "ชุดฝึก/เครื่องแบบ",
      stock: 1000,
      imageUrl: findImg(["เข็มขัด", "สายเข็มขัด"]),
      createdAt: new Date().toISOString()
    },
    {
      id: "prod-10",
      name: "ค่าจ้างปักป้ายชื่อ",
      description: "ค่าบริการปักชื่อ",
      price: 30,
      category: "ชุดฝึก/เครื่องแบบ",
      stock: 1000,
      imageUrl: findImg(["ค่าจ้างปักป้ายชื่อ"]),
      createdAt: new Date().toISOString()
    },
    {
      id: "prod-11",
      name: "ค่าจ้างปักเครื่องหมายสถานศึกษา",
      description: "ค่าบริการปักเครื่องหมายสถานศึกษา",
      price: 50,
      category: "ชุดฝึก/เครื่องแบบ",
      stock: 1000,
      imageUrl: findImg(["ค่าจ้างปักเครื่องหมายสถานศึกษา"]),
      createdAt: new Date().toISOString()
    },
    {
      id: "prod-12",
      name: "ค่าจ้างเย็บติดเครื่องหมายรวม 7 ชิ้น",
      description: "ค่าบริการเย็บติดเครื่องหมายรวม 7 ชิ้น",
      price: 40,
      category: "ชุดฝึก/เครื่องแบบ",
      stock: 1000,
      imageUrl: findImg(["ค่าจ้างเย็บติดเครื่องหมาย"]),
      createdAt: new Date().toISOString()
    },
    {
      id: "prod-13",
      name: "ค่าเครื่องสนาม (เป้, กระติกน้ำ, สายโยงบ่า, เข็มขัดสนาม)",
      description: "ชุดอุปกรณ์เครื่องสนามต่างๆ",
      price: 570,
      category: "อุปกรณ์สนาม",
      stock: 1000,
      imageUrl: findImg(["เครื่องสนาม (เป้", "ค่าเครื่องสนาม"]),
      createdAt: new Date().toISOString()
    },
    {
      id: "prod-14",
      name: "เครื่องหมายจิตอาสา",
      description: "ตราสัญลักษณ์เครื่องหมายจิตอาสา",
      price: 15,
      category: "ชุดฝึก/เครื่องแบบ",
      stock: 1000,
      imageUrl: findImg(["เครื่องหมายจิตอาสา"]),
      createdAt: new Date().toISOString()
    }
  ];
  
  const content = `import { Product } from '../types';

export const INITIAL_PRODUCTS: Partial<Product>[] = ${JSON.stringify(expected, null, 2)};
`;

  fs.writeFileSync('src/data/initialProducts.ts', content);
  console.log('Restored exactly 14 items with pulled cloud images');
}

fix();
