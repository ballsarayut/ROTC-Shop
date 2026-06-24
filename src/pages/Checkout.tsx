import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import imageCompression from 'browser-image-compression';
import { toPng } from 'html-to-image';
import { OrderItem, OrderStatus, PaymentMethod, DeliveryMethod, PaymentSettings } from '../types';
import { googleSheetService } from '../services/googleSheetService';
import { verifySlipImage } from '../services/geminiService';
import { formatPrice, cn, formatItemSize } from '../lib/utils';
import { ShoppingCart, User, MapPin, CreditCard, Upload, CheckCircle2, Loader2, QrCode, Banknote, Truck, School, Building2, Info, ArrowLeft, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import fallbackData from '../data/fallbackData.json';

interface CheckoutProps {
  cart: OrderItem[];
  paymentSettingsProp: PaymentSettings | null;
  onClearCart: () => void;
}

const YEARS = [
  'นศท. ชั้นปีที่ 1',
];

const GENDERS = ['ชาย', 'หญิง'];

export default function Checkout({ cart, paymentSettingsProp, onClearCart }: CheckoutProps) {
  const navigate = useNavigate();
  const captureRef = React.useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [finalCart, setFinalCart] = useState<OrderItem[]>([]);
  const [finalTotal, setFinalTotal] = useState(0);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(paymentSettingsProp);
  const [trainingCenters, setTrainingCenters] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [filteredSchools, setFilteredSchools] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    trainingCenter: '',
    school: '',
    year: '',
    gender: '',
    height: '',
    phone: '',
    paymentMethod: 'transfer' as PaymentMethod,
    deliveryMethod: 'school' as DeliveryMethod,
    paymentRef: '',
  });

  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState<string>('');

  const handleSlipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSlipFile(file);
      const reader = new FileReader();
      
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setSlipPreview(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    if (paymentSettingsProp) {
      setPaymentSettings(paymentSettingsProp);
    }
  }, [paymentSettingsProp]);

  useEffect(() => {
    const fetchData = async () => {
      let fetchFailed = false;
      try {
        if (!paymentSettingsProp) {
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
        }
        
        const sheetCenters = await googleSheetService.fetchRecords('TrainingCenters');
        if (sheetCenters && sheetCenters.length > 0) {
          const parsedCenters = sheetCenters.map((c: any) => ({
            id: c.id || '',
            name: c.name || '',
            location: c.location || '',
          }));
          parsedCenters.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'th'));
          setTrainingCenters(parsedCenters);
        }

        const sheetSchools = await googleSheetService.fetchRecords('Schools');
        if (sheetSchools && sheetSchools.length > 0) {
          const parsedSchools = sheetSchools.map((s: any) => ({
            id: s.id || '',
            name: s.name || '',
            trainingCenterId: s.trainingCenterId || s.centerId || '',
            trainingCenterName: s.trainingCenterName || s.centerName || '',
            shippingAddress: s.shippingAddress || s.address || '',
            contactPerson: s.contactPerson || s.contact || '',
            contactPhone: s.contactPhone || s.phone || '',
          }));
          parsedSchools.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'th'));
          setSchools(parsedSchools);
        }
      } catch (error) {
        console.error('Error fetching data from Google Sheets:', error);
        fetchFailed = true;
      } finally {
        if (!paymentSettingsProp && !paymentSettings) {
           let fbPaymentSet = null;
           try {
             fbPaymentSet = fallbackData.settings.find((s: any) => s.id === 'payment');
           } catch (e) {}
           if (fbPaymentSet) {
             setPaymentSettings({
              bankName: fbPaymentSet.bankName || 'ธนาคารกรุงเทพ',
              accountNumber: fbPaymentSet.accountNumber || '123-4-56789-0',
              accountName: fbPaymentSet.accountName || 'ระบบขัดข้อง (กรุณาแจ้งแอดมิน)',
              shippingFee: Number(fbPaymentSet.shippingFee) || 0,
              qrCodeUrl: fbPaymentSet.qrCodeUrl || '',
             });
           } else {
             setPaymentSettings(prev => prev || { bankName: 'ธนาคารกรุงเทพ', accountNumber: '123-4-56789-0', accountName: 'ระบบขัดข้อง (กรุณาแจ้งแอดมิน)', shippingFee: 0, qrCodeUrl: '' });
           }
        }
        setTrainingCenters(prev => {
          if (prev.length > 0) return prev;
          try {
            return fallbackData.centers || [];
          } catch(e) {
            return [];
          }
        });
        setSchools(prev => {
          if (prev.length > 0) return prev;
          try {
             return fallbackData.schools || [];
          } catch(e) {
            return [];
          }
        });
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (formData.trainingCenter) {
      const center = trainingCenters.find(c => c.name === formData.trainingCenter);
      if (center) {
        setFilteredSchools(schools.filter(s => s.trainingCenterId === center.id));
      } else {
        setFilteredSchools(schools.filter(s => s.trainingCenterName === formData.trainingCenter));
      }
    } else {
      setFilteredSchools([]);
    }
  }, [formData.trainingCenter, trainingCenters, schools]);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingFee = paymentSettings?.shippingFee || 0;
  const totalAmount = subtotal + shippingFee;

  const [notificationStep, setNotificationStep] = useState(0);

  const [formError, setFormError] = useState<string | null>(null);

  const handleConfirm = () => {
    setFormError(null);
    // Validate required fields
    if (!formData.firstName || !formData.lastName || !formData.trainingCenter || !formData.school || !formData.year || !formData.gender || !formData.height || !formData.phone) {
      setFormError('กรุณากรอกข้อมูลผู้สั่งซื้อให้ครบถ้วน');
      return;
    }

    if (formData.phone.length !== 10) {
      setFormError('กรุณากรอกเบอร์โทรศัพท์ให้ครบ 10 หลัก');
      return;
    }

    if (Number(formData.height) <= 0) {
      setFormError('กรุณากรอกส่วนสูงให้ถูกต้อง');
      return;
    }

    if (!slipFile) {
      setFormError('กรุณาอัพโหลดสลิปการโอนเงิน');
      return;
    }

    setNotificationStep(1);
  };

  const processOrder = async () => {
    if (cart.length === 0) return;

    setFormError(null);
    // Comprehensive validation
    if (!formData.firstName || !formData.lastName || !formData.trainingCenter || !formData.school || !formData.year || !formData.gender || !formData.height || !formData.phone) {
      setFormError('กรุณากรอกข้อมูลผู้สั่งซื้อให้ครบถ้วน');
      return;
    }

    if (formData.phone.length !== 10) {
      setFormError('กรุณากรอกเบอร์โทรศัพท์ให้ครบ 10 หลัก');
      return;
    }

    if (Number(formData.height) <= 0) {
      setFormError('กรุณากรอกส่วนสูงให้ถูกต้อง');
      return;
    }

    if (!slipFile) {
      setFormError('กรุณาอัพโหลดสลิปการโอนเงิน');
      return;
    }
    
    setLoading(true);
    try {
      const generatedOrderId = Math.random().toString(36).substring(2, 10).toUpperCase();

      let slipUrl = '';
      let slipBase64 = '';
      let slipMimeType = '';
      if (slipFile) {
        slipMimeType = slipFile.type || 'image/jpeg';
        let base64data = '';
        let finalFileToUpload: File | Blob = slipFile;

        try {
          let processingFile: File | Blob = slipFile;
          
          // Detect HEIC/HEIF and convert to JPEG
          if (slipFile.type === 'image/heic' || slipFile.type === 'image/heif' || slipFile.name.toLowerCase().endsWith('.heic')) {
             try {
                 const heic2any = (await import('heic2any')).default;
                 const conversionResult = await heic2any({
                     blob: slipFile,
                     toType: 'image/jpeg',
                     quality: 0.8
                 });
                 processingFile = Array.isArray(conversionResult) ? conversionResult[0] : (conversionResult as Blob);
                 slipMimeType = 'image/jpeg';
             } catch (heicError) {
                 console.warn("HEIC conversion failed:", heicError);
             }
          }

          try {
            const options = {
              maxSizeMB: 0.2, // Max 200KB
              maxWidthOrHeight: 800,
              useWebWorker: false, // false for compatibility with LINE in-app browser
              initialQuality: 0.7
            };
            const fileForCompression = processingFile instanceof File 
              ? processingFile 
              : new File([processingFile], "slip.jpg", { type: processingFile.type });
              
            const compressedFile = await imageCompression(fileForCompression, options);
            finalFileToUpload = compressedFile;
            base64data = await imageCompression.getDataUrlFromFile(compressedFile);
          } catch (compressError) {
             console.warn("Primary compression failed, using direct FileReader fallback", compressError);
             // Directly read as base64 without canvas
             base64data = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                  if (typeof e.target?.result === 'string') {
                    resolve(e.target.result);
                  } else {
                    reject(new Error("Cannot read file"));
                  }
                };
                reader.onerror = () => reject(new Error("File read failed"));
                reader.readAsDataURL(processingFile);
             });
             finalFileToUpload = processingFile;
          }
        } catch (uploadError: any) {
           console.error("General upload parsing error", uploadError);
           throw new Error(`อัพโหลดรูปไม่สำเร็จ: กรุณาลองใช้รูปอื่น หรือแคปหน้าจอสลิปแล้วอัพโหลดรูปที่แคปแทนครับ`); 
        }
        
        slipBase64 = base64data.split(',')[1] || '';
        
        // Upload to Google Drive using App Script instead of Firebase Storage
        try {
          const extension = slipMimeType === 'image/png' ? 'png' : 'jpg';
          const filename = `slip_order_${generatedOrderId}.${extension}`;
          const uploadedUrl = await googleSheetService.uploadFile(slipBase64, slipMimeType, filename);
          if (uploadedUrl) {
            slipUrl = uploadedUrl;
          } else {
             throw new Error("อัพโหลดสลิปล้มเหลว: แอดมินยังไม่ได้ตั้งค่า Google Drive (หรือ Deploy ไม่สมบูรณ์) โปรดแจ้งแอดมินแก้ไขด่วน!");
          }
        } catch (uploadLibError) {
          console.error("Failed to upload via App Script:", uploadLibError);
          const msg = uploadLibError instanceof Error ? uploadLibError.message : String(uploadLibError);
          throw new Error("อัพโหลดสลิปล้มเหลว: " + msg);
        }
      }

      const orderData = {
        fullName: `${formData.firstName} ${formData.lastName}`.trim(),
        trainingCenter: formData.trainingCenter,
        school: formData.school,
        year: formData.year,
        gender: formData.gender,
        height: formData.height,
        phone: formData.phone,
        items: cart,
        subtotal,
        shippingFee,
        totalAmount,
        paymentMethod: formData.paymentMethod,
        deliveryMethod: formData.deliveryMethod,
        paymentRef: slipUrl, // Store slip URL in paymentRef
        status: 'pending' as OrderStatus,
        isOrdered: false,
        isEmbroidered: false,
      };

      // Clean undefined values
      const cleanOrderData = JSON.parse(JSON.stringify(orderData));
      
      setOrderId(generatedOrderId);

      // Try AI Verification first if possible
      let aiVerifyResult = null;
      if (slipBase64) {
        try {
          aiVerifyResult = await verifySlipImage(slipBase64, slipMimeType, totalAmount, paymentSettings?.accountName);
        } catch (e) {
          console.warn("AI verification failed", e);
        }
      }
      
      // Sync to Sheets
      await googleSheetService.syncRecord('Orders', { 
        id: generatedOrderId, 
        ...cleanOrderData, 
        createdAt: new Date(), 
        updatedAt: new Date(),
        aiVerification: aiVerifyResult
      });

      setFinalCart([...cart]);
      setFinalTotal(totalAmount);
      setSuccess(true);
      onClearCart();
      setNotificationStep(3);
      setLoading(false);
    } catch (error: any) {
      console.error("Checkout error:", error);
      setLoading(false);
      
      let errorMessage = 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง';
      if (error.message?.includes('process image format')) {
        errorMessage = `ไม่สามารถประมวลผลรูปภาพได้ กรุณาใช้ไฟล์ .jpg หรือ .png (${error.message})`;
      } else if (error.message?.includes('Database timeout') || error.message?.includes('permission-denied')) {
        errorMessage = 'ไม่สามารถบันทึกข้อมูลลงฐานข้อมูลได้ (อาจเป็นเพราะข้อจำกัดสิทธิ์ / Permission Denied)';
      } else if (error.message) {
        errorMessage = error.message;
      }

      setFormError(`เกิดข้อผิดพลาด: ${errorMessage}`);
      setNotificationStep(0); // Close modal to show formError
      
    } finally {
      setLoading(false);
    }
  };

  const handleSaveImage = async () => {
    if (captureRef.current === null) return;
    
    try {
      const dataUrl = await toPng(captureRef.current, {
        cacheBust: true,
        backgroundColor: '#f8f9fa', // Match army-bg
        style: {
          borderRadius: '0'
        }
      });
      const link = document.createElement('a');
      link.download = `order-${orderId || 'receipt'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Error saving image:', err);
      alert('ไม่สามารถบันทึกรูปภาพได้ กรุณาลองแคปหน้าจอแทน');
    }
  };

  if (success) {
    const totalItems = finalCart.reduce((acc, item) => acc + item.quantity, 0);
    
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <div ref={captureRef} className="bg-army-bg p-8 rounded-[3rem] mb-8 border-4 border-army-dark/10">
          <div className="bg-army-dark text-white p-6 rounded-[2rem] mb-8 flex items-center justify-between shadow-2xl">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <CheckCircle2 size={24} />
              </div>
              <div className="text-left">
                <h2 className="text-2xl font-black uppercase tracking-tighter leading-none">สั่งซื้อสำเร็จ!</h2>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mt-1">ภารกิจเสร็จสิ้น</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-60">รหัสการสั่งซื้อ</p>
              <p className="text-lg font-mono font-black tracking-tighter">#{orderId}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* ข้อมูลกำลังพล */}
            <div className="bg-white p-6 rounded-[2rem] text-left border-2 border-army-bg shadow-sm">
              <div className="flex items-center space-x-2 mb-4 text-army-dark">
                <User size={16} />
                <h3 className="text-xs font-black uppercase tracking-widest">ข้อมูลกำลังพล</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-black text-army-muted uppercase tracking-widest">ชื่อ-นามสกุล</p>
                  <p className="text-sm font-black text-army-dark uppercase">{formData.firstName} {formData.lastName}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-black text-army-muted uppercase tracking-widest">ชั้นปี</p>
                    <p className="text-sm font-black text-army-dark uppercase">{formData.year}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-army-muted uppercase tracking-widest">เพศ/ส่วนสูง</p>
                    <p className="text-sm font-black text-army-dark uppercase">{formData.gender} / {formData.height} ซม.</p>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black text-army-muted uppercase tracking-widest">เบอร์โทรศัพท์</p>
                  <p className="text-sm font-black text-army-dark uppercase">{formData.phone}</p>
                </div>
              </div>
            </div>

            {/* การจัดส่ง */}
            <div className="bg-white p-6 rounded-[2rem] text-left border-2 border-army-bg shadow-sm">
              <div className="flex items-center space-x-2 mb-4 text-army-dark">
                <MapPin size={16} />
                <h3 className="text-xs font-black uppercase tracking-widest">ข้อมูลการจัดส่ง</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-black text-army-muted uppercase tracking-widest">ศูนย์ฝึก</p>
                  <p className="text-sm font-black text-army-dark uppercase">{formData.trainingCenter}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-army-muted uppercase tracking-widest">โรงเรียน</p>
                  <p className="text-sm font-black text-army-dark uppercase">{formData.school}</p>
                </div>
                <div className="pt-2">
                  <span className="text-[10px] bg-army-bg text-army-dark px-3 py-1 rounded-full font-black uppercase tracking-widest">
                    รับที่โรงเรียน
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* รายการอุปกรณ์ */}
          <div className="bg-white p-6 rounded-[2rem] text-left border-2 border-army-bg shadow-sm mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2 text-army-dark">
                <ShoppingCart size={16} />
                <h3 className="text-xs font-black uppercase tracking-widest">รายการอุปกรณ์ ({totalItems})</h3>
              </div>
              <span className="text-xs font-black text-army-dark uppercase tracking-widest">บันทึกภารกิจ</span>
            </div>
            <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
              {finalCart.map((item, index) => (
                <div key={index} className="flex justify-between items-center py-2 border-b border-army-bg last:border-0">
                  <div>
                    <p className="text-sm font-black text-army-dark uppercase">{item.name}</p>
                    <p className="text-[10px] font-black text-army-muted uppercase tracking-widest">
                      {item.size && `ขนาด: ${formatItemSize(item.name, item.size)}`} 
                      {item.color && ` | สี: ${item.color}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-army-dark">x{item.quantity}</p>
                    <p className="text-[10px] font-black text-army-muted">{formatPrice(item.price * item.quantity)}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-4 border-t-2 border-army-bg flex justify-between items-end">
              <div>
                <p className="text-[10px] font-black text-army-muted uppercase tracking-widest">ยอดชำระสุทธิ</p>
                <p className="text-xs font-black text-army-dark uppercase tracking-widest">
                  {formData.paymentMethod === 'transfer' ? 'โอนผ่านธนาคาร' : 'ชำระผ่าน QR'}
                </p>
              </div>
              <p className="text-3xl font-mono font-black text-army-dark tracking-tighter">{formatPrice(finalTotal)}</p>
            </div>
          </div>

          <div className="text-center">
            <p className="text-[10px] font-black text-army-muted uppercase tracking-[0.3em]">
              * กรุณาบันทึกภาพนี้เพื่อเป็นหลักฐานในการรับสินค้า *
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={handleSaveImage}
            className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-base hover:bg-emerald-700 transition-all shadow-xl flex items-center justify-center space-x-3"
          >
            <Upload size={20} className="rotate-180" />
            <span>บันทึกภาพข้อมูลการสั่งซื้อ</span>
          </button>
          <button
            onClick={() => navigate(`/tracking?id=${orderId}`)}
            className="tactical-button rounded-2xl py-4 px-8"
          >
            ติดตามพัสดุ
          </button>
          <button
            onClick={() => navigate('/')}
            className="px-8 py-4 bg-white border-2 border-army-bg text-army-muted rounded-2xl font-black uppercase tracking-widest text-base hover:text-army-dark hover:border-army-dark transition-all"
          >
            กลับสู่หน้าหลัก
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back Button */}
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center space-x-2 text-army-muted hover:text-army-primary transition-colors mb-8 font-black uppercase tracking-widest text-base group"
      >
        <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
        <span>ย้อนกลับ</span>
      </button>

      <h1 className="text-4xl font-black text-army-dark mb-12 flex items-center space-x-4 tracking-tighter uppercase">
        <div className="w-12 h-12 bg-army-primary text-white rounded-2xl flex items-center justify-center shadow-lg shadow-army-primary/20">
          <CreditCard size={24} />
        </div>
        <span>ชำระเงิน</span>
      </h1>

      <form onSubmit={(e) => e.preventDefault()} className="space-y-8">
        {/* 1. ยอดที่ต้องชำระ */}
        <section className="bg-white p-6 sm:p-10 rounded-[2.5rem] border-2 border-army-primary shadow-2xl shadow-army-primary/5">
          <h2 className="text-base font-black text-army-dark mb-8 uppercase tracking-[0.2em] border-b-2 border-army-primary pb-4">1. ยอดที่ต้องชำระ</h2>
          <div className="space-y-4 mb-6 border-b border-army-bg pb-6">
            <div className="flex justify-between items-center">
              <span className="text-sm font-black text-army-muted uppercase tracking-widest">ยอดรวมสินค้า</span>
              <span className="text-lg font-mono font-black text-army-dark">{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-black text-army-muted uppercase tracking-widest">ค่าจัดส่ง</span>
              <span className="text-lg font-mono font-black text-army-dark">{shippingFee > 0 ? formatPrice(shippingFee) : 'ฟรี'}</span>
            </div>
          </div>
          <div className="flex justify-between items-end">
            <span className="text-base font-black text-army-dark uppercase tracking-widest">ยอดสุทธิ</span>
            <span className="text-5xl font-mono font-black text-army-dark tracking-tighter leading-none">{formatPrice(totalAmount)}</span>
          </div>
        </section>

        {/* 2. แนบสลิปโอนเงิน */}
        <section className="bg-white p-10 rounded-[2.5rem] border-2 border-army-light/10 shadow-sm">
          <h2 className="text-base font-black text-army-dark mb-8 uppercase tracking-[0.2em] flex items-center space-x-3">
            <CreditCard size={18} />
            <span>2. ช่องทางการชำระเงิน และ แนบสลิป</span>
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
            {[
              { id: 'transfer', name: 'โอนผ่านธนาคาร', icon: Banknote },
              { id: 'qr', name: 'ชำระผ่าน QR', icon: QrCode },
            ].map((method) => (
              <button
                key={method.id}
                type="button"
                onClick={() => setFormData({ ...formData, paymentMethod: method.id as PaymentMethod })}
                className={cn(
                  "p-6 rounded-2xl border-2 text-left transition-all",
                  formData.paymentMethod === method.id
                    ? "bg-army-primary border-army-primary text-white shadow-xl shadow-army-primary/20"
                    : "bg-white border-army-light/10 hover:border-army-primary"
                )}
              >
                <method.icon size={24} className={cn("mb-3", formData.paymentMethod === method.id ? "text-white" : "text-army-muted")} />
                <p className="font-black text-base uppercase tracking-widest">{method.name}</p>
              </button>
            ))}
          </div>

          <div className="space-y-8 animate-in fade-in slide-in-from-top-4">
            {formData.paymentMethod === 'qr' && paymentSettings?.qrCodeUrl && (
              <div className="bg-army-bg p-10 rounded-[2.5rem] border-2 border-army-light/10 flex flex-col items-center text-center">
                <p className="text-base font-black text-army-dark mb-6 uppercase tracking-widest">แสกนเพื่อชำระเงิน</p>
                <div className="w-56 h-56 bg-white p-4 rounded-[2rem] border-2 border-army-light/10 shadow-sm mb-6">
                  <img
                    src={paymentSettings.qrCodeUrl}
                    alt="QR Code สำหรับชำระเงิน"
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            )}

            {formData.paymentMethod === 'transfer' && paymentSettings && (
              <div className="bg-army-bg p-10 rounded-[2.5rem] border-2 border-army-light/10 text-center">
                <p className="text-base font-black text-army-dark mb-6 uppercase tracking-widest">ข้อมูลบัญชีธนาคาร</p>
                <p className="text-sm md:text-base text-army-muted font-black uppercase tracking-widest leading-relaxed break-words px-2">
                  {paymentSettings.bankName} <br /> 
                  เลขบัญชี: {paymentSettings.accountNumber} <br /> 
                  <span className="block mt-1">ชื่อบัญชี: {paymentSettings.accountName}</span>
                </p>
              </div>
            )}

            <div className="space-y-4">
              <label className="text-base font-black text-army-dark uppercase tracking-widest">อัพโหลดหลักฐานการโอนเงิน (สลิป) *</label>
              
              <div className="relative border-2 border-dashed border-army-light/30 rounded-2xl p-6 bg-army-bg text-center hover:border-army-primary transition-colors">
                <input
                  required
                  type="file"
                  accept="image/*"
                  onChange={handleSlipChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                
                {slipPreview ? (
                  <div className="space-y-4">
                    <img src={slipPreview} alt="Slip Preview" className="max-h-48 mx-auto rounded-xl shadow-md object-contain" />
                    <p className="text-sm font-bold text-army-primary">แตะเพื่อเปลี่ยนรูปภาพหลักฐาน</p>
                  </div>
                ) : (
                  <div className="space-y-3 py-6">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto text-army-light shadow-sm">
                      <Upload size={28} />
                    </div>
                    <div>
                      <p className="text-base font-black text-army-dark uppercase tracking-widest">แตะ หรือ ลากไฟล์สลิปมาวางที่นี่</p>
                      <p className="text-sm font-bold text-army-muted mt-1">รองรับไฟล์ภาพ (JPG, PNG)</p>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        </section>

        {/* 3-9. ข้อมูลผู้สั่งซื้อ */}
        <section className="bg-white p-10 rounded-[2.5rem] border-2 border-army-light/10 shadow-sm">
          <h2 className="text-base font-black text-army-dark mb-8 uppercase tracking-[0.2em] flex items-center space-x-3">
            <User size={18} />
            <span>3. ข้อมูลผู้สั่งซื้อ (นศท.)</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            {/* 3. ศูนย์ฝึก */}
            <div className="space-y-3">
              <label className="text-base font-black text-army-muted uppercase tracking-widest">ศูนย์ฝึก *</label>
              <select
                required
                value={formData.trainingCenter}
                onChange={(e) => setFormData({ ...formData, trainingCenter: e.target.value, school: '' })}
                className="w-full px-6 py-4 bg-army-bg border-2 border-army-bg rounded-2xl focus:border-army-primary transition-all outline-none font-bold appearance-none"
              >
                <option value="">เลือกศูนย์ฝึก</option>
                {trainingCenters.map(center => (
                  <option key={center.id} value={center.name}>{center.name}</option>
                ))}
              </select>
            </div>

            {/* 4. โรงเรียน */}
            <div className="space-y-3">
              <label className="text-base font-black text-army-muted uppercase tracking-widest">โรงเรียน *</label>
              <select
                required
                value={formData.school}
                onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                disabled={!formData.trainingCenter}
                className="w-full px-6 py-4 bg-army-bg border-2 border-army-bg rounded-2xl focus:border-army-primary transition-all outline-none font-bold appearance-none disabled:opacity-50"
              >
                <option value="">{formData.trainingCenter ? 'เลือกโรงเรียน' : 'กรุณาเลือกศูนย์ฝึกก่อน'}</option>
                {filteredSchools.map(school => (
                  <option key={school.id} value={school.name}>{school.name}</option>
                ))}
              </select>
            </div>

            {/* 5. ชื่อ-นามสกุล */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:col-span-2">
              <div className="space-y-3">
                <label className="text-base font-black text-army-muted uppercase tracking-widest">ชื่อ (ไม่ต้องใส่คำนำหน้า) *</label>
                <input
                  required
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  placeholder="เช่น สมชาย"
                  className="w-full px-6 py-4 bg-army-bg border-2 border-army-bg rounded-2xl focus:border-army-primary transition-all outline-none font-bold"
                />
              </div>
              <div className="space-y-3">
                <label className="text-base font-black text-army-muted uppercase tracking-widest">นามสกุล *</label>
                <input
                  required
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  placeholder="เช่น ใจดี"
                  className="w-full px-6 py-4 bg-army-bg border-2 border-army-bg rounded-2xl focus:border-army-primary transition-all outline-none font-bold"
                />
              </div>
            </div>

            {/* 6. ชั้นปี */}
            <div className="space-y-3">
              <label className="text-base font-black text-army-muted uppercase tracking-widest">ชั้นปี *</label>
              <select
                required
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                className="w-full px-6 py-4 bg-army-bg border-2 border-army-bg rounded-2xl focus:border-army-primary transition-all outline-none font-bold appearance-none"
              >
                <option value="">เลือกชั้นปี</option>
                {YEARS.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            {/* 7. เพศ */}
            <div className="space-y-3">
              <label className="text-base font-black text-army-muted uppercase tracking-widest">เพศ *</label>
              <select
                required
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="w-full px-6 py-4 bg-army-bg border-2 border-army-bg rounded-2xl focus:border-army-primary transition-all outline-none font-bold appearance-none"
              >
                <option value="">เลือกเพศ</option>
                {GENDERS.map(gender => (
                  <option key={gender} value={gender}>{gender}</option>
                ))}
              </select>
            </div>

            {/* 8. ส่วนสูง */}
            <div className="space-y-3">
              <label className="text-base font-black text-army-muted uppercase tracking-widest">ส่วนสูง (ซม.) *</label>
              <input
                required
                type="number"
                value={formData.height}
                onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                placeholder="เช่น 175"
                className="w-full px-6 py-4 bg-army-bg border-2 border-army-bg rounded-2xl focus:border-army-primary transition-all outline-none font-bold"
              />
            </div>

            {/* 9. เบอร์โทร */}
            <div className="space-y-3">
              <label className="text-base font-black text-army-muted uppercase tracking-widest">เบอร์โทรศัพท์ *</label>
              <input
                required
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="เช่น 0812345678"
                className="w-full px-6 py-4 bg-army-bg border-2 border-army-bg rounded-2xl focus:border-army-primary transition-all outline-none font-bold"
              />
            </div>
          </div>
        </section>

        {/* วิธีการรับสินค้า (Fixed) */}
        <section className="bg-white p-10 rounded-[2.5rem] border-2 border-army-light/10 shadow-sm">
          <h2 className="text-base font-black text-army-dark mb-8 uppercase tracking-[0.2em] flex items-center space-x-3">
            <MapPin size={18} />
            <span>วิธีการรับสินค้า</span>
          </h2>
          <div className="space-y-6">
            <div className="p-6 rounded-2xl border-2 border-army-primary bg-army-primary text-white shadow-xl shadow-army-primary/20 flex items-center space-x-4">
              <School size={32} />
              <div>
                <p className="font-black text-base uppercase tracking-widest">ส่งไปยังโรงเรียนของท่าน</p>
                <p className="text-base font-medium text-army-light">จัดส่งถึงโรงเรียนตามข้อมูลที่ระบุ</p>
              </div>
            </div>
            
            <div className="bg-amber-50 border-2 border-amber-200 p-6 rounded-2xl flex items-start space-x-4">
              <Info className="text-amber-600 flex-shrink-0" size={20} />
              <p className="text-base font-black text-amber-800 uppercase tracking-widest leading-relaxed">
                หมายเหตุ: ให้ติดต่อรับกับครูผู้ดูแลกิจกรรม นศท.
              </p>
            </div>
          </div>
        </section>

        {formError && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl mb-4">
            <p className="text-red-700 font-bold">{formError}</p>
          </div>
        )}

        <button
          type="button"
          onClick={handleConfirm}
          disabled={loading}
          className="w-full tactical-button py-8 rounded-[2rem] flex items-center justify-center space-x-4 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-army-primary/20"
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin" size={28} />
              <span className="text-lg font-black uppercase tracking-widest">กำลังดำเนินการ...</span>
            </>
          ) : (
            <>
              <ShoppingCart size={28} />
              <span className="text-lg font-black uppercase tracking-widest">ยืนยันการสั่งซื้อ</span>
            </>
          )}
        </button>
      </form>

      <AnimatePresence>
        {notificationStep > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white p-8 rounded-3xl max-w-md w-full relative"
            >
              {!loading && (
                <button 
                  onClick={() => setNotificationStep(0)}
                  className="absolute top-6 right-6 text-army-muted hover:text-army-dark transition-colors z-10 p-2 hover:bg-army-bg rounded-full"
                >
                  <X size={24} />
                </button>
              )}
              {loading ? (
                <div className="flex flex-col items-center py-8">
                  <Loader2 className="animate-spin text-army-dark" size={48} />
                  <p className="text-army-dark mt-4 font-bold">กำลังบันทึกข้อมูล...</p>
                </div>
              ) : notificationStep === 1 ? (
                <>
                  <h2 className="text-2xl font-black text-army-dark uppercase tracking-tighter mb-4">ตรวจสอบข้อมูล</h2>
                  <div className="text-base text-army-dark mb-6 space-y-2 max-h-60 overflow-y-auto">
                    <p><strong>ชื่อ-นามสกุล:</strong> {formData.firstName} {formData.lastName}</p>
                    <p><strong>ศูนย์ฝึก:</strong> {formData.trainingCenter}</p>
                    <p><strong>โรงเรียน:</strong> {formData.school}</p>
                    <p><strong>ชั้นปี:</strong> {formData.year}</p>
                    <p><strong>เพศ:</strong> {formData.gender}</p>
                    <p><strong>ส่วนสูง:</strong> {formData.height} ซม.</p>
                    <p><strong>เบอร์โทร:</strong> {formData.phone}</p>
                    <p><strong>วิธีการชำระเงิน:</strong> {formData.paymentMethod === 'transfer' ? 'โอนเงิน' : 'ชำระปลายทาง'}</p>
                    <p><strong>วิธีการรับสินค้า:</strong> {formData.deliveryMethod === 'school' ? 'รับที่โรงเรียน' : 'รับที่ศูนย์ฝึก'}</p>
                    <div className="mt-4">
                      <strong>รายการสั่งซื้อ:</strong>
                      <ul className="list-disc list-inside">
                        {cart.map((item, index) => (
                          <li key={index}>{item.name} x {item.quantity}</li>
                        ))}
                      </ul>
                      <p className="mt-2 text-sm text-army-muted">ค่าจัดส่ง: {shippingFee > 0 ? formatPrice(shippingFee) : 'ฟรี'}</p>
                      <p className="mt-1 font-bold">รวมทั้งสิ้น: {formatPrice(totalAmount)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setNotificationStep(2)}
                    className="w-full tactical-button py-4 rounded-xl font-black uppercase tracking-widest"
                  >
                    ตรวจสอบแล้ว ดำเนินการต่อ
                  </button>
                </>
              ) : notificationStep === 2 ? (
                <>
                  <h2 className="text-2xl font-black text-army-dark uppercase tracking-tighter mb-4">ยืนยันการสั่งซื้อ</h2>
                  <p className="text-army-muted mb-8 text-base">คุณต้องการยืนยันการสั่งซื้อใช่หรือไม่?</p>
                  <button
                    onClick={processOrder}
                    className="w-full tactical-button py-4 rounded-xl font-black uppercase tracking-widest"
                  >
                    ยืนยันการสั่งซื้อ
                  </button>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-black text-army-dark uppercase tracking-tighter mb-4">สั่งซื้อสำเร็จ!</h2>
                  <div className="bg-army-bg p-4 rounded-xl mb-6 text-base text-army-dark space-y-2">
                    <p><strong>หมายเลขคำสั่งซื้อ:</strong> {orderId}</p>
                    <p><strong>เบอร์โทรศัพท์:</strong> {formData.phone}</p>
                    <p className="text-red-600 font-bold mt-2">*คุณสามารถใช้เบอร์โทรศัพท์หรือหมายเลขคำสั่งซื้ออย่างใดอย่างหนึ่งเพื่อติดตามสถานะพัสดุ ที่เมนู ติดตามพัสดุ</p>
                  </div>
                  <p className="text-army-muted mb-8 text-base">คุณสามารถติดตามสถานะพัสดุได้ที่เมนู "ติดตามพัสดุ" ในหน้าหลัก</p>
                  <button
                    onClick={() => setNotificationStep(0)}
                    className="w-full tactical-button py-4 rounded-xl font-black uppercase tracking-widest"
                  >
                    ปิด
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
