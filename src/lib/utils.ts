import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseSizes(sizes: any): string[] {
  if (!sizes) return [];
  if (Array.isArray(sizes)) return sizes;
  if (typeof sizes === 'string') {
    try {
      const parsed = JSON.parse(sizes);
      if (Array.isArray(parsed)) return parsed;
    } catch(e) {}
    return sizes.split(',').map(s => s.trim()).filter(s => s);
  }
  if (typeof sizes === 'number') return [sizes.toString()];
  return [];
}

export function formatPrice(price: number) {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
  }).format(price);
}

export const getOrderAmount = (o: any) => {
  let amount = o?.totalAmount;
  if (amount === undefined || amount === null || isNaN(Number(amount)) || Number(amount) === 0) {
      amount = o?.totalPrice ?? o?.total ?? o?.amount ?? o?.subtotal ?? 0;
      if (amount === 0 && o?.items && Array.isArray(o.items)) {
         amount = o.items.reduce((s: number, i: any) => s + ((Number(i.price) || 0) * (Number(i.quantity) || 1)), 0);
      }
  }
  return Number(amount) || 0;
};

export const SHOE_SIZE_MAP: Record<string, string> = {
  "34": "4",
  "35": "4.5",
  "36": "5",
  "37": "5.5",
  "38": "6",
  "39": "6.5",
  "40": "7",
  "41": "7.5",
  "42": "8",
  "43": "8.5",
  "44": "9",
  "45": "9.5",
  "46": "10",
  "47": "10.5",
  "48": "11",
  "49": "11.5",
  "50": "12",
};

export const formatItemSize = (name: string, size?: string | number) => {
  if (!size) return "-";
  const strSize = String(size).trim();
  if (name && name.includes("รองเท้า")) {
    return SHOE_SIZE_MAP[strSize] ? `${strSize}=${SHOE_SIZE_MAP[strSize]}` : strSize;
  }
  return strSize;
};

export const fixProductPrice = (name: string, currentPrice: number): number => {
  if (!name) return currentPrice;
  if (name.includes('ค่าจ้างปักป้ายชื่อ')) return 25;
  if (name.includes('ค่าจ้างเย็บติดเครื่องหมายรวม 7 ชิ้น') || name.includes('ค่าจ้างเย็บติดเครื่องหมาย')) return 35;
  if (name.includes('ถุงเท้าลูกฟูกสีดำ')) return 30;
  if (name === 'รองเท้าประกอบชุดฝึก' || name === 'รองเท้าประกอบชุดฝึก นศท.' || name.includes('รองเท้าคอมแบท')) return 480;
  return currentPrice;
};
