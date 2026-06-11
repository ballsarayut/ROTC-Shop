import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Trash2, Minus, Plus, ArrowRight, ShoppingBag, ChevronLeft } from 'lucide-react';
import { OrderItem } from '../types';
import { formatPrice, cn, formatItemSize } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface CartPageProps {
  cart: OrderItem[];
  shippingFee: number;
  onUpdateQuantity: (productId: string, quantity: number, size?: string, color?: string, gender?: string) => void;
  onRemoveFromCart: (productId: string, size?: string, color?: string, gender?: string) => void;
  onClearCart: () => void;
}

export default function CartPage({ cart, shippingFee, onUpdateQuantity, onRemoveFromCart, onClearCart }: CartPageProps) {
  const navigate = useNavigate();
  const [itemToRemove, setItemToRemove] = React.useState<{ productId: string; size?: string; color?: string; gender?: string; name: string } | null>(null);
  const [showClearConfirm, setShowClearConfirm] = React.useState(false);
  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const finalTotal = totalAmount + shippingFee;

  if (cart.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center justify-center w-24 h-24 bg-slate-100 text-slate-400 rounded-full mb-6"
        >
          <ShoppingBag size={48} />
        </motion.div>
        <h2 className="text-3xl font-black text-slate-900 mb-4 uppercase tracking-tighter">ตะกร้าสินค้าว่างเปล่า</h2>
        <p className="text-slate-400 mb-8 max-w-md mx-auto font-medium">
          ตะกร้าสินค้าของคุณยังว่างอยู่ กลับไปที่หน้าหลักเพื่อเลือกซื้อสินค้า
        </p>
        <Link
          to="/"
          className="tactical-button inline-flex items-center space-x-3 rounded-2xl"
        >
          <ChevronLeft size={20} />
          <span>กลับสู่หน้าหลัก</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Confirmation Modal */}
      <AnimatePresence>
        {itemToRemove && (
          <div className="fixed inset-0 bg-army-dark/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white p-8 rounded-[2.5rem] border-2 border-army-dark shadow-2xl max-w-sm w-full space-y-6"
            >
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto">
                <Trash2 size={32} />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-black text-army-dark uppercase tracking-tighter">ยืนยันการลบ</h3>
                <p className="text-sm font-bold text-army-muted">คุณต้องการลบ <span className="text-army-dark">{itemToRemove.name}</span> ออกจากตะกร้าใช่หรือไม่?</p>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => setItemToRemove(null)} 
                  className="flex-1 px-6 py-3 bg-army-bg text-army-dark rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-army-light transition-all"
                >
                  ยกเลิก
                </button>
                <button 
                  onClick={() => {
                    onRemoveFromCart(itemToRemove.productId, itemToRemove.size, itemToRemove.color, itemToRemove.gender);
                    setItemToRemove(null);
                  }} 
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-red-700 transition-all shadow-lg shadow-red-600/20"
                >
                  ลบออก
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showClearConfirm && (
          <div className="fixed inset-0 bg-army-dark/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white p-8 rounded-[2.5rem] border-2 border-army-dark shadow-2xl max-w-sm w-full space-y-6"
            >
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto">
                <Trash2 size={32} />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-black text-army-dark uppercase tracking-tighter">ยืนยันการล้างตะกร้า</h3>
                <p className="text-sm font-bold text-army-muted">คุณต้องการลบสินค้าทั้งหมดออกจากตะกร้าใช่หรือไม่?</p>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowClearConfirm(false)} 
                  className="flex-1 px-6 py-3 bg-army-bg text-army-dark rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-army-light transition-all"
                >
                  ยกเลิก
                </button>
                <button 
                  onClick={() => {
                    onClearCart();
                    setShowClearConfirm(false);
                  }} 
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-red-700 transition-all shadow-lg shadow-red-600/20"
                >
                  ล้างตะกร้า
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Back Button */}
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center space-x-2 text-army-muted hover:text-army-primary transition-colors mb-8 font-black uppercase tracking-widest text-base group"
      >
        <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
        <span>ย้อนกลับ</span>
      </button>

      <div className="flex items-center justify-between mb-12">
        <h1 className="text-4xl font-black text-army-dark flex items-center space-x-4 tracking-tighter uppercase">
          <div className="w-12 h-12 bg-army-primary text-white rounded-2xl flex items-center justify-center shadow-lg shadow-army-primary/20">
            <ShoppingCart size={24} />
          </div>
          <span>ตะกร้าสินค้า</span>
        </h1>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setShowClearConfirm(true)}
            className="text-red-500 hover:text-red-700 font-black uppercase tracking-widest text-xs flex items-center space-x-2 bg-red-50 px-4 py-2 rounded-xl transition-all"
          >
            <Trash2 size={14} />
            <span>ล้างตะกร้า</span>
          </button>
          <span className="text-base font-black text-army-muted uppercase tracking-widest bg-army-bg px-3 py-1 rounded-full">{cart.length} รายการ</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-6">
          <AnimatePresence mode="popLayout">
            {cart.map((item) => (
              <motion.div
                key={`${item.productId}-${item.size}-${item.color}-${item.gender}`}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-white p-4 sm:p-6 rounded-[2rem] border-2 border-army-light/10 shadow-sm flex items-center gap-4 sm:gap-6 group hover:border-army-primary transition-all"
              >
                <div className="w-24 h-24 bg-army-bg rounded-2xl overflow-hidden flex-shrink-0 border border-army-light/10">
                  <img
                    src={item.imageUrl || `https://picsum.photos/seed/${item.productId}/200/200`}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>

                <div className="flex-grow min-w-0">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-black text-army-dark truncate group-hover:text-army-muted transition-colors uppercase tracking-tight">
                      {item.name}
                    </h3>
                    <button
                      onClick={() => setItemToRemove({ 
                        productId: item.productId, 
                        size: item.size, 
                        color: item.color, 
                        gender: item.gender,
                        name: item.name
                      })}
                      className="p-2 text-army-light hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    {item.gender && (
                      <span className="text-base font-black bg-army-accent text-white px-2 py-1 rounded-md uppercase tracking-widest">
                        เพศ: {item.gender}
                      </span>
                    )}
                    {item.size && (
                      <span className="text-base font-black bg-army-primary text-white px-2 py-1 rounded-md uppercase tracking-widest">
                        ขนาด: {formatItemSize(item.name, item.size)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center bg-army-bg rounded-xl p-1">
                      <button
                        onClick={() => onUpdateQuantity(item.productId, Math.max(1, item.quantity - 1), item.size, item.color, item.gender)}
                        className="w-8 h-8 flex items-center justify-center hover:bg-white rounded-lg transition-all text-army-muted"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-10 text-center font-mono font-black text-army-dark text-base">{item.quantity}</span>
                      <button
                        onClick={() => onUpdateQuantity(item.productId, item.quantity + 1, item.size, item.color, item.gender)}
                        className="w-8 h-8 flex items-center justify-center hover:bg-white rounded-lg transition-all text-army-muted"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <span className="text-xl font-mono font-black text-army-dark tracking-tighter">
                      {formatPrice(item.price * item.quantity)}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white p-10 rounded-[2.5rem] border-2 border-army-primary shadow-2xl shadow-army-primary/5 sticky top-24">
            <h2 className="text-base font-black text-army-dark mb-8 uppercase tracking-[0.2em] border-b-2 border-army-primary pb-4">สรุปรายการสั่งซื้อ</h2>
            
            <div className="space-y-6 mb-10">
              <div className="flex justify-between text-army-muted text-base font-black uppercase tracking-widest">
                <span>ราคาสินค้าทั้งหมด</span>
                <span className="text-army-dark font-mono text-base">{formatPrice(totalAmount)}</span>
              </div>
              <div className="flex justify-between text-army-muted text-base font-black uppercase tracking-widest">
                <span>ค่าจัดส่ง</span>
                <span className={shippingFee > 0 ? "text-army-dark font-mono text-base" : "text-emerald-600"}>
                  {shippingFee > 0 ? formatPrice(shippingFee) : 'ฟรี'}
                </span>
              </div>
              <div className="pt-6 border-t border-army-bg flex justify-between items-end">
                <span className="text-base font-black text-army-dark uppercase tracking-widest">ยอดรวมสุทธิ</span>
                <span className="text-4xl font-mono font-black text-army-dark tracking-tighter leading-none">{formatPrice(finalTotal)}</span>
              </div>
            </div>

            <button
              onClick={() => navigate('/checkout')}
              className="w-full tactical-button py-6 rounded-2xl flex items-center justify-center space-x-4 group"
            >
              <span>ดำเนินการชำระเงิน</span>
              <ArrowRight size={24} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
