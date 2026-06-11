import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { googleSheetService } from '../services/googleSheetService';
import { Product } from '../types';
import { formatPrice, cn, parseSizes, fixProductPrice } from '../lib/utils';
import { ShoppingCart, ArrowLeft, ShieldCheck, Truck, RefreshCcw, Package, Minus, Plus, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';

import { INITIAL_PRODUCTS } from '../data/initialProducts';

interface ProductDetailProps {
  onAddToCart: (product: Product, quantity: number, size?: string, color?: string, gender?: string) => void;
}

export default function ProductDetail({ onAddToCart }: ProductDetailProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState<string | undefined>();
  const [selectedColor, setSelectedColor] = useState<string | undefined>();
  const [selectedGender, setSelectedGender] = useState<string | undefined>();

  useEffect(() => {
    let isMounted = true;
    let intervalId: any;

    const fetchProduct = async (showLoading = true) => {
      if (!id) return;
      if (showLoading) setLoading(true);
      try {
        const sheetProducts = await googleSheetService.fetchRecords('Products');
        const match = sheetProducts.find((p: any) => p.id === id);
        if (match) {
          const parsedProduct = {
            id: match.id,
            name: match.name,
            price: fixProductPrice(match.name, Number(match.price) || 0),
            originalPrice: Number(match.originalPrice) || 0,
            imageUrl: match.imageUrl || match.image || '',
            description: match.description || '',
            category: match.category || '',
            stock: Number(match.stock) ?? 100,
            sizes: parseSizes(match.sizes),
            genders: (() => { if (!match.genders) return []; if (typeof match.genders === 'string') { try { return JSON.parse(match.genders); } catch(e) { return []; } } return Array.isArray(match.genders) ? match.genders : []; })(),
            colors: (() => { if (!match.colors) return []; if (typeof match.colors === 'string') { try { return JSON.parse(match.colors); } catch(e) { return []; } } return Array.isArray(match.colors) ? match.colors : []; })(),
            available: match.available === 'true' || match.available === true,
          } as any;
          setProduct(parsedProduct);
          // Only auto-select on first load if nothing was selected
          if (showLoading) {
            if (parsedProduct.sizes && parsedProduct.sizes.length > 0) setSelectedSize(parsedProduct.sizes[0]);
            if (parsedProduct.colors && parsedProduct.colors.length > 0) setSelectedColor(parsedProduct.colors[0]);
            if (parsedProduct.genders && parsedProduct.genders.length > 0) setSelectedGender(parsedProduct.genders[0]);
          }
          if (showLoading) setLoading(false);
          return;
        }
      } catch (error: any) {
        console.warn('Error fetching product from Google Sheets, trying fallback caches:', error);
      }

      if (!isMounted) return;

      if (showLoading) {
        // Try cache first
      const cachedP = localStorage.getItem('admin_products_cache');
      if (cachedP) {
        try {
          const parsed = JSON.parse(cachedP);
          const cachedProduct = parsed.find((p: any) => p.id === id);
          if (cachedProduct) {
            cachedProduct.price = fixProductPrice(cachedProduct.name, cachedProduct.price);
            
            // Ensure array properties are actually arrays
            if (typeof cachedProduct.sizes === 'string') {
              try { cachedProduct.sizes = JSON.parse(cachedProduct.sizes); } catch(e) { cachedProduct.sizes = []; }
            }
            if (typeof cachedProduct.genders === 'string') {
              try { cachedProduct.genders = JSON.parse(cachedProduct.genders); } catch(e) { cachedProduct.genders = []; }
            }
            if (typeof cachedProduct.colors === 'string') {
              try { cachedProduct.colors = JSON.parse(cachedProduct.colors); } catch(e) { cachedProduct.colors = []; }
            }
            
            setProduct(cachedProduct);
            if (Array.isArray(cachedProduct.sizes) && cachedProduct.sizes.length > 0) setSelectedSize(cachedProduct.sizes[0]);
            if (Array.isArray(cachedProduct.colors) && cachedProduct.colors.length > 0) setSelectedColor(cachedProduct.colors[0]);
            if (Array.isArray(cachedProduct.genders) && cachedProduct.genders.length > 0) setSelectedGender(cachedProduct.genders[0]);
            setLoading(false);
            return;
          }
        } catch (e) {}
      }

      // Fallback
      const fallbackProduct = INITIAL_PRODUCTS.find(p => p.id === id);
      if (fallbackProduct) {
        const fb = { ...fallbackProduct, price: fixProductPrice(fallbackProduct.name, fallbackProduct.price) };
        if (typeof fb.sizes === 'string') { try { fb.sizes = JSON.parse(fb.sizes); } catch(e) { fb.sizes = []; } }
        if (typeof fb.genders === 'string') { try { fb.genders = JSON.parse(fb.genders); } catch(e) { fb.genders = []; } }
        if (typeof fb.colors === 'string') { try { fb.colors = JSON.parse(fb.colors); } catch(e) { fb.colors = []; } }
        setProduct(fb as Product);
        if (Array.isArray(fb.sizes) && fb.sizes.length > 0) setSelectedSize(fb.sizes[0]);
        if (Array.isArray(fb.colors) && fb.colors.length > 0) setSelectedColor(fb.colors[0]);
        if (Array.isArray(fb.genders) && fb.genders.length > 0) setSelectedGender(fb.genders[0]);
      } else {
        console.error("ProductDetail: Product not found, navigating home.");
        navigate('/');
      }

      }
      if (showLoading) setLoading(false);
    };

    fetchProduct(true).catch(e => {
        console.error("ProductDetail fetchProduct error:", e);
        setLoading(false);
    });
    
    intervalId = setInterval(() => {
      if (isMounted) {
        fetchProduct(false).catch(e => console.error("ProductDetail fetchProduct error:", e));
      }
    }, 3000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="aspect-square bg-slate-100 rounded-3xl" />
          <div className="space-y-6">
            <div className="h-10 bg-slate-100 rounded w-3/4" />
            <div className="h-6 bg-slate-100 rounded w-1/4" />
            <div className="h-32 bg-slate-100 rounded w-full" />
            <div className="h-12 bg-slate-100 rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) return null;

  const isOutOfStock = product.stock <= 0;

  const handleAddToCart = () => {
    onAddToCart(product, quantity, selectedSize, selectedColor, selectedGender);
    alert('เพิ่มสินค้าลงตะกร้าเรียบร้อยแล้ว');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back Button */}
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center space-x-2 text-army-muted hover:text-army-primary transition-colors mb-8 font-black uppercase tracking-widest text-base group"
      >
        <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
        <span>ย้อนกลับ</span>
      </button>

      {/* Breadcrumbs */}
      <nav className="flex items-center space-x-2 text-base font-black uppercase tracking-widest text-army-muted mb-12">
        <Link to="/" className="hover:text-army-primary transition-colors">หน้าแรก</Link>
        <span className="text-army-light">/</span>
        <span className="hover:text-army-primary transition-colors cursor-pointer">หมวดหมู่สินค้า: {product.category}</span>
        <span className="text-army-light">/</span>
        <span className="text-army-dark truncate">{product.name.replace('(จำหน่ายเป็นชุดเสื้อและกางเกงขนาดเดียวกัน)', '').trim()}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        {/* Image Gallery */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-4"
        >
          <div className="aspect-square bg-white rounded-[2.5rem] border border-army-light/20 overflow-hidden shadow-2xl shadow-army-primary/5">
            <img
              src={product.imageUrl || `https://picsum.photos/seed/${product.id}/800/800`}
              alt={product.name}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        </motion.div>

        {/* Product Info */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex flex-col"
        >
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <span className="bg-army-primary/10 backdrop-blur-md text-army-primary text-base font-black px-3 py-1 rounded-full border border-army-primary/10 uppercase tracking-widest">
                หมวดหมู่สินค้า: {product.category}
              </span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-black text-army-dark mb-4 leading-none tracking-tighter uppercase">
              {product.name.includes('(จำหน่ายเป็นชุดเสื้อและกางเกงขนาดเดียวกัน)') ? (
                <>
                  {product.name.replace('(จำหน่ายเป็นชุดเสื้อและกางเกงขนาดเดียวกัน)', '').trim()}
                  <span className="block mt-2 text-xl sm:text-2xl text-orange-500 font-bold normal-case tracking-normal">
                    (จำหน่ายเป็นชุดเสื้อและกางเกงขนาดเดียวกัน)
                  </span>
                </>
              ) : product.name}
            </h1>
          </div>

          <div className="mb-10 p-8 bg-white border-2 border-army-light/10 rounded-[2rem] shadow-sm">
            <div className="flex flex-col mb-6">
              <span className="text-base font-black text-army-light uppercase tracking-widest leading-none mb-2">ราคา</span>
              <span className="text-5xl font-mono font-black text-army-dark tracking-tighter">
                {formatPrice(product.price)}
              </span>
            </div>
            {isOutOfStock && (
              <p className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-base font-black uppercase tracking-widest border bg-red-50 text-red-500 border-red-100">
                <Package size={14} />
                <span>สินค้าหมด</span>
              </p>
            )}
          </div>

          <div className="prose prose-slate prose-sm mb-10">
            <h3 className="text-army-dark text-base font-black uppercase tracking-widest mb-4">รายละเอียดสินค้า</h3>
            <div className="text-army-muted leading-relaxed font-medium">
              <ReactMarkdown>{product.description}</ReactMarkdown>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-8 mb-10">
            {Array.isArray(product.genders) && product.genders.length > 0 && (
              <div>
                <label className="block text-base font-black text-army-dark mb-4 uppercase tracking-widest">เลือกเพศ</label>
                <div className="flex flex-wrap gap-3">
                  {product.genders.map((gender) => (
                    <button
                      key={gender}
                      onClick={() => setSelectedGender(gender)}
                      className={cn(
                        "px-8 py-4 rounded-2xl border-2 font-black text-base transition-all uppercase tracking-widest",
                        selectedGender === gender
                          ? "bg-army-primary border-army-primary text-white shadow-xl shadow-army-primary/20"
                          : "bg-white border-army-light/10 text-army-muted hover:border-army-primary"
                      )}
                    >
                      {gender}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {Array.isArray(product.sizes) && product.sizes.length > 0 && (
              <div>
                <label className="block text-base font-black text-army-dark mb-4 uppercase tracking-widest">
                  {product.name.includes('ชุดฝึก') && !product.name.includes('รองเท้า') ? 'เลือกขนาดรอบเอว (นิ้ว)' : 
                   product.name.includes('รองเท้าประกอบชุดฝึก') ? 'เลือกขนาด (แจ้งขนาดรองเท้าผ้าใบ/รองเท้ากีฬา)' : 'เลือกขนาด'}
                </label>
                
                {product.name.includes('ชุดฝึก') && !product.name.includes('รองเท้า') && (
                  <div className="mb-4 space-y-1">
                    <p className="text-[10px] text-amber-600 font-bold uppercase tracking-widest flex items-center space-x-2">
                      <Sparkles size={12} className="flex-shrink-0" />
                      <span>คำแนะนำ: ควรเลือกขนาดให้ใหญ่กว่าที่ใส่ปกติ 1 Size เพื่อความสะดวกในการฝึก</span>
                    </p>
                    {product.name.includes('ชุดฝึกผ้าก้างปลา') && (
                      <p className="text-[10px] text-army-muted font-bold uppercase tracking-widest flex items-center space-x-2">
                        <span className="ml-[2px] w-[12px] flex justify-center">•</span>
                        <span>หมายเหตุ สินค้าไซส์เล็กสุด 26 นิ้ว และสินค้าไซส์ใหญ่สุด 52 นิ้ว</span>
                      </p>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  {product.sizes.map((size) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={cn(
                        "w-14 h-14 rounded-2xl border-2 font-black text-base transition-all uppercase tracking-widest",
                        selectedSize === size
                          ? "bg-army-primary border-army-primary text-white shadow-xl shadow-army-primary/20"
                          : "bg-white border-army-light/10 text-army-muted hover:border-army-primary"
                      )}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-base font-black text-army-dark mb-4 uppercase tracking-widest">จำนวน</label>
              <div className="flex items-center space-x-4">
                <div className="flex items-center bg-army-bg rounded-2xl p-1">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-12 h-12 flex items-center justify-center hover:bg-white rounded-xl transition-all text-army-muted"
                  >
                    <Minus size={20} />
                  </button>
                  <span className="w-16 text-center font-mono font-black text-army-dark text-lg">{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                    className="w-12 h-12 flex items-center justify-center hover:bg-white rounded-xl transition-all text-army-muted"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 mb-12">
            <button
              onClick={handleAddToCart}
              disabled={isOutOfStock}
              className={cn(
                "flex-grow tactical-button py-6 rounded-2xl flex items-center justify-center space-x-4",
                isOutOfStock && "opacity-50 cursor-not-allowed shadow-none"
              )}
            >
              <span>เพิ่มลงตะกร้า</span>
            </button>
          </div>

        </motion.div>
      </div>
    </div>
  );
}
