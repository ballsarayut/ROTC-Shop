import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import { googleSheetService } from './services/googleSheetService';
import Layout from './components/Layout';
import ScrollToTop from './components/ScrollToTop';
import Home from './pages/Home';
import ProductDetail from './pages/ProductDetail';
import CartPage from './pages/CartPage';
import Checkout from './pages/Checkout';
import OrderTracking from './pages/OrderTracking';
import AdminDashboard from './pages/AdminDashboard';
import AdminProducts from './pages/AdminProducts';
import Login from './pages/Login';
import { Product, OrderItem, PaymentSettings } from './types';
import { fixProductPrice } from './lib/utils';

class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 text-gray-800 p-6">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-lg w-full text-center border-2 border-red-100">
            <h2 className="text-2xl font-black text-red-600 mb-4">ขออภัย เกิดข้อผิดพลาดทางระบบ</h2>
            <p className="text-sm font-medium mb-6 text-gray-600">
              {this.state.error?.message?.includes('Quota') || this.state.error?.message?.includes('ขีดจำกัด')
                ? "ระบบฐานข้อมูลถึงขีดจำกัดการใช้งานฟรีรายวันของ Firebase กรุณาลองใหม่ในภายหลัง หรืออัปเกรดแพ็กเกจ"
                : this.state.error?.message || "เกิดข้อผิดพลาดในการโหลดข้อมูลหน้าเพจ"}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-red-600 text-white rounded-xl font-bold uppercase tracking-widest hover:bg-red-700 transition"
            >
              รีเฟรชหน้าเว็บ
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [cart, setCart] = useState<OrderItem[]>(() => {
    let initialCart: any[] = [];
    try {
      const savedCart = localStorage.getItem('school_shop_cart');
      initialCart = savedCart ? JSON.parse(savedCart) : [];
      if (!Array.isArray(initialCart)) {
        initialCart = [];
      }
    } catch (e) {
      console.warn("Cleared corrupted cart data");
      localStorage.removeItem('school_shop_cart');
    }
    
    if (initialCart.length > 0) {
      initialCart = initialCart.map((item: any) => ({ ...item, price: fixProductPrice(item.name || '', item.price) }));
    }
    return initialCart;
  });
  


  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);

  useEffect(() => {
    localStorage.setItem('school_shop_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const sheetSettings = await googleSheetService.fetchRecords('Settings');
        const paymentSet = sheetSettings.find((s: any) => s.id === 'payment');
        if (paymentSet) {
          setPaymentSettings({
            bankName: paymentSet.bankName || 'ธนาคารกรุงเทพ',
            accountNumber: paymentSet.accountNumber || '123-4-56789-0',
            accountName: paymentSet.accountName || 'นาย ทหาร ทดสอบ',
            shippingFee: Number(paymentSet.shippingFee) || 0,
            qrCodeUrl: paymentSet.qrCodeUrl || '',
          });
        }
      } catch (fallbackError) {
        console.warn('Google Sheets fallback for payment settings failed:', fallbackError);
      }
    };
    fetchSettings();
  }, []);

  const handleAddToCart = (product: Product, quantity: number = 1, size?: string, color?: string, gender?: string) => {
    setCart(prevCart => {
      const existingItemIndex = prevCart.findIndex(
        item => item.productId === product.id && item.size === size && item.color === color && item.gender === gender
      );

      if (existingItemIndex > -1) {
        const newCart = [...prevCart];
        newCart[existingItemIndex].quantity += quantity;
        return newCart;
      }

      return [...prevCart, {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity,
        size,
        color,
        gender,
        imageUrl: product.imageUrl
      }];
    });
  };

  const handleUpdateQuantity = (productId: string, quantity: number, size?: string, color?: string, gender?: string) => {
    setCart(prevCart => 
      prevCart.map(item => 
        (item.productId === productId && item.size === size && item.color === color && item.gender === gender)
          ? { ...item, quantity }
          : item
      )
    );
  };

  const handleRemoveFromCart = (productId: string, size?: string, color?: string, gender?: string) => {
    setCart(prevCart => 
      prevCart.filter(item => 
        !(item.productId === productId && item.size === size && item.color === color && item.gender === gender)
      )
    );
  };

  const handleClearCart = () => {
    setCart([]);
  };

  return (
    <ErrorBoundary>
      <Router>
        <ScrollToTop />
        <Layout cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)}>
          <Routes>
            <Route path="/" element={<Home onAddToCart={handleAddToCart} />} />
            <Route path="/product/:id" element={<ProductDetail onAddToCart={handleAddToCart} />} />
            <Route path="/cart" element={<CartPage cart={cart} shippingFee={paymentSettings?.shippingFee || 0} onUpdateQuantity={handleUpdateQuantity} onRemoveFromCart={handleRemoveFromCart} onClearCart={handleClearCart} />} />
            <Route path="/checkout" element={<Checkout cart={cart} paymentSettingsProp={paymentSettings} onClearCart={handleClearCart} />} />
            <Route path="/tracking" element={<OrderTracking />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/products" element={<AdminProducts />} />
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </Router>
    </ErrorBoundary>
  );
}
