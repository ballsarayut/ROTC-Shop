import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { googleSheetService } from '../services/googleSheetService';
import { Order, OrderStatus } from '../types';
import { formatPrice, cn, formatItemSize } from '../lib/utils';
import { Search, Package, Clock, CheckCircle2, Truck, XCircle, ChevronRight, ArrowLeft, Loader2, MapPin, CreditCard, Calendar, Phone, Hash, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toPng } from 'html-to-image';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

const STATUS_CONFIG: Record<OrderStatus, { label: string; shortLabel: string; color: string; icon: any; description: string }> = {
  pending: { label: 'รับคำสั่งซื้อ', shortLabel: 'รับคำสั่งซื้อ', color: 'bg-amber-500', icon: Clock, description: 'เราได้รับคำสั่งซื้อของคุณแล้ว กรุณาแนบหลักฐานการโอนเงินเพื่อให้เจ้าหน้าที่ตรวจสอบ' },
  verifying: { label: 'ดำเนินการคำสั่งซื้อ', shortLabel: 'ดำเนินการ', color: 'bg-army-dark', icon: Search, description: 'เจ้าหน้าที่กำลังดำเนินการตรวจสอบและเตรียมคำสั่งซื้อของคุณ' },
  preparing: { label: 'กำลังจัดส่ง', shortLabel: 'กำลังจัดส่ง', color: 'bg-army-primary', icon: Package, description: 'เรากำลังจัดเตรียมอุปกรณ์ของคุณให้พร้อมสำหรับการจัดส่งไปยังโรงเรียน' },
  completed: { label: 'จัดส่งสำเร็จ', shortLabel: 'จัดส่งสำเร็จ', color: 'bg-emerald-600', icon: CheckCircle2, description: 'ได้รับสินค้าเรียบร้อยแล้ว ขอบคุณที่ใช้บริการ' },
  cancelled: { label: 'ยกเลิก', shortLabel: 'ยกเลิก', color: 'bg-red-600', icon: XCircle, description: 'รายการสั่งซื้อนี้ถูกยกเลิกแล้ว' },
};

export default function OrderTracking() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const captureRef = React.useRef<HTMLDivElement>(null);
  const [searchType, setSearchType] = useState<'phone' | 'orderId'>('phone');
  const [searchValue, setSearchValue] = useState(searchParams.get('id') || searchParams.get('phone') || '');
  const [ordersList, setOrdersList] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const doFetch = async (id: string | null, phone: string | null, showLoading = true) => {
      if (showLoading && isMounted) {
        setLoading(true);
        setError('');
      }
      
      try {
        const orders = await googleSheetService.fetchRecords('Orders');
        if (!isMounted) return;

        let foundItems: any[] = [];
        if (id) {
          const found = orders.find((o: any) => o.id === id);
          if (found) foundItems = [found];
          else setError('ไม่พบหมายเลขรายการสั่งซื้อนี้');
        } else if (phone) {
          foundItems = orders.filter((o: any) => o.phone === phone).sort((a: any, b: any) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
            return dateB.getTime() - dateA.getTime();
          });
          if (foundItems.length === 0) setError('ไม่พบรายการสั่งซื้อสำหรับเบอร์โทรศัพท์นี้');
        }

        if (foundItems.length > 0) {
          foundItems.forEach(found => {
            if (typeof found.items === 'string') {
              try { found.items = JSON.parse(found.items); } catch(e) { found.items = []; }
            }
            if (!Array.isArray(found.items)) found.items = [];
          });
          if (showLoading && isMounted) setError('');
          setOrdersList(foundItems as Order[]);
        } else {
          setOrdersList([]);
        }
      } catch (sheetErr) {
        if (isMounted && showLoading) {
          setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
        }
      } finally {
        if (isMounted && showLoading) setLoading(false);
      }
    };

    const id = searchParams.get('id');
    const phone = searchParams.get('phone');
    
    if (id) {
      setSearchType('orderId');
      setSearchValue(id);
      doFetch(id, null, true);
    } else if (phone) {
      setSearchType('phone');
      setSearchValue(phone);
      doFetch(null, phone, true);
    }

    return () => {
      isMounted = false;
    };
  }, [searchParams]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue) {
      if (searchType === 'orderId') {
        setSearchParams({ id: searchValue });
      } else {
        setSearchParams({ phone: searchValue });
      }
    }
  };

  const handleSaveImage = async () => {
    if (captureRef.current === null) return;
    
    try {
      // A4 dimensions at 150 DPI
      const width = 1240;
      const height = 1754;

      const dataUrl = await toPng(captureRef.current, {
        cacheBust: true,
        backgroundColor: '#f8f9fa',
        width: width,
        height: height,
        style: {
          borderRadius: '0',
          width: `${width}px`,
          height: `${height}px`,
          padding: '60px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          margin: '0'
        }
      });
      const link = document.createElement('a');
      link.download = `order-tracking-details.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Error saving image:', err);
      alert('ไม่สามารถบันทึกรูปภาพได้ กรุณาลองแคปหน้าจอแทน');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Back Button */}
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center space-x-2 text-army-muted hover:text-army-primary transition-colors mb-8 font-black uppercase tracking-widest text-base group"
      >
        <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
        <span>ย้อนกลับ</span>
      </button>

      <div className="text-center mb-12">
        <h1 className="text-5xl font-black text-army-dark mb-4 uppercase tracking-tighter">ติดตามสถานะ</h1>
        <p className="text-army-muted font-black uppercase tracking-widest text-base">ระบุข้อมูลเพื่อตรวจสอบสถานะรายการสั่งซื้อของคุณ</p>
      </div>

      {/* Search Type Toggle */}
      <div className="flex justify-center mb-8">
        <div className="bg-army-bg p-1.5 rounded-2xl inline-flex">
          <button
            onClick={() => { setSearchType('phone'); setSearchValue(''); setError(''); setOrdersList([]); }}
            className={cn(
              "px-6 py-3 rounded-xl font-black uppercase tracking-widest text-base transition-all flex items-center space-x-2",
              searchType === 'phone' ? "bg-white text-army-dark shadow-sm" : "text-army-muted hover:text-army-dark"
            )}
          >
            <Phone size={14} />
            <span>ค้นหาด้วยเบอร์โทร</span>
          </button>
          <button
            onClick={() => { setSearchType('orderId'); setSearchValue(''); setError(''); setOrdersList([]); }}
            className={cn(
              "px-6 py-3 rounded-xl font-black uppercase tracking-widest text-base transition-all flex items-center space-x-2",
              searchType === 'orderId' ? "bg-white text-army-dark shadow-sm" : "text-army-muted hover:text-army-dark"
            )}
          >
            <Hash size={14} />
            <span>ค้นหาด้วยหมายเลขรายการ</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="relative mb-16">
        <input
          type={searchType === 'phone' ? 'tel' : 'text'}
          placeholder={searchType === 'phone' ? 'ระบุเบอร์โทรศัพท์' : 'ระบุหมายเลขรายการ'}
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="w-full pl-6 pr-24 sm:pr-40 py-4 sm:py-6 bg-white border-2 border-army-dark rounded-2xl sm:rounded-[2rem] focus:ring-4 sm:ring-8 focus:ring-army-bg transition-all outline-none shadow-2xl shadow-army-primary/5 text-sm sm:text-lg font-black uppercase tracking-tight"
        />
        <button
          type="submit"
          disabled={loading || !searchValue}
          className="absolute right-2 top-2 bottom-2 px-4 sm:px-10 bg-army-dark text-white rounded-xl sm:rounded-[1.5rem] font-black uppercase tracking-widest text-xs sm:text-base hover:bg-army-primary transition-all flex items-center space-x-2 sm:space-x-3 disabled:bg-army-light disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} className="sm:w-5 sm:h-5" />}
          <span>ตรวจสอบ</span>
        </button>
      </form>

      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-red-50 border-2 border-red-100 p-8 rounded-[2rem] text-center text-red-600 font-black uppercase tracking-widest text-base"
          >
            {error}
          </motion.div>
        )}

        {ordersList.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-10"
          >
            <div ref={captureRef} className="space-y-10">
              {ordersList.map((order) => (
                <div key={order.id} className="bg-army-bg p-4 sm:p-8 rounded-[3rem] space-y-8">
                  {/* Status Card */}
                  <div className="bg-white rounded-3xl sm:rounded-[3rem] border-2 border-army-dark shadow-2xl overflow-hidden">
                    <div className={cn("p-6 sm:p-10 text-white flex flex-col sm:flex-row justify-between items-center gap-6 sm:gap-8", (STATUS_CONFIG[order.status as OrderStatus] || STATUS_CONFIG.pending).color)}>
                      <div className="flex items-center space-x-4 sm:space-x-6">
                        <div className="p-3 sm:p-5 bg-white/20 rounded-xl sm:rounded-[1.5rem] backdrop-blur-xl border border-white/30 shadow-xl">
                          {React.createElement((STATUS_CONFIG[order.status as OrderStatus] || STATUS_CONFIG.pending).icon, { size: 24, className: "sm:w-10 sm:h-10" })}
                        </div>
                        <div>
                          <p className="text-[10px] sm:text-base font-black uppercase tracking-widest opacity-70 mb-0.5 sm:mb-1">สถานะปัจจุบัน</p>
                          <h2 className="text-2xl sm:text-4xl font-black uppercase tracking-tighter leading-none">{(STATUS_CONFIG[order.status as OrderStatus] || STATUS_CONFIG.pending).label}</h2>
                        </div>
                      </div>
                      <div className="text-center sm:text-right">
                        <p className="text-[10px] sm:text-base font-black uppercase tracking-widest opacity-70 mb-0.5 sm:mb-1">หมายเลขรายการ</p>
                        <p className="text-lg sm:text-2xl font-mono font-black">#{order.id.slice(0, 8).toUpperCase()}</p>
                      </div>
                    </div>

                    <div className="p-6 sm:p-10">
                      <p className="text-army-muted font-black uppercase tracking-widest text-sm sm:text-base mb-8 sm:mb-12 text-center sm:text-left leading-relaxed max-w-lg">
                        {(STATUS_CONFIG[order.status as OrderStatus] || STATUS_CONFIG.pending).description}
                      </p>

                      {/* Progress Bar */}
                      <div className="relative flex justify-between items-center mb-12 sm:mb-16 px-2 sm:px-4">
                        <div className="absolute left-0 right-0 h-1 bg-army-bg top-1/2 -translate-y-1/2 z-0" />
                        <div 
                          className={cn("absolute left-0 h-1 top-1/2 -translate-y-1/2 z-0 transition-all duration-1000", (STATUS_CONFIG[order.status as OrderStatus] || STATUS_CONFIG.pending).color)}
                          style={{ 
                            width: order.status === 'pending' ? '0%' : 
                                   order.status === 'verifying' ? '33%' :
                                   order.status === 'preparing' ? '66%' : '100%' 
                          }}
                        />
                        
                        {['pending', 'verifying', 'preparing', 'completed'].map((s, i) => {
                          const isActive = ['pending', 'verifying', 'preparing', 'completed'].indexOf(order.status) >= i;
                          const Config = STATUS_CONFIG[s as OrderStatus];
                          return (
                            <div key={s} className="relative z-10 flex flex-col items-center">
                              <div className={cn(
                                "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 border-2",
                                isActive ? Config.color + " text-white border-transparent shadow-xl" : "bg-white border-army-bg text-army-light"
                              )}>
                                {isActive ? <CheckCircle2 size={24} /> : <div className="w-2 h-2 bg-army-bg rounded-full" />}
                              </div>
                              <span className={cn("absolute -bottom-8 text-[10px] sm:text-base font-black uppercase tracking-widest whitespace-nowrap", isActive ? "text-army-dark" : "text-army-light")}>
                                {Config.label.split(' ')[0]}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Details Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-12 pt-12 border-t-2 border-army-bg">
                        <div className="space-y-6">
                          <h3 className="text-base font-black text-army-dark uppercase tracking-widest flex items-center space-x-3">
                            <Package size={18} />
                            <span>รายการอุปกรณ์</span>
                          </h3>
                          <div className="space-y-4">
                            {order.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-start">
                                <div className="flex-grow pr-4">
                                  <p className="text-sm font-black text-army-dark uppercase tracking-tight">{item.name} x {item.quantity}</p>
                                  {item.size && <p className="text-xs font-black text-army-muted uppercase tracking-widest mt-0.5">ขนาด: {formatItemSize(item.name, item.size)}</p>}
                                </div>
                                <span className="font-mono font-black text-army-dark text-sm whitespace-nowrap">{formatPrice(item.price * item.quantity)}</span>
                              </div>
                            ))}
                              {order.shippingFee !== undefined && (
                                <div className="flex justify-between text-base font-black text-army-muted uppercase tracking-widest">
                                  <span>ค่าจัดส่ง</span>
                                  <span className="font-mono">{order.shippingFee > 0 ? formatPrice(order.shippingFee) : 'ฟรี'}</span>
                                </div>
                              )}
                              <div className="pt-6 border-t border-army-bg flex justify-between items-end">
                                <span className="text-base font-black text-army-dark uppercase tracking-widest">ยอดรวมสุทธิ</span>
                                <span className="text-2xl font-mono font-black text-army-dark tracking-tighter">{formatPrice(order.totalAmount)}</span>
                              </div>
                          </div>
                        </div>

                        <div className="space-y-8">
                          <div>
                            <h3 className="text-base font-black text-army-dark uppercase tracking-widest flex items-center space-x-3 mb-4">
                              <MapPin size={18} />
                              <span>ข้อมูลกำลังพลและการจัดส่ง</span>
                            </h3>
                            <div className="bg-army-bg p-6 rounded-[2rem] space-y-2 border border-army-light/10">
                              <p className="text-sm sm:text-base font-black text-army-dark uppercase tracking-tight">{order.fullName}</p>
                              <p className="text-xs sm:text-sm font-black text-army-muted uppercase tracking-widest">โรงเรียน: {order.school}</p>
                              <p className="text-xs sm:text-sm font-black text-army-muted uppercase tracking-widest">ชั้นปี: {order.year}</p>
                              <p className="text-xs sm:text-sm font-black text-army-muted uppercase tracking-widest flex items-center space-x-2 mt-2 pt-2 border-t border-army-light/20">
                                <Truck size={14} />
                                <span>วิธีการรับ: ส่งไปยังโรงเรียนของท่าน</span>
                              </p>
                              <p className="text-xs font-black text-amber-600 uppercase tracking-widest mt-1">
                                * ติดต่อรับกับครูผู้ดูแลกิจกรรม นศท.
                              </p>
                            </div>
                          </div>

                          <div>
                            <h3 className="text-base font-black text-army-dark uppercase tracking-widest flex items-center space-x-3 mb-4">
                              <Calendar size={18} />
                              <span>บันทึกภารกิจ</span>
                            </h3>
                            <div className="bg-army-bg p-6 rounded-[2rem] space-y-2 border border-army-light/10">
                              <p className="text-xs sm:text-sm font-black text-army-muted uppercase tracking-widest">
                                วันที่สั่งซื้อ: {order.createdAt?.toDate ? format(order.createdAt.toDate(), 'd MMM yyyy HH:mm', { locale: th }).toUpperCase() : (order.createdAt ? format(new Date(order.createdAt as any), 'd MMM yyyy HH:mm', { locale: th }).toUpperCase() : 'กำลังโหลด...')}
                              </p>
                              <p className="text-xs sm:text-sm font-black text-army-muted uppercase tracking-widest flex items-center space-x-2 mt-2">
                                <CreditCard size={14} />
                                <span>การชำระเงิน: {order.paymentMethod === 'transfer' ? 'โอนผ่านธนาคาร' : 'ชำระผ่าน QR'}</span>
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <button
                onClick={handleSaveImage}
                className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-base hover:bg-emerald-700 transition-all shadow-xl flex items-center justify-center space-x-3"
              >
                <Upload size={20} className="rotate-180" />
                <span>บันทึกภาพข้อมูลการสั่งซื้อ</span>
              </button>
              <Link
                to="/"
                className="flex items-center justify-center space-x-3 px-8 py-4 bg-white border-2 border-army-bg rounded-2xl text-base font-black text-army-muted uppercase tracking-widest hover:text-army-dark transition-colors group"
              >
                <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                <span>กลับไปเลือกอุปกรณ์</span>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
