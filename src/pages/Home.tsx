import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db, handleFirestoreError, OperationType, auth } from "../firebase";
import { Product, Category } from "../types";
import ProductCard from "../components/ProductCard";
import {
  Search,
  Filter,
  ChevronRight,
  Sparkles,
  Package,
  Footprints,
  Book,
  Pencil,
  Shirt,
  Gift,
  XCircle,
  CheckCircle2,
  AlertCircle,
  Info,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn, parseSizes, fixProductPrice, formatPrice } from "../lib/utils";
import { INITIAL_PRODUCTS } from "../data/initialProducts";

interface HomeProps {
  onAddToCart: (
    product: Product,
    quantity?: number,
    size?: string,
    color?: string,
    gender?: string,
  ) => void;
}

const DEFAULT_CATEGORIES = [
  { id: "all", name: "สินค้าทั้งหมด", icon: Package },
  { id: "uniform", name: "ชุดฝึก/เครื่องแบบ", icon: Shirt },
  { id: "boots", name: "รองเท้าจังเกิ้ลหนังแท้สีดำ", icon: Footprints },
  { id: "accessories", name: "อุปกรณ์สนาม", icon: Gift },
];

const RECOMMENDED_ITEMS = [
  "ชุดฝึกผ้าก้างปลา นศท.ชาย, หญิง",
  "เสื้อยืดรองในสีกากีแกมเขียว  2 ตัว/แพ็ค",
  "หมวกแบเร่ต์ รด. สีเขียวขี้ม้า",
  "รองเท้าประกอบชุดฝึก",
  "ห่วงขาแบบผ้า",
  "เหล็กชิดเท้าสีดำ",
  "เครื่องหมาย นศท.",
  "ถุงเท้าลูกฟูกสีดำ",
  "สายเข็มขัด รด. พร้อมหัวเข็มขัดเหล็กสีรมดำ",
  "ค่าจ้างปักป้ายชื่อ",
  "ค่าจ้างปักเครื่องหมายสถานศึกษา",
  "ค่าจ้างเย็บติดเครื่องหมายรวม 7 ชิ้น",
  "ค่าเครื่องสนาม (เป้, กระติกน้ำ, สายโยงบ่า, เข็มขัดสนาม)",
  "เครื่องหมายจิตอาสา",
];

export default function Home({ onAddToCart }: HomeProps) {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("สินค้าทั้งหมด");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const [showGuideModal, setShowGuideModal] = useState(false);
  const [guideStep, setGuideStep] = useState<1 | 2>(1);
  const [selectedRecommendedItems, setSelectedRecommendedItems] =
    useState<string[]>(RECOMMENDED_ITEMS);
  const [guideSelections, setGuideSelections] = useState<{
    uniformGender?: string;
    uniformSize?: string;
    bootSize?: string;
    beretSize?: string;
    tshirtSize?: string;
  }>({});

  useEffect(() => {
    let isMounted = true;
    try {
      localStorage.removeItem("admin_products_cache");
    } catch (e) {
      console.warn("Could not access localStorage", e);
    }
    const fetchProducts = async (showLoading = true) => {
      try {
        if (isMounted && showLoading) {
          setProducts(INITIAL_PRODUCTS as Product[]);
        }

        const { googleSheetService } = await import("../services/googleSheetService");
        
        // Add a 10 second timeout for fetching products
        const sheetProducts = await Promise.race([
          googleSheetService.fetchRecords("Products"),
          new Promise<any>((_, reject) => 
            setTimeout(() => reject(new Error("Timeout fetching from Google Sheets")), 10000)
          )
        ]);
        
        if (!Array.isArray(sheetProducts)) {
          if (showLoading) setLoading(false);
          return;
        }

        const prods = sheetProducts.map((p: any) => ({
          ...p,
          price: Number(p.price) || 0,
          originalPrice: Number(p.originalPrice) || 0,
          stock: Number(p.stock) || 0,
          sizes: parseSizes(p.sizes),
          colors: (() => {
            if (!p.colors) return [];
            if (typeof p.colors === "string") {
              try { return JSON.parse(p.colors); } catch (e) { return []; }
            }
            return Array.isArray(p.colors) ? p.colors : [];
          })(),
          genders: (() => {
            if (!p.genders) return [];
            if (typeof p.genders === "string") {
              try { return JSON.parse(p.genders); } catch (e) { return []; }
            }
            return Array.isArray(p.genders) ? p.genders : [];
          })(),
        })) as Product[];
        
        prods.sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt as any).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt as any).getTime() : 0;
          return bTime - aTime;
        });

        const fixPrices = (list: any[]) =>
          list.map((p) => ({ ...p, price: fixProductPrice(p.name, p.price) }));

        if (prods.length === 0) {
          throw new Error("No products found from Sheets, falling back to initial data.");
        }

        if (isMounted) {
          setProducts(fixPrices(prods) as Product[]);
          try {
            localStorage.setItem("admin_products_cache", JSON.stringify(prods));
          } catch (e) {
            console.warn("Could not save to localStorage: Quota exceeded", e);
          }
          setLoading(false);
        }
      } catch (error) {
        if (!isMounted) return;
        console.warn("Using offline fallback products due to error", error);
        if (
          error instanceof Error &&
          (error.message.includes("Quota") ||
            error.message.includes("quota") ||
            error.message.includes("RESOURCE_EXHAUSTED"))
        ) {
          (window as any).firestoreTerminated = true;
          sessionStorage.setItem("firestore_quota_exceeded", "true");
        }

        const fixPrices = (list: any[]) =>
          list.map((p) => ({ ...p, price: fixProductPrice(p.name, p.price) }));
        setProducts(fixPrices(INITIAL_PRODUCTS) as Product[]);
        setLoading(false);
      }
    };

    fetchProducts(true);
    const intervalId = setInterval(() => fetchProducts(false), 3000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  const filteredProducts = products.filter((p) => {
    const matchesCategory =
      selectedCategory === "สินค้าทั้งหมด" || p.category === selectedCategory;
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleAddToCart = (product: Product) => {
    if (
      (product.sizes && product.sizes.length > 0) ||
      (product.genders && product.genders.length > 0) ||
      (product.colors && product.colors.length > 0)
    ) {
      navigate(`/product/${product.id}`);
    } else {
      onAddToCart(product);
    }
  };

  const toggleRecommendedItem = (itemName: string) => {
    setSelectedRecommendedItems((prev) =>
      prev.includes(itemName)
        ? prev.filter((i) => i !== itemName)
        : [...prev, itemName],
    );
  };

  const handleGuideNext = () => {
    if (selectedRecommendedItems.length === 0) {
      alert("กรุณาเลือกอย่างน้อย 1 รายการ");
      return;
    }

    const hasSizeRequiredItems = selectedRecommendedItems.some((item) =>
      [
        "ชุดฝึกผ้าก้างปลา",
        "รองเท้าประกอบชุดฝึก",
        "หมวกแบเร่ต์",
        "เสื้อยืดรองในสีกากี",
      ].some((key) => item.includes(key)),
    );

    if (hasSizeRequiredItems) {
      setGuideStep(2);
    } else {
      handleFinalGuideSubmit();
    }
  };

  const handleGuideSubmit = () => {
    // Validate selections
    const isUniformSelected = selectedRecommendedItems.some((item) =>
      item.includes("ชุดฝึกผ้าก้างปลา"),
    );
    const isBootsSelected = selectedRecommendedItems.some((item) =>
      item.includes("รองเท้าประกอบชุดฝึก"),
    );
    const isBeretSelected = selectedRecommendedItems.some((item) =>
      item.includes("หมวกแบเร่ต์"),
    );
    const isTshirtSelected = selectedRecommendedItems.some((item) =>
      item.includes("เสื้อยืดรองในสีกากี"),
    );

    if (
      isUniformSelected &&
      (!guideSelections.uniformGender || !guideSelections.uniformSize)
    ) {
      alert("กรุณาเลือกขนาดและเพศสำหรับชุดฝึก");
      return;
    }
    if (isBootsSelected && !guideSelections.bootSize) {
      alert("กรุณาเลือกขนาดรองเท้า");
      return;
    }
    if (isBeretSelected && !guideSelections.beretSize) {
      alert("กรุณาเลือกขนาดหมวกแบเร่ต์");
      return;
    }
    if (isTshirtSelected && !guideSelections.tshirtSize) {
      alert("กรุณาเลือกขนาดเสื้อยืด");
      return;
    }

    handleFinalGuideSubmit();
  };

  const getProductForRecommendedItem = (itemName: string) => {
    const normalize = (s: string) =>
      s.replace(/\s+/g, " ").replace(/,/g, "").trim().toLowerCase();

    const iNameOriginal = normalize(itemName);

    // First try exact or partial match with original name
    let match = products.find((p) => normalize(p.name) === iNameOriginal);
    if (match) return match;

    match = products.find((p) => {
      const pName = normalize(p.name);
      return pName.includes(iNameOriginal) || iNameOriginal.includes(pName);
    });
    if (match) return match;

    // Check aliases for backwards compatibility with old seed data
    let searchName = itemName;
    if (itemName.includes("เสื้อยืดรองในสีกากีแกมเขียว"))
      searchName = "เสื้อยืดรองในสีกากี";
    if (itemName.includes("ห่วงขาแบบผ้า")) searchName = "สายรัดข้อเท้า";
    if (itemName.includes("สายเข็มขัด รด")) searchName = "เข็มขัด นศท.";
    if (itemName.includes("รองเท้าประกอบชุดฝึก")) searchName = "รองเท้าจังเกิ้ล";

    const iName = normalize(searchName);

    // Then try partial match with alias
    match = products.find((p) => {
      const pName = normalize(p.name);
      return pName.includes(iName) || iName.includes(pName);
    });

    if (match) return match;

    // Last resort fallback for strict exact aliases
    if (itemName.includes("เสื้อยืดรองในสีกากีแกมเขียว"))
      return products.find((p) => p.name.includes("เสื้อยืดรองในสีกากี"));
    if (itemName.includes("ห่วงขาแบบผ้า"))
      return products.find((p) => p.name.includes("สายรัดข้อเท้า"));
    if (itemName.includes("สายเข็มขัด รด"))
      return products.find((p) => p.name.includes("เข็มขัด นศท."));
    if (itemName.includes("รองเท้าประกอบชุดฝึก"))
      return products.find((p) => p.name.includes("รองเท้าจังเกิ้ล") || p.name.includes("รองเท้าประกอบชุดฝึก") || p.name.includes("รองเท้าคอมแบท") || p.name.includes("รองเท้า"));

    return undefined;
  };

  const handleFinalGuideSubmit = () => {
    // Add to cart
    selectedRecommendedItems.forEach((itemName) => {
      const product = getProductForRecommendedItem(itemName);

      if (product) {
        let size = undefined;
        let gender = undefined;
        let quantity = 1;

        if (itemName.includes("ชุดฝึกผ้าก้างปลา")) {
          size = guideSelections.uniformSize;
          gender = guideSelections.uniformGender;
        } else if (itemName.includes("รองเท้าประกอบชุดฝึก")) {
          size = guideSelections.bootSize;
        } else if (itemName.includes("หมวกแบเร่ต์")) {
          size = guideSelections.beretSize;
        } else if (itemName.includes("เสื้อยืดรองในสีกากี")) {
          size = guideSelections.tshirtSize;
          quantity = 1;
        }

        onAddToCart(product, quantity, size, undefined, gender);
      }
    });

    setShowGuideModal(false);
    setGuideStep(1);
    setSelectedRecommendedItems(RECOMMENDED_ITEMS);
    setGuideSelections({});
    alert("เพิ่มสินค้าแนะนำลงตะกร้าเรียบร้อยแล้ว");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Guide Banner */}
      <div className="mb-8 space-y-4">
        <button
          onClick={() => setShowGuideModal(true)}
          className="w-full bg-gradient-to-r from-army-dark to-army-primary p-6 sm:p-8 rounded-[2rem] text-left relative overflow-hidden group shadow-xl shadow-army-primary/20"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 group-hover:bg-white/20 transition-all duration-500" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <Sparkles className="text-yellow-400" size={24} />
                <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-widest">
                  คำแนะนำสำหรับการสั่งซื้อครั้งแรก
                </h2>
              </div>
              <p className="text-army-light text-base sm:text-base font-medium max-w-xl">
                สำหรับนักศึกษาวิชาทหารชั้นปีที่ 1
                หรือผู้ที่ต้องการซื้ออุปกรณ์ครบชุด
                เราได้รวบรวมรายการที่จำเป็นต้องใช้มาให้แล้ว
              </p>
              <div className="mt-4">
                <p className="text-2xl sm:text-4xl font-black text-yellow-400 uppercase tracking-tighter drop-shadow-md">
                  ราคาสินค้าครบชุด 2,390 บาท
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 text-white font-black uppercase tracking-widest text-base bg-white/20 px-6 py-3 rounded-2xl backdrop-blur-sm group-hover:bg-white/30 transition-all w-fit self-start sm:self-center">
              <span>สั่งซื้อสินค้าครบชุด คลิกที่นี่</span>
              <ChevronRight size={18} />
            </div>
          </div>
        </button>

        {/* Login Info Alert */}
        <div className="w-full bg-gradient-to-r from-army-muted to-army-dark p-6 sm:p-8 rounded-[2rem] relative overflow-hidden shadow-xl shadow-army-dark/20">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          <div className="relative z-10 flex items-start sm:items-center space-x-4">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm flex-shrink-0">
              <Info className="text-white" size={24} />
            </div>
            <div>
              <p className="text-base sm:text-base font-black text-white uppercase tracking-widest leading-relaxed">
                สำหรับผู้สั่งซื้อไม่ต้องเข้าสู่ระบบ เมนู "เข้าสู่ระบบ"
                สำหรับเจ้าหน้าที่เท่านั้น
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="sticky top-[5rem] z-40 bg-army-bg/90 backdrop-blur-xl py-4 mb-8 border-b border-army-light/10">
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center">
          <div className="relative flex-grow group max-w-full lg:max-w-md">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-army-light group-focus-within:text-army-primary transition-colors"
              size={18}
            />
            <input
              type="text"
              placeholder="ค้นหาอุปกรณ์..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border-2 border-army-bg rounded-2xl text-base font-black uppercase tracking-tight outline-none focus:border-army-primary shadow-sm transition-all"
            />
          </div>

          <div className="flex items-center space-x-2 overflow-x-auto scrollbar-hide no-scrollbar flex-nowrap pb-2 lg:pb-0">
            {DEFAULT_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.name)}
                className={cn(
                  "flex items-center space-x-2 px-4 py-3 rounded-xl font-black uppercase tracking-widest text-[9px] transition-all border-2 whitespace-nowrap",
                  selectedCategory === cat.name
                    ? "bg-army-primary text-white border-army-primary shadow-lg shadow-army-primary/10"
                    : "bg-white text-army-muted border-army-light/10 hover:border-army-primary hover:text-army-primary",
                )}
              >
                <cat.icon size={14} />
                <span>{cat.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-8">
        <AnimatePresence mode="popLayout">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl sm:rounded-[2rem] border-2 border-army-light/5 p-3 sm:p-6 animate-pulse shadow-sm"
              >
                <div className="aspect-square bg-army-bg rounded-xl sm:rounded-2xl mb-3 sm:mb-6" />
                <div className="h-4 sm:h-5 bg-army-bg rounded-lg w-3/4 mb-2 sm:mb-3" />
                <div className="hidden sm:block h-4 bg-army-bg rounded-lg w-1/2 mb-6" />
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
                  <div className="h-6 sm:h-8 bg-army-bg rounded-lg w-1/2 sm:w-1/3" />
                  <div className="h-8 sm:h-12 bg-army-bg rounded-xl w-1/3" />
                </div>
              </div>
            ))
          ) : filteredProducts.length > 0 ? (
            filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))
          ) : (
            <div className="col-span-full py-32 text-center">
              <div className="inline-flex items-center justify-center w-24 h-24 bg-army-bg rounded-[2rem] text-army-light mb-8 border-2 border-army-light/10">
                <Search size={48} />
              </div>
              <h3 className="text-2xl font-black text-army-dark mb-4 uppercase tracking-tighter">
                ไม่พบสินค้า
              </h3>
              <p className="text-army-muted font-medium max-w-md mx-auto mb-10">
                ไม่พบอุปกรณ์ที่ตรงกับการค้นหาของคุณ
                กรุณาตรวจสอบคำค้นหาหรือเปลี่ยนหมวดหมู่
              </p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("สินค้าทั้งหมด");
                }}
                className="text-army-primary font-black uppercase tracking-widest text-base hover:underline decoration-2 underline-offset-8"
              >
                ล้างการค้นหาทั้งหมด
              </button>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Guide Modal */}
      <AnimatePresence>
        {showGuideModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowGuideModal(false)}
              className="absolute inset-0 bg-army-dark/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="relative bg-white w-full max-w-3xl rounded-[3rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col border-4 border-army-dark"
            >
              <div className="p-8 border-b-2 border-army-bg flex justify-between items-center bg-army-bg/50">
                <div>
                  <h3 className="text-2xl font-black text-army-dark uppercase tracking-tighter">
                    รายการแนะนำสั่งซื้อครั้งแรก
                  </h3>
                  <p className="text-base text-army-muted font-black mt-1 uppercase tracking-widest">
                    ขั้นตอนที่ {guideStep} / 2
                  </p>
                </div>
                <button
                  onClick={() => setShowGuideModal(false)}
                  className="p-2 hover:bg-white border-2 border-transparent hover:border-army-dark rounded-2xl transition-all text-army-muted hover:text-army-dark"
                >
                  <XCircle size={28} />
                </button>
              </div>

              <div className="p-8 overflow-y-auto flex-grow">
                {guideStep === 1 ? (
                  <div className="space-y-8">
                    <div className="bg-amber-50 border-2 border-amber-200 p-6 rounded-2xl flex items-start space-x-4">
                      <Info
                        className="text-amber-600 flex-shrink-0"
                        size={24}
                      />
                      <div>
                        <p className="text-base font-black text-amber-800 uppercase tracking-widest mb-1">
                          รายการอุปกรณ์ {RECOMMENDED_ITEMS.length} รายการ
                        </p>
                        <p className="text-xl font-black text-army-primary mb-2">
                          ราคาสินค้าครบชุด 2,390 บาท
                        </p>
                        <p className="text-base text-amber-700 font-medium leading-relaxed">
                          รายการด้านล่างนี้คืออุปกรณ์ที่ นศท. แนะนำสำหรับการฝึก
                          สามารถเลือกรายการที่ต้องการได้ตามความพอใจ
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {RECOMMENDED_ITEMS.map((item, idx) => {
                        const isSelected =
                          selectedRecommendedItems.includes(item);
                        return (
                          <button
                            key={idx}
                            onClick={() => toggleRecommendedItem(item)}
                            className={cn(
                              "flex items-center justify-between p-4 rounded-2xl border-2 transition-all text-left group",
                              isSelected
                                ? "bg-emerald-50 border-emerald-500 shadow-sm"
                                : "bg-white border-army-light/10 grayscale opacity-60 hover:opacity-100",
                            )}
                          >
                            <div className="flex items-center space-x-3">
                              <div
                                className={cn(
                                  "w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all",
                                  isSelected
                                    ? "bg-emerald-500 border-emerald-500 text-white"
                                    : "border-army-light/20 bg-white",
                                )}
                              >
                                {isSelected && <CheckCircle2 size={16} />}
                              </div>
                              <span
                                className={cn(
                                  "text-base font-black uppercase tracking-tight transition-colors",
                                  isSelected
                                    ? "text-emerald-900"
                                    : "text-army-muted",
                                )}
                              >
                                {idx + 1}. {item}
                                {item.includes("เสื้อยืดรองในสีกากี") && (
                                  <span className="text-army-primary ml-1"></span>
                                )}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-8">
                    <div className="bg-army-bg p-6 rounded-2xl border-2 border-army-light/10">
                      <h4 className="text-base font-black text-army-dark mb-6 uppercase tracking-widest flex items-center space-x-2">
                        <Shirt size={18} />
                        <span>เลือกขนาดอุปกรณ์</span>
                      </h4>

                      <div className="space-y-6">
                        {/* Uniform */}
                        {selectedRecommendedItems.some((item) =>
                          item.includes("ชุดฝึกผ้าก้างปลา"),
                        ) && (
                          <div className="space-y-3">
                            <label className="text-base font-black text-army-muted uppercase tracking-widest">
                              ชุดฝึกผ้าก้างปลา นศท. *
                            </label>
                            <p className="text-[10px] text-amber-600 font-bold uppercase tracking-widest mb-1 flex items-center space-x-2">
                              <Sparkles size={12} />
                              <span>
                                คำแนะนำ: ควรเลือกขนาดให้ใหญ่กว่าที่ใส่ปกติ 1
                                Size เพื่อความสะดวกในการฝึก
                              </span>
                            </p>
                            <div className="grid grid-cols-2 gap-4">
                              <select
                                value={guideSelections.uniformGender || ""}
                                onChange={(e) =>
                                  setGuideSelections({
                                    ...guideSelections,
                                    uniformGender: e.target.value,
                                  })
                                }
                                className="w-full px-4 py-3 bg-white border-2 border-army-light/20 rounded-xl focus:border-army-primary transition-all outline-none font-bold text-base"
                              >
                                <option value="">-- เลือกเพศ --</option>
                                <option value="ชาย">ชาย</option>
                                <option value="หญิง">หญิง</option>
                              </select>
                              <select
                                value={guideSelections.uniformSize || ""}
                                onChange={(e) =>
                                  setGuideSelections({
                                    ...guideSelections,
                                    uniformSize: e.target.value,
                                  })
                                }
                                className="w-full px-4 py-3 bg-white border-2 border-army-light/20 rounded-xl focus:border-army-primary transition-all outline-none font-bold text-base"
                              >
                                <option value="">-- เลือกขนาด --</option>
                                {(parseSizes(
                                  getProductForRecommendedItem(
                                    "ชุดฝึกผ้าก้างปลา",
                                  )?.sizes,
                                ).length > 1
                                  ? parseSizes(
                                      getProductForRecommendedItem(
                                        "ชุดฝึกผ้าก้างปลา",
                                      )?.sizes,
                                    )
                                  : [
                                      "27",
                                      "28",
                                      "29",
                                      "30",
                                      "31",
                                      "32",
                                      "33",
                                      "34",
                                      "35",
                                      "36",
                                      "37",
                                      "38",
                                      "39",
                                      "40",
                                      "41",
                                      "42",
                                    ]
                                ).map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}

                        {/* Boots */}
                        {selectedRecommendedItems.some((item) =>
                          item.includes("รองเท้าประกอบชุดฝึก"),
                        ) && (
                          <div className="space-y-3">
                            <label className="text-base font-black text-army-muted uppercase tracking-widest">
                              รองเท้าจังเกิ้ล *
                            </label>
                            <select
                              value={guideSelections.bootSize || ""}
                              onChange={(e) =>
                                setGuideSelections({
                                  ...guideSelections,
                                  bootSize: e.target.value,
                                })
                              }
                              className="w-full px-4 py-3 bg-white border-2 border-army-light/20 rounded-xl focus:border-army-primary transition-all outline-none font-bold text-base"
                            >
                              <option value="">
                                -- เลือกขนาด (แจ้งขนาดรองเท้าผ้าใบ/รองเท้ากีฬา)
                                --
                              </option>
                              {(parseSizes(
                                getProductForRecommendedItem(
                                  "รองเท้าประกอบชุดฝึก",
                                )?.sizes,
                              ).length > 1
                                ? parseSizes(
                                    getProductForRecommendedItem(
                                      "รองเท้าประกอบชุดฝึก",
                                    )?.sizes,
                                  )
                                : [
                                    "35",
                                    "36",
                                    "37",
                                    "38",
                                    "39",
                                    "40",
                                    "41",
                                    "42",
                                    "43",
                                    "44",
                                    "45",
                                    "46",
                                    "47",
                                  ]
                              ).map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Beret */}
                        {selectedRecommendedItems.some((item) =>
                          item.includes("หมวกแบเร่ต์"),
                        ) && (
                          <div className="space-y-3">
                            <label className="text-base font-black text-army-muted uppercase tracking-widest">
                              หมวกแบเร่ต์ รด. สีเขียวขี้ม้า *
                            </label>
                            <select
                              value={guideSelections.beretSize || ""}
                              onChange={(e) =>
                                setGuideSelections({
                                  ...guideSelections,
                                  beretSize: e.target.value,
                                })
                              }
                              className="w-full px-4 py-3 bg-white border-2 border-army-light/20 rounded-xl focus:border-army-primary transition-all outline-none font-bold text-base"
                            >
                              <option value="">-- เลือกขนาด --</option>
                              {(parseSizes(
                                getProductForRecommendedItem(
                                  "หมวกแบเร่ต์ รด. สีเขียวขี้ม้า",
                                )?.sizes,
                              ).length > 1
                                ? parseSizes(
                                    getProductForRecommendedItem(
                                      "หมวกแบเร่ต์ รด. สีเขียวขี้ม้า",
                                    )?.sizes,
                                  )
                                : ["5", "6", "7", "8"]
                              ).map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* T-shirt */}
                        {selectedRecommendedItems.some((item) =>
                          item.includes("เสื้อยืดรองในสีกากี"),
                        ) && (
                          <div className="space-y-3">
                            <label className="text-base font-black text-army-muted uppercase tracking-widest">
                              {selectedRecommendedItems.find((item) =>
                                item.includes("เสื้อยืดรองในสีกากี"),
                              )}{" "}
                              *
                            </label>
                            <select
                              value={guideSelections.tshirtSize || ""}
                              onChange={(e) =>
                                setGuideSelections({
                                  ...guideSelections,
                                  tshirtSize: e.target.value,
                                })
                              }
                              className="w-full px-4 py-3 bg-white border-2 border-army-light/20 rounded-xl focus:border-army-primary transition-all outline-none font-bold text-base"
                            >
                              <option value="">-- เลือกขนาด --</option>
                              {(parseSizes(
                                getProductForRecommendedItem(
                                  "เสื้อยืดรองในสีกากี",
                                )?.sizes,
                              ).length > 1
                                ? parseSizes(
                                    getProductForRecommendedItem(
                                      "เสื้อยืดรองในสีกากี",
                                    )?.sizes,
                                  )
                                : ["M", "L", "XL", "2XL", "3XL", "4XL"]
                              ).map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-8 border-t-2 border-army-bg bg-white flex justify-end gap-4">
                {guideStep === 1 ? (
                  <button
                    onClick={handleGuideNext}
                    className="tactical-button px-8 py-4 rounded-2xl text-base flex items-center space-x-2"
                  >
                    <span>ดำเนินการต่อ</span>
                    <ChevronRight size={18} />
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setGuideStep(1)}
                      className="px-8 py-4 rounded-2xl text-base font-black text-army-muted uppercase tracking-widest hover:bg-army-bg transition-all border-2 border-transparent"
                    >
                      ย้อนกลับ
                    </button>
                    <button
                      onClick={handleGuideSubmit}
                      className="tactical-button px-8 py-4 rounded-2xl text-base flex items-center space-x-2"
                    >
                      <span>เพิ่มลงตะกร้า</span>
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
