import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType, auth } from '../firebase';
import { Product } from '../types';
import { googleSheetService } from '../services/googleSheetService';
import { formatPrice, cn, parseSizes, fixProductPrice } from '../lib/utils';
import { 
  Plus, Search, Edit2, Trash2, Package, Image as ImageIcon, 
  Tag, ChevronLeft, Save, X, Loader2, AlertCircle, Shirt, Book, Pencil, Gift,
  LayoutDashboard, ShoppingCart, Truck, Settings as SettingsIcon, LogOut, Menu, TrendingUp, ArrowLeft,
  Building2, School, Printer, SortAsc, UserCircle, Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { INITIAL_PRODUCTS } from '../data/initialProducts';

const CATEGORIES = ['ชุดฝึก/เครื่องแบบ', 'รองเท้าจังเกิ้ลหนังแท้สีดำ', 'อุปกรณ์สนาม'];

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [inputGenders, setInputGenders] = useState('');
  const [inputSizes, setInputSizes] = useState('');
  const [inputColors, setInputColors] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    category: 'ชุดฝึก/เครื่องแบบ',
    stock: 0,
    imageUrl: '',
    sizes: [] as string[],
    colors: [] as string[],
    genders: [] as string[],
  });

  const fetchProducts = async () => {
    try {
      const sheetProducts = await googleSheetService.fetchRecords('Products');
      if (sheetProducts && sheetProducts.length > 0) {
        const parsedProducts = sheetProducts.map((p: any) => ({
          id: p.id,
          name: p.name,
          price: fixProductPrice(p.name, Number(p.price) || 0),
          originalPrice: Number(p.originalPrice) || 0,
          image: p.image || p.imageUrl || '',
          imageUrl: p.imageUrl || p.image || '',
          description: p.description || '',
          category: p.category || '',
          stock: Number(p.stock) ?? 100,
          sizes: parseSizes(p.sizes),
          genders: (() => { if (!p.genders) return []; if (typeof p.genders === 'string') { try { return JSON.parse(p.genders); } catch(e) { return []; } } return Array.isArray(p.genders) ? p.genders : []; })(),
          colors: (() => { if (!p.colors) return []; if (typeof p.colors === 'string') { try { return JSON.parse(p.colors); } catch(e) { return []; } } return Array.isArray(p.colors) ? p.colors : []; })(),
          available: p.available === 'true' || p.available === true,
        }));
        setProducts(parsedProducts as Product[]);
      } else {
        const fixPrices = (list: any[]) => list.map(p => ({ ...p, price: fixProductPrice(p.name, p.price) }));
        setProducts(fixPrices(INITIAL_PRODUCTS) as Product[]);
      }
    } catch (sheetError) {
      const fixPrices = (list: any[]) => list.map(p => ({ ...p, price: fixProductPrice(p.name, p.price) }));
      setProducts(fixPrices(INITIAL_PRODUCTS) as Product[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate('/login');
        return;
      }
    });

    fetchProducts();

    return () => {
      unsubscribeAuth();
    };
  }, [navigate]);

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        description: product.description || '',
        price: product.price,
        category: product.category,
        stock: product.stock,
        imageUrl: product.imageUrl || '',
        sizes: product.sizes || [],
        colors: product.colors || [],
        genders: product.genders || [],
      });
      setInputGenders((product.genders || []).join(', '));
      setInputSizes((product.sizes || []).join(', '));
      setInputColors((product.colors || []).join(', '));
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        description: '',
        price: 0,
        category: 'ชุดฝึก/เครื่องแบบ',
        stock: 0,
        imageUrl: '',
        sizes: [],
        colors: [],
        genders: [],
      });
      setInputGenders('');
      setInputSizes('');
      setInputColors('');
    }
    setIsModalOpen(true);
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const finalGenders = inputGenders.split(',').map(s => s.trim()).filter(s => s !== '');
    const finalSizes = inputSizes.split(',').map(s => s.trim()).filter(s => s !== '');
    const finalColors = inputColors.split(',').map(s => s.trim()).filter(s => s !== '');

    try {
      const dataToSave = {
        ...formData,
        image: formData.imageUrl,
        genders: JSON.stringify(finalGenders),
        sizes: JSON.stringify(finalSizes),
        colors: JSON.stringify(finalColors),
      };

      if (editingProduct) {
        await googleSheetService.syncRecord('Products', { id: editingProduct.id, ...dataToSave, updatedAt: new Date() });
      } else {
        const generatedId = Math.random().toString(36).substring(2, 10).toUpperCase();
        await googleSheetService.syncRecord('Products', { id: generatedId, ...dataToSave, createdAt: new Date(), updatedAt: new Date() });
      }
      setIsModalOpen(false);
      fetchProducts();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    try {
      await googleSheetService.syncRecord('Products', { id, available: false });
      setConfirmDelete(null);
      fetchProducts();
    } catch (error) {
      console.error("Delete Error", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  const renderSidebar = () => (
    <div className="w-64 bg-white border-r-2 border-army-bg h-screen fixed top-0 left-0 z-[100] flex flex-col md:translate-x-0 transition-transform duration-300 ease-in-out" style={{ transform: isSidebarOpen || window.innerWidth >= 768 ? 'translateX(0)' : 'translateX(-100%)' }}>
      <div className="p-8 border-b-2 border-army-bg flex items-center justify-between">
        <h1 className="text-2xl font-black text-army-dark uppercase tracking-tighter flex items-center space-x-3">
          <div className="w-8 h-8 bg-army-dark text-white rounded-lg flex items-center justify-center">
            <LayoutDashboard size={18} />
          </div>
          <span>ADMIN</span>
        </h1>
        <button className="md:hidden text-army-muted" onClick={() => setIsSidebarOpen(false)}>
          <X size={24} />
        </button>
      </div>
      <div className="flex-grow py-6 px-4 space-y-2 overflow-y-auto">
        <button
          onClick={() => navigate('/admin?tab=summary')}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-black uppercase tracking-normal transition-all text-army-muted hover:bg-army-bg hover:text-army-dark"
        >
          <TrendingUp size={20} />
          <span>สรุปคำสั่งซื้อ</span>
        </button>
        <button
          onClick={() => navigate('/admin?tab=orders')}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-black uppercase tracking-normal transition-all text-army-muted hover:bg-army-bg hover:text-army-dark"
        >
          <ShoppingCart size={20} />
          <span>จัดการคำสั่งซื้อ</span>
        </button>
        <button
          onClick={() => navigate('/admin?tab=tracking')}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-black uppercase tracking-normal transition-all text-army-muted hover:bg-army-bg hover:text-army-dark"
        >
          <Truck size={20} />
          <span>ติดตามพัสดุ</span>
        </button>
        <button
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-black uppercase tracking-normal transition-all bg-army-dark text-white"
        >
          <Package size={20} />
          <span>จัดการสต็อก</span>
        </button>
        <button
          onClick={() => navigate('/admin?tab=settings')}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-black uppercase tracking-normal transition-all text-army-muted hover:bg-army-bg hover:text-army-dark"
        >
          <SettingsIcon size={20} />
          <span>ตั้งค่าการชำระเงิน</span>
        </button>
        <button
          onClick={() => navigate('/admin?tab=schools')}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-black uppercase tracking-normal transition-all text-army-muted hover:bg-army-bg hover:text-army-dark"
        >
          <Building2 size={20} />
          <span>พิมพ์ใบปะหน้า</span>
        </button>
        <button
          onClick={() => navigate('/admin?tab=print_orders')}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-black uppercase tracking-normal transition-all text-army-muted hover:bg-army-bg hover:text-army-dark"
        >
          <Printer size={20} />
          <span>พิมพ์ใบสั่งซื้อ</span>
        </button>
        <button
          onClick={() => navigate('/admin?tab=admins')}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-black uppercase tracking-normal transition-all text-army-muted hover:bg-army-bg hover:text-army-dark"
        >
          <Users size={20} />
          <span>จัดการแอดมิน</span>
        </button>
      </div>
      <div className="p-4 border-t-2 border-army-bg space-y-2">
        <button
          onClick={() => navigate('/')}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-black uppercase tracking-normal transition-all text-army-dark hover:bg-army-bg"
        >
          <ArrowLeft size={20} />
          <span>กลับไปหน้าร้านค้า</span>
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-black uppercase tracking-normal transition-all text-red-500 hover:bg-red-50"
        >
          <LogOut size={20} />
          <span>ออกจากระบบ</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-army-bg/30 flex">
      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmDelete && (
          <div className="fixed inset-0 bg-army-dark/50 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
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
                <p className="text-sm font-bold text-army-muted">คุณต้องการลบ <span className="text-army-dark">{confirmDelete.name}</span> ใช่หรือไม่?</p>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => setConfirmDelete(null)} 
                  className="flex-1 px-6 py-3 bg-army-bg text-army-dark rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-army-light transition-all"
                >
                  ยกเลิก
                </button>
                <button 
                  onClick={() => handleDelete(confirmDelete.id)} 
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-red-700 transition-all shadow-lg shadow-red-600/20"
                >
                  ลบออก
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-army-dark/50 z-30 md:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {renderSidebar()}

      <div className="flex-grow md:ml-64 p-4 sm:p-8">
        <div className="md:hidden flex items-center justify-between mb-8 bg-white p-4 rounded-2xl shadow-sm border-2 border-army-bg">
          <h1 className="text-xl font-black text-army-dark uppercase tracking-tighter flex items-center space-x-2">
            <LayoutDashboard size={20} />
            <span>ADMIN</span>
          </h1>
          <button onClick={() => setIsSidebarOpen(true)} className="text-army-dark">
            <Menu size={24} />
          </button>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-12">
          <div className="flex items-center space-x-6">
            <button onClick={() => navigate('/admin')} className="p-3 bg-white border-2 border-army-bg rounded-2xl text-army-dark hover:border-army-dark transition-all">
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-4xl font-black text-army-dark flex items-center space-x-4 tracking-tighter uppercase">
                <Package size={36} />
                <span>จัดการสต็อก</span>
              </h1>
              <p className="text-army-muted font-black uppercase tracking-widest text-base mt-2">จัดการรายการสินค้าและจำนวนสต็อก</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
          <button 
            onClick={() => handleOpenModal()}
            className="tactical-button px-8 py-4 rounded-2xl text-base flex items-center space-x-3"
          >
            <Plus size={20} />
            <span>เพิ่มอุปกรณ์ใหม่</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-6 rounded-[2rem] border-2 border-army-bg shadow-sm mb-12 flex flex-col md:flex-row gap-6 items-center">
        <div className="relative flex-grow w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-army-muted" size={20} />
          <input
            type="text"
            placeholder="ค้นหาชื่ออุปกรณ์หรือหมวดหมู่..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-6 py-4 bg-army-bg border-2 border-army-bg rounded-2xl text-base font-black uppercase tracking-tight outline-none focus:border-army-dark transition-all"
          />
        </div>
        <div className="flex items-center space-x-3 text-base font-black text-army-muted uppercase tracking-widest bg-army-bg px-6 py-4 rounded-2xl border-2 border-army-bg">
          <Tag size={18} />
          <span>ทั้งหมด: {products.length} รายการ</span>
        </div>
      </div>

      {/* Product List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        <AnimatePresence mode="popLayout">
          {filteredProducts.map((product) => (
            <motion.div
              key={product.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-[2.5rem] border-2 border-army-bg overflow-hidden shadow-sm hover:border-army-dark transition-all group"
            >
              <div className="aspect-[4/3] bg-army-bg relative overflow-hidden">
                <img
                  src={product.imageUrl || `https://picsum.photos/seed/${product.id}/400/300`}
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-4 right-4 flex space-x-2">
                  <button 
                    onClick={() => handleOpenModal(product)}
                    className="p-3 bg-white/90 backdrop-blur-md text-army-dark rounded-xl shadow-lg hover:bg-army-dark hover:text-white transition-all border border-white"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => setConfirmDelete({ id: product.id, name: product.name })}
                    className="p-3 bg-white/90 backdrop-blur-md text-red-600 rounded-xl shadow-lg hover:bg-red-600 hover:text-white transition-all border border-white"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="absolute bottom-4 left-4">
                  <span className="bg-army-dark/90 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-army-primary">
                    หมวดหมู่สินค้า: {product.category.toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="p-6">
                <h3 className="text-base font-black text-army-dark uppercase tracking-tight mb-2 line-clamp-1">{product.name}</h3>
                <div className="flex justify-between items-end">
                  <p className="text-xl font-mono font-black text-army-dark tracking-tighter">{formatPrice(product.price)}</p>
                  <p className={cn(
                    "text-base font-black uppercase tracking-widest px-2 py-1 rounded-md transition-all",
                    product.stock < 10 
                      ? "bg-red-50 text-red-600 underline decoration-2 underline-offset-4" 
                      : "bg-army-bg text-army-muted"
                  )}>
                    สต็อก: {product.stock}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-army-dark/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="relative bg-white w-full max-w-3xl rounded-[3rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col border-4 border-army-dark"
            >
              <div className="p-6 sm:p-10 border-b-2 border-army-bg flex justify-between items-center bg-army-bg/50">
                <h3 className="text-2xl sm:text-3xl font-black text-army-dark uppercase tracking-tighter">
                  {editingProduct ? 'อัปเดตข้อมูลอุปกรณ์' : 'เพิ่มอุปกรณ์ใหม่'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 sm:p-3 hover:bg-white border-2 border-transparent hover:border-army-dark rounded-2xl transition-all text-army-muted hover:text-army-dark">
                  <X size={24} className="sm:w-8 sm:h-8" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 sm:p-10 overflow-y-auto flex-grow space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-base font-black text-army-dark uppercase tracking-widest">ชื่ออุปกรณ์</label>
                    <input
                      required
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-6 py-4 bg-army-bg border-2 border-army-bg rounded-2xl text-base font-black uppercase tracking-tight outline-none focus:border-army-dark transition-all"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-base font-black text-army-dark uppercase tracking-widest">หมวดหมู่</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-6 py-4 bg-army-bg border-2 border-army-bg rounded-2xl text-base font-black uppercase tracking-widest outline-none focus:border-army-dark transition-all"
                    >
                      {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat.toUpperCase()}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-base font-black text-army-dark uppercase tracking-widest">รายละเอียด</label>
                  <textarea
                    rows={4}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-6 py-4 bg-army-bg border-2 border-army-bg rounded-2xl text-base font-black uppercase tracking-tight outline-none focus:border-army-dark transition-all resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-base font-black text-army-dark uppercase tracking-widest">ราคา (บาท)</label>
                    <input
                      required
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                      className="w-full px-6 py-4 bg-army-bg border-2 border-army-bg rounded-2xl text-base font-mono font-black outline-none focus:border-army-dark transition-all"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-base font-black text-army-dark uppercase tracking-widest">จำนวนในสต็อก</label>
                    <input
                      required
                      type="number"
                      value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })}
                      className="w-full px-6 py-4 bg-army-bg border-2 border-army-bg rounded-2xl text-base font-mono font-black outline-none focus:border-army-dark transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-base font-black text-army-dark uppercase tracking-widest">ที่อยู่รูปภาพสินค้า (Image URL)</label>
                  <input
                    type="url"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    placeholder="https://example.com/image.jpg"
                    className="w-full px-6 py-4 bg-army-bg border-2 border-army-bg rounded-2xl text-base font-black uppercase tracking-tight outline-none focus:border-army-dark transition-all"
                  />
                  <p className="text-[10px] text-army-muted leading-relaxed">
                    * โปรดนำรูปภาพไปฝากไว้ที่เว็บฝากรูป (เช่น pic.in.th หรือ imgur.com) แล้วนำลิงก์รูปภาพมาวางที่นี่
                  </p>
                  <div className="mt-4 p-4 bg-army-bg rounded-2xl border-2 border-army-bg flex items-center space-x-4">
                    <div className="w-20 h-20 bg-white rounded-xl border-2 border-army-bg overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {formData.imageUrl ? (
                        <img src={formData.imageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <ImageIcon className="text-army-muted" size={32} />
                      )}
                    </div>
                    <div className="flex-grow">
                      <p className="text-[10px] font-black text-army-muted uppercase tracking-widest mb-1">ตัวอย่างรูปภาพ</p>
                      <p className="text-xs font-mono text-army-dark truncate max-w-[200px]">{formData.imageUrl || 'ยังไม่มีรูปภาพ'}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-base font-black text-army-dark uppercase tracking-widest">ตัวเลือกเพศ (คั่นด้วยเครื่องหมายจุลภาค ,)</label>
                    <input
                      type="text"
                      value={inputGenders}
                      onChange={(e) => setInputGenders(e.target.value)}
                      placeholder="เช่น ชาย, หญิง"
                      className="w-full px-6 py-4 bg-army-bg border-2 border-army-bg rounded-2xl text-base font-black uppercase tracking-tight outline-none focus:border-army-dark transition-all"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-base font-black text-army-dark uppercase tracking-widest">ตัวเลือกขนาด (คั่นด้วยเครื่องหมายจุลภาค ,)</label>
                    <input
                      type="text"
                      value={inputSizes}
                      onChange={(e) => setInputSizes(e.target.value)}
                      placeholder="เช่น 38, 39, 40 หรือ M, L, XL"
                      className="w-full px-6 py-4 bg-army-bg border-2 border-army-bg rounded-2xl text-base font-black uppercase tracking-tight outline-none focus:border-army-dark transition-all"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-base font-black text-army-dark uppercase tracking-widest">ตัวเลือกสี (คั่นด้วยเครื่องหมายจุลภาค ,)</label>
                    <input
                      type="text"
                      value={inputColors}
                      onChange={(e) => setInputColors(e.target.value)}
                      placeholder="เช่น เขียวขี้ม้า, ดำ, กรมท่า"
                      className="w-full px-6 py-4 bg-army-bg border-2 border-army-bg rounded-2xl text-base font-black uppercase tracking-tight outline-none focus:border-army-dark transition-all"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-4 pt-8 border-t-2 border-army-bg">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-8 py-4 text-base font-black text-army-muted uppercase tracking-widest hover:text-army-dark hover:bg-army-bg rounded-2xl transition-all"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="tactical-button px-10 py-4 rounded-2xl text-base flex items-center space-x-3 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                    <span>{editingProduct ? 'บันทึกการเปลี่ยนแปลง' : 'เพิ่มอุปกรณ์เข้าคลัง'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
