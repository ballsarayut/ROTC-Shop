export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl?: string;
  stock: number;
  sizes?: string[];
  colors?: string[];
  genders?: string[];
  createdAt: any;
}

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  size?: string;
  color?: string;
  gender?: string;
  imageUrl?: string;
}

export type OrderStatus = 'pending' | 'verifying' | 'preparing' | 'completed' | 'cancelled';
export type PaymentMethod = 'transfer' | 'qr';
export type DeliveryMethod = 'school';

export interface PaymentSettings {
  bankName: string;
  accountNumber: string;
  accountName: string;
  qrCodeUrl: string;
  shippingFee?: number;
}

export interface Order {
  id: string;
  fullName: string;
  trainingCenter: string;
  school: string;
  year: string;
  gender: string;
  height: string;
  phone: string;
  items: OrderItem[];
  subtotal?: number;
  shippingFee?: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  slipUrl?: string;
  paymentRef?: string;
  status: OrderStatus;
  deliveryMethod: DeliveryMethod;
  trackingNumber?: string;
  shippingProvider?: string;
  remarks?: string;
  isEmbroidered?: boolean;
  isOrdered?: boolean;
  createdAt: any;
  updatedAt: any;
  _rawItems?: string;
  aiVerification?: {
    isValidSlip: boolean;
    extractedAmount: number | null;
    amountMatches: boolean;
    message: string;
    checkedAt: any;
  };
}

export interface Category {
  id: string;
  name: string;
  icon?: string;
}

export interface TrainingCenter {
  id: string;
  name: string;
  createdAt: any;
}

export interface School {
  id: string;
  name: string;
  trainingCenterId: string;
  trainingCenterName: string;
  shippingAddress?: string;
  contactPerson?: string;
  contactPhone?: string;
  createdAt: any;
}
