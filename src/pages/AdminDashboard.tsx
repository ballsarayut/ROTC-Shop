import React, { useState, useEffect, useMemo, useRef } from "react";
import imageCompression from "browser-image-compression";

import { db, isFirestoreQuotaExceeded, handleFirestoreError, OperationType } from "../firebase";
import { doc, setDoc, collection, getDocsFromServer } from "firebase/firestore";
import {
  Order,
  OrderStatus,
  PaymentSettings,
  Product,
  OrderItem,
} from "../types";
import { verifySlipImage } from "../services/geminiService";
import { googleSheetService } from "../services/googleSheetService";
import { formatPrice, cn, parseSizes, getOrderAmount, formatItemSize } from "../lib/utils";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  CheckCircle2,
  XCircle,
  X,
  Check,
  Clock,
  Search,
  Filter,
  Eye,
  Download,
  TrendingUp,
  Users,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  MoreVertical,
  ExternalLink,
  Sparkles,
  CreditCard,
  Loader2,
  Truck,
  Settings as SettingsIcon,
  Save,
  LogOut,
  Menu,
  ArrowLeft,
  Building2,
  School,
  Printer,
  RefreshCw,
  SortAsc,
  UserCircle,
  Phone,
  Hash,
  MapPin,
  Upload,
  AlertCircle,
  Trash2,
  Scissors,
  FileText,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
} from "recharts";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import * as XLSX from "xlsx";
import { toPng } from "html-to-image";
import {
  TRAINING_CENTERS,
  SCHOOLS_BY_CENTER,
  SCHOOL_DETAILS,
} from "../constants";

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; color: string; icon: any; description: string }
> = {
  pending: {
    label: "รับคำสั่งซื้อ",
    color: "bg-amber-100 text-amber-700 border-amber-200",
    icon: Clock,
    description:
      "เราได้รับคำสั่งซื้อของคุณแล้ว กรุณาแนบหลักฐานการโอนเงินเพื่อให้เจ้าหน้าที่ตรวจสอบ",
  },
  verifying: {
    label: "ดำเนินการคำสั่งซื้อ",
    color: "bg-army-dark text-white border-army-dark",
    icon: Search,
    description: "เจ้าหน้าที่กำลังดำเนินการตรวจสอบและเตรียมคำสั่งซื้อของคุณ",
  },
  preparing: {
    label: "กำลังจัดส่ง",
    color: "bg-army-bg text-army-dark border-army-light",
    icon: Package,
    description:
      "เรากำลังจัดเตรียมอุปกรณ์ของคุณให้พร้อมสำหรับการจัดส่งไปยังโรงเรียน",
  },
  completed: {
    label: "จัดส่งสำเร็จ",
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
    description: "ได้รับสินค้าเรียบร้อยแล้ว ขอบคุณที่ใช้บริการ",
  },
  cancelled: {
    label: "ยกเลิก",
    color: "bg-red-100 text-red-700 border-red-200",
    icon: XCircle,
    description: "รายการสั่งซื้อนี้ถูกยกเลิกแล้ว",
  },
};

type AdminTab =
  | "summary"
  | "orders"
  | "tracking"
  | "settings"
  | "admins"
  | "schools"
  | "print_orders"
  | "embroidery";

// Sort helper
export const sortOrderItemsBySize = (items: any[]) => {
  if (!items || !Array.isArray(items)) return [];
  return [...items].sort((a, b) => {
    if (a.name !== b.name) return a.name.localeCompare(b.name, "th");
    const sizeA = a.size || "";
    const sizeB = b.size || "";
    
    // Check purely numeric sizes first (like "26", "28", "40", "45")
    const isNumA = /^\d+$/.test(sizeA.trim());
    const isNumB = /^\d+$/.test(sizeB.trim());
    
    if (isNumA && isNumB) {
      return parseInt(sizeA) - parseInt(sizeB);
    }
    
    // Check known text scales
    const sizes = ["SS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL", "6XL", "7XL", "8XL", "9XL"];
    const iA = sizes.indexOf(sizeA.trim().toUpperCase());
    const iB = sizes.indexOf(sizeB.trim().toUpperCase());
    
    if (iA !== -1 && iB !== -1) return iA - iB;
    if (iA !== -1) return -1; // S, M, L comes before others if mixed
    if (iB !== -1) return 1;

    // Fallback: compare normally
    return sizeA.localeCompare(sizeB, "th");
  });
};

export default function AdminDashboard() {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error" | "info">("success");

  const triggerToast = (msg: string, type: "success" | "error" | "info" = "success") => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => {
      setToastMessage((curr) => curr === msg ? null : curr);
    }, 4500);
  };

  const alert = (msg: string) => {
    console.log("[Custom Alert Intercept]:", msg);
    const isError = 
      msg.includes("ผิดพลาด") || 
      msg.includes("ล้มเหลว") || 
      msg.includes("ไม่สำเร็จ") || 
      msg.includes("ไม่สามารถ") || 
      msg.includes("ขัดข้อง") || 
      msg.includes("ลบ") || 
      msg.includes("เตือน");
    triggerToast(msg, isError ? "error" : "success");
    try {
      window.alert(msg);
    } catch (e) {
      console.warn("Native alert intercepted safely inside sandbox:", e);
    }
  };

  const [paymentSettings, setPaymentSettings] = useState(() => {
    try {
      const cached = localStorage.getItem("admin_payment_cache");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === "object") {
          return parsed;
        }
      }
    } catch (e) {}
    return {
      bankName: "",
      accountNumber: "",
      accountName: "",
      qrCodeUrl: "",
      shippingFee: 0,
    };
  });
  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const cached = localStorage.getItem("admin_orders_cache");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {}
    return [];
  });
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  useEffect(() => {
    const handleQuota = () => setQuotaExceeded(true);
    window.addEventListener("firestore-quota-exceeded", handleQuota);
    return () =>
      window.removeEventListener("firestore-quota-exceeded", handleQuota);
  }, []);

  const [verifyingSlips, setVerifyingSlips] = useState<Record<string, boolean>>(
    {},
  );
  const [autoCheckedSlips, setAutoCheckedSlips] = useState<
    Record<string, boolean>
  >({});
  const [recoveredSlips, setRecoveredSlips] = useState<Record<string, string>>(
    {},
  );

  useEffect(() => {
    fetch("/recovered_slips.json")
      .then((r) => r.json())
      .then((data) => setRecoveredSlips(data))
      .catch((err) => console.log("No recovered slips found or error:", err));
  }, []);

  const [editingOrderItems, setEditingOrderItems] = useState<{
    items: OrderItem[];
  } | null>(null);

  const safeUpdateOrder = async (orderId: string, updateData: any) => {
    try {
      const fullOrder = orders.find((o) => o.id === orderId);
      if (fullOrder) {
        const mergedData = {
          ...fullOrder,
          ...updateData,
          updatedAt: new Date().toISOString(),
        };

        if (
          mergedData._rawItems &&
          (!mergedData.items || mergedData.items.length === 0)
        ) {
          mergedData.items = mergedData._rawItems;
        }
        delete mergedData._rawItems;

        // stringify objects
        if (mergedData.items && typeof mergedData.items !== "string") {
          mergedData.items = JSON.stringify(mergedData.items);
        }
        if (
          mergedData.aiVerification &&
          typeof mergedData.aiVerification !== "string"
        ) {
          mergedData.aiVerification = JSON.stringify(mergedData.aiVerification);
        }
        await googleSheetService.syncRecord("Orders", mergedData);
        setOrders((prevOrders) =>
          prevOrders.map((order) =>
            order.id === orderId
              ? { ...order, ...updateData, updatedAt: mergedData.updatedAt }
              : order,
          ),
        );
      }
    } catch (error) {
      console.error(error);
    }
  };

  const [uploadingSlipId, setUploadingSlipId] = useState<string | null>(null);

  const handleAdminUploadSlip = async (orderId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;

      setUploadingSlipId(orderId);
      triggerToast('กำลังอัปโหลดสลิป...', 'info');

      // Compression settings (similar to Checkout.tsx)
      const options = {
        maxSizeMB: 0.2, // Max 200KB limit
        maxWidthOrHeight: 800,
        useWebWorker: false, // false for compatibility
        initialQuality: 0.7
      };
      
      let base64data = '';
      try {
        const compressedFile = await imageCompression(file, options);
        base64data = await imageCompression.getDataUrlFromFile(compressedFile);
      } catch (err: any) {
        console.warn("Primary compression failed, trying Canvas fallback...", err);
        base64data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              let { width, height } = img;
              const maxDimension = 800;
              if (width > height && width > maxDimension) {
                height *= maxDimension / width;
                width = maxDimension;
              } else if (height > maxDimension) {
                width *= maxDimension / height;
                height = maxDimension;
              }
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.7));
              } else {
                reject(new Error('Canvas ctx null'));
              }
            };
            img.onerror = () => reject(new Error('Image load failed'));
            if (typeof event.target?.result === 'string') {
              img.src = event.target.result;
            } else {
              reject(new Error('Invalid reader result'));
            }
          };
          reader.onerror = () => reject(new Error('File read failed'));
          reader.readAsDataURL(file);
        });
      }

      // Update in Firestore
      const orderRef = doc(db, 'orders', orderId);
      await setDoc(orderRef, { slipUrl: base64data }, { merge: true });

      // Update local state by mutating the orders array so the UI reflects the change immediately
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, slipUrl: base64data } : o));

      // Also update selectedOrder if it is currently open
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(prev => prev ? { ...prev, slipUrl: base64data } : null);
      }

      triggerToast('อัปโหลดสลิปเรียบร้อยแล้ว', 'success');
    } catch (error) {
      console.error('Error uploading slip:', error);
      triggerToast('เกิดข้อผิดพลาดในการอัปโหลดสลิป โปรดลองอีกครั้ง', 'error');
    } finally {
      if (event.target) {
         event.target.value = ''; // Reset input to allow picking the same file again
      }
      setUploadingSlipId(null);
    }
  };

  const handleVerifySlip = async (order: Order, isAuto = false) => {
    const slipData =
      order.slipUrl || order.paymentRef || recoveredSlips[order.id];
    if (!slipData) return;

    let base64Image = "";
    let mimeType = "image/jpeg";

    if (slipData.startsWith("data:")) {
      const parts = slipData.split(",");
      const match = parts[0].match(/data:(.*?);/);
      if (match) {
        mimeType = match[1];
      }
      base64Image = parts[1];
    } else if (slipData.startsWith("http")) {
      try {
        const response = await fetch(slipData);
        if (!response.ok) throw new Error("Failed to fetch image");
        const blob = await response.blob();
        mimeType = blob.type || "image/jpeg";
        const reader = new FileReader();
        base64Image = await new Promise((resolve) => {
          reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1]);
          };
          reader.readAsDataURL(blob);
        });
      } catch (err) {
        console.error("Cannot fetch slip image", err);
        if (!isAuto)
          alert("ไม่สามารถดึงภาพสลิปเพื่อตรวจสอบได้ ระบบอาจจะบล็อค CORS");
        return;
      }
    } else {
      return;
    }

    setVerifyingSlips((prev) => ({ ...prev, [order.id]: true }));
    try {
      const result = await verifySlipImage(
        base64Image,
        mimeType,
        getOrderAmount(order),
        paymentSettings.accountName,
      );
      if (result) {
        await safeUpdateOrder(order.id, {
          aiVerification: {
            ...result,
            checkedAt: new Date().toISOString(),
          },
        });
      } else {
        await safeUpdateOrder(order.id, {
          aiVerification: {
            isValidSlip: false,
            extractedAmount: null,
            amountMatches: false,
            message: "การตรวจสอบด้วย AI ล้มเหลว รูปภาพอาจไม่ชัดเจน",
            checkedAt: new Date().toISOString(),
          },
        });
        if (!isAuto) alert("การตรวจสอบด้วย AI ล้มเหลว กรุณาลองใหม่");
      }
    } catch (err) {
      console.error(err);
      await safeUpdateOrder(order.id, {
        aiVerification: {
          isValidSlip: false,
          extractedAmount: null,
          amountMatches: false,
          message: "เกิดข้อผิดพลาดในการเชื่อมต่อกับ AI",
          checkedAt: new Date().toISOString(),
        },
      });
      if (!isAuto) alert("เกิดข้อผิดพลาดในการตรวจสอบ");
    } finally {
      setVerifyingSlips((prev) => ({ ...prev, [order.id]: false }));
      if (isAuto) {
        setAutoCheckedSlips((prev) => ({ ...prev, [order.id]: true }));
      }
    }
  };

  const [loading, setLoading] = useState(() => {
    try {
      const cached = localStorage.getItem("admin_orders_cache");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return false;
        }
      }
    } catch (e) {}
    return true;
  });
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<OrderStatus | "all">("all");
  const [filterCenter, setFilterCenter] = useState("all");
  const [filterSchool, setFilterSchool] = useState("all");
  const [filterProduct, setFilterProduct] = useState("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | "">("");
  const [filterGender, setFilterGender] = useState("all");
  const [filterSize, setFilterSize] = useState("all");

  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const cached = localStorage.getItem("admin_products_cache");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {}
    return [];
  });
  const [filterDate, setFilterDate] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewingTrackingOrder, setViewingTrackingOrder] =
    useState<Order | null>(null);
  const captureRef = React.useRef<HTMLDivElement>(null);
  const [trackingSearchType, setTrackingSearchType] = useState<
    "phone" | "orderId"
  >("phone");
  const [trackingSearchValue, setTrackingSearchValue] = useState("");
  const [trackingSearchError, setTrackingSearchError] = useState("");
  const [trackingSearchLoading, setTrackingSearchLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
  } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [qrUploadProgress, setQrUploadProgress] = useState(0);

  const syncAllToSheets = async () => {
    setSyncing(true);
    try {
      // Sync Orders
      for (const order of orders) {
        const payloadToSync: any = { ...order };
        if (
          payloadToSync._rawItems &&
          (!payloadToSync.items || payloadToSync.items.length === 0)
        ) {
          payloadToSync.items = payloadToSync._rawItems;
        }
        delete payloadToSync._rawItems;
        await googleSheetService.syncRecord("Orders", payloadToSync);
      }
      // Sync Products
      for (const product of products) {
        await googleSheetService.syncRecord("Products", product);
      }
      // Sync Settings
      await googleSheetService.syncRecord("Settings", {
        id: "payment",
        ...paymentSettings,
      });

      // Sync Schools
      for (const school of schools) {
        await googleSheetService.syncRecord("Schools", school);
      }

      alert("ซิงค์ข้อมูลลง Google Sheets สำเร็จ");
    } catch (error) {
      console.error("Sync error:", error);
      alert("เกิดข้อผิดพลาดในการซิงค์ข้อมูล");
    } finally {
      setSyncing(false);
    }
  };
  const handleSaveTrackingImage = async () => {
    if (captureRef.current === null) return;
    try {
      const width = 1240;
      const height = 1754;
      const dataUrl = await toPng(captureRef.current, {
        cacheBust: true,
        backgroundColor: "#f8f9fa",
        width: width,
        height: height,
        style: {
          borderRadius: "0",
          width: `${width}px`,
          height: `${height}px`,
          padding: "60px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start",
          margin: "0",
        },
      });
      const link = document.createElement("a");
      link.download = `order-tracking-${viewingTrackingOrder?.id.slice(0, 8) || "details"}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Error saving image:", err);
      alert("ไม่สามารถบันทึกรูปภาพได้");
    }
  };

  const handleTrackingSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingSearchValue) return;
    setTrackingSearchLoading(true);
    setTrackingSearchError("");
    try {
      let foundOrder;

      if (trackingSearchType === "orderId") {
        foundOrder = orders.find((o) => o.id === trackingSearchValue);
      } else {
        foundOrder = orders.find((o) => o.phone === trackingSearchValue);
      }

      if (foundOrder) {
        setViewingTrackingOrder(foundOrder);
      } else {
        setTrackingSearchError("ไม่พบหมายเลขรายการสั่งซื้อนี้");
      }
    } catch (error) {
      console.error(error);
      setTrackingSearchError("เกิดข้อผิดพลาดในการดึงข้อมูล");
    } finally {
      setTrackingSearchLoading(false);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    setConfirmModal({
      title: "ยืนยันการลบคำสั่งซื้อ",
      message: `คุณแน่ใจหรือไม่ว่าต้องการลบคำสั่งซื้อ #${orderId.slice(0, 8).toUpperCase()}? การดำเนินการนี้ไม่สามารถย้อนกลับได้`,
      onConfirm: async () => {
        setLoading(true);
        try {
          await googleSheetService.deleteRecord("Orders", orderId);
          setOrders((prev) => prev.filter((o) => o.id !== orderId));
          alert("ลบคำสั่งซื้อสำเร็จ");
        } catch (error) {
          console.error("Delete error:", error);
          alert("เกิดข้อผิดพลาดในการลบคำสั่งซื้อ");
        } finally {
          setLoading(false);
          setConfirmModal(null);
        }
      },
    });
  };

  const handleBulkDelete = async () => {
    if (selectedOrderIds.length === 0) return;

    setConfirmModal({
      title: "ยืนยันการลบหลายรายการ",
      message: `คุณแน่ใจหรือไม่ว่าต้องการลบคำสั่งซื้อที่เลือกทั้ง ${selectedOrderIds.length} รายการ? การดำเนินการนี้ไม่สามารถย้อนกลับได้`,
      onConfirm: async () => {
        setLoading(true);
        try {
          for (const id of selectedOrderIds) {
            await googleSheetService.deleteRecord("Orders", id);
          }
          setOrders((prev) =>
            prev.filter((o) => !selectedOrderIds.includes(o.id)),
          );
          setSelectedOrderIds([]);
          alert(`ลบคำสั่งซื้อ ${selectedOrderIds.length} รายการสำเร็จ`);
        } catch (error) {
          console.error("Bulk delete error:", error);
          alert("เกิดข้อผิดพลาดในการลบคำสั่งซื้อบางรายการ");
        } finally {
          setLoading(false);
          setConfirmModal(null);
        }
      },
    });
  };

  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get("tab") as AdminTab) || "summary";
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStatus, filterCenter, filterSchool, filterGender, filterProduct, filterSize, filterDate, sortOrder, activeTab]);

  useEffect(() => {
    const tab = searchParams.get("tab") as AdminTab;
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (tab: AdminTab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
    setIsSidebarOpen(false);
  };
  const [savingSettings, setSavingSettings] = useState(false);
  const [trackingInput, setTrackingInput] = useState({
    provider: "",
    number: "",
  });
  const [remarksInput, setRemarksInput] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [revenueFilter, setRevenueFilter] = useState<
    "daily" | "monthly" | "yearly"
  >("daily");
  const [viewingSlipUrl, setViewingSlipUrl] = useState<string | null>(null);
  const [trainingCenters, setTrainingCenters] = useState<any[]>(() => {
    try {
      const cached = localStorage.getItem("admin_centers_cache");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {}
    return [];
  });
  const [schools, setSchools] = useState<any[]>(() => {
    try {
      const cached = localStorage.getItem("admin_schools_cache");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {}
    return [];
  });
  const navigate = useNavigate();

  // Auto-sync school addresses on load if missing

  useEffect(() => {
    const checkAuth = async () => {
      const adminEmail = localStorage.getItem("adminEmail");
      if (!adminEmail) {
        navigate("/login");
        return;
      }

      const email = adminEmail.toLowerCase();
      if (email === "masterball.dbs@gmail.com" || email?.startsWith("admin_")) {
        return;
      }

      // Check admin role from Sheets
      try {
        const sheetAdmins = await googleSheetService.fetchRecords("Admins");
        const foundAdmin = sheetAdmins.find(
          (a: any) => 
            (a.email && a.email.toLowerCase() === email) || 
            (a.id && a.id.toLowerCase() === email)
        );
        if (!foundAdmin) {
          console.log("Unauthorized email refresh:", email);
          localStorage.removeItem("adminEmail");
          navigate("/login");
        }
      } catch (error) {
        console.error("Check admin error from Sheets:", error);
      }
    };
    checkAuth();

    let isMounted = true;
    const fetchOrders = async (showLoading = true) => {
      // @ts-ignore
      if (window._isSyncPaused) return; // Skip polling while bulk updating to prevent optimistic ui reversion
      if (showLoading) setLoading(true);
      try {
        // Skip loading stale cached orders to prevent visual jumps (e.g., from 154 to 159)
        // We always show pristine and 100% accurate up-to-date data synced dynamically in one go.

        // 1. Fetch Google Sheet orders FIRST so they load instantly without being blocked by a slow or offline database
        const sheetRecords = await googleSheetService.fetchRecords("Orders");
        // @ts-ignore
        if (window._isSyncPaused) return; // if sync started while we were fetching

        let firestoreStates: Record<string, { isEmbroidered?: boolean; isOrdered?: boolean; school?: string; trainingCenter?: string }> = {};
        let didFetchFS = false;

        // 2. Fetch Firestore on-demand with a 1.2s Promise.race timeout so that even if the database is over quota,
        // it doesn't hang the UI load.
        try {
          if (!isFirestoreQuotaExceeded()) {
            const fbSnapshot = await Promise.race([
              getDocsFromServer(collection(db, "orders")),
              new Promise<null>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 1200))
            ]).catch((err) => {
              console.warn("Firestore collection fetch failed or timed out (1.2s):", err);
              if (err instanceof Error && err.message !== "Timeout") {
                try {
                  handleFirestoreError(err, OperationType.LIST, "orders");
                } catch (e) {}
              }
              return null;
            });

            if (fbSnapshot) {
              fbSnapshot.forEach((docSnap) => {
                const d = docSnap.data();
                if (d) {
                  firestoreStates[docSnap.id] = {
                    isEmbroidered: d.isEmbroidered === true || d.isEmbroidered === "TRUE" || d.isEmbroidered === "true",
                    isOrdered: d.isOrdered === true || d.isOrdered === "TRUE" || d.isOrdered === "true",
                    school: d.school,
                    trainingCenter: d.trainingCenter,
                  };
                }
              });
              didFetchFS = true;
            }
          }
        } catch (dbErr) {
          console.warn("Firestore fetch error:", dbErr);
        }
        
        if (sheetRecords && Array.isArray(sheetRecords)) {
          const mappedRecords = sheetRecords.map((record: any) => {
            let items = record.items;
            let rawItemsStr = undefined;
            if (typeof items === "string") {
              try {
                items = JSON.parse(items);
              } catch (e) {
                rawItemsStr = items;
                items = [];
              }
            }
            if (!Array.isArray(items)) {
              if (typeof record.items === "string") rawItemsStr = record.items;
              items = [];
            }
            let aiVerification = record.aiVerification;
            if (typeof aiVerification === "string") {
              try {
                aiVerification = JSON.parse(aiVerification);
              } catch (e) {
                aiVerification = null;
              }
            }
            const getBoolVal = (rec: any, key: string) => {
              for (const k of Object.keys(rec)) {
                if (k && k.toLowerCase().trim() === key.toLowerCase().trim()) {
                  const val = rec[k];
                  return val === true || val === "TRUE" || val === "true";
                }
              }
              return false;
            };

            const getStrValMatch = (rec: any, keys: string[]) => {
              for (const key of keys) {
                for (const k of Object.keys(rec)) {
                   if (k && k.toLowerCase().trim() === key.toLowerCase().trim()) return rec[k];
                }
              }
              for (const k of Object.keys(rec)) {
                   for (const key of keys) {
                     if (k && k.includes(key)) return rec[k];
                   }
              }
              return undefined;
            };
            
            // 1. Core values from Sheets (Google Sheets is the absolute source of truth)
            let isEmbroideredVal = getBoolVal(record, "isEmbroidered");
            let isOrderedVal = getBoolVal(record, "isOrdered");
            let sheetSchool = getStrValMatch(record, ["school", "โรงเรียน"]);
            let sheetCenter = getStrValMatch(record, ["trainingCenter", "trainingcenter", "ศูนย์ฝึก", "ศูนย์"]);
            
            // 2. Reconcile Firestore with Google Sheets state ONLY if Firestore states were successfully loaded.
            const fbState = firestoreStates[record.id];
            if (fbState) {
              const updates: any = {};
              if (fbState.isEmbroidered !== isEmbroideredVal) updates.isEmbroidered = isEmbroideredVal;
              if (fbState.isOrdered !== isOrderedVal) updates.isOrdered = isOrderedVal;
              if (sheetSchool !== undefined && fbState.school !== sheetSchool) updates.school = sheetSchool;
              if (sheetCenter !== undefined && fbState.trainingCenter !== sheetCenter) updates.trainingCenter = sheetCenter;
              
              if (Object.keys(updates).length > 0) {
                setDoc(doc(db, "orders", record.id), updates, { merge: true }).catch((e) => {
                  console.warn("Error reconciling to Firestore:", e);
                });
              }
            } else if (didFetchFS && !isFirestoreQuotaExceeded()) {
              const updates: any = { isEmbroidered: isEmbroideredVal, isOrdered: isOrderedVal };
              if (sheetSchool !== undefined) updates.school = sheetSchool;
              if (sheetCenter !== undefined) updates.trainingCenter = sheetCenter;
              setDoc(doc(db, "orders", record.id), updates, { merge: true }).catch((e) => {
                console.warn("Error syncing initial data to Firestore:", e);
              });
            }

            // 3. Optimistic local update check
            // @ts-ignore
            const recentUpdate = window._recentEmbroideredUpdates?.[record.id];
            if (recentUpdate && (Date.now() - recentUpdate.timestamp < 20000)) {
              isEmbroideredVal = recentUpdate.value;
            }
            let foundRemarks = undefined;
            if (record.X !== undefined && record.X !== "") {
                foundRemarks = record.X;
            } else if (record.x !== undefined && record.x !== "") {
                foundRemarks = record.x;
            } else {
                const noteKey = Object.keys(record).find(k => k === 'หมายเหตุ' || k.trim() === 'หมายเหตุ' || k.includes('หมายเหตุ'));
                if (noteKey && record[noteKey]) {
                    foundRemarks = record[noteKey];
                } else if (record.remarks) {
                    foundRemarks = record.remarks;
                }
            }
            
            
            return {
              ...record,
              remarks: foundRemarks,
              isOrdered: isOrderedVal,
              isEmbroidered: isEmbroideredVal,
              school: sheetSchool !== undefined ? sheetSchool : record.school,
              trainingCenter: sheetCenter !== undefined ? sheetCenter : record.trainingCenter,
              items,
              _rawItems: rawItemsStr,
              aiVerification,
              totalAmount: Number(record.totalAmount) || 0,
              createdAt: record.createdAt || new Date().toISOString(),
            };
          });

          const validRecords = mappedRecords.filter((record: any) => record.id && record.status);

          validRecords.sort((a: any, b: any) => {
            const aTime = new Date(a.createdAt).getTime() || 0;
            const bTime = new Date(b.createdAt).getTime() || 0;
            return bTime - aTime;
          });

          const newOrdersStr = JSON.stringify(validRecords);
          setOrders((prevOrders) => {
            if (JSON.stringify(prevOrders) !== newOrdersStr) {
               try {
                 localStorage.setItem(
                    "admin_orders_cache",
                    newOrdersStr
                 );
               } catch (e) {
                 console.warn("Could not save to localStorage: Quota exceeded", e);
               }
               return validRecords as Order[];
            }
            return prevOrders;
          });
        }

        if (showLoading) setLoading(false);
      } catch (error) {
        if (!isMounted) return;
        const msg = error instanceof Error ? error.message : String(error);
        console.error("Orders fetch error from Sheets:", msg);
        if (msg.includes("VITE_GOOGLE_SHEET_URL")) {
          triggerToast("การเชื่อมต่อ Apps Script ผิดพลาด กรุณาตั้งค่า VITE_GOOGLE_SHEET_URL ใน Vercel ให้ถูกต้อง และกด Deploy อีกครั้ง", "error");
        } else if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
           triggerToast(`โหลดข้อมูลไม่สำเร็จ: CORS หรือ URL ผิด (${msg})`, "error");
        } else {
           triggerToast(`โหลดข้อมูลไม่สำเร็จ: ${msg}`, "error");
        }
        if (showLoading) setLoading(false);
      }
    };

    const hasCache = (() => {
      try {
        const cached = localStorage.getItem("admin_orders_cache");
        if (cached) {
          const parsed = JSON.parse(cached);
          return Array.isArray(parsed) && parsed.length > 0;
        }
      } catch (e) {}
      return false;
    })();

    fetchOrders(!hasCache);
    const intervalId = setInterval(() => fetchOrders(false), 45000); // 45s polling to safeguard free-tier Firestore quota from depletion

    // remove onSnapshot
    const unsubscribeOrders = () => {
      isMounted = false;
      clearInterval(intervalId);
    };

    const fetchDashboardData = async () => {
      try {
        const [sheetProducts, sheetCenters, sheetSchools] = await Promise.all([
          googleSheetService.fetchRecords("Products"),
          googleSheetService.fetchRecords("TrainingCenters"),
          googleSheetService.fetchRecords("Schools"),
        ]);

        if (Array.isArray(sheetProducts)) {
          const parsedProducts = sheetProducts.map((p: any) => ({
            id: String(p.id || ""),
            name: String(p.name || ""),
            price: Number(p.price) || 0,
            originalPrice: Number(p.originalPrice) || 0,
            image: String(p.image || p.imageUrl || ""),
            imageUrl: String(p.imageUrl || p.image || ""),
            description: String(p.description || ""),
            category: String(p.category || ""),
            stock: Number(p.stock) ?? 100,
            sizes: parseSizes(p.sizes),
            available: p.available === "true" || p.available === true,
            createdAt: p.createdAt || new Date().toISOString(),
          }));
          setProducts(parsedProducts as Product[]);
          try {
            localStorage.setItem(
              "admin_products_cache",
              JSON.stringify(parsedProducts),
            );
          } catch (e) {
            console.warn("Could not save to localStorage: Quota exceeded", e);
          }
        }

        if (Array.isArray(sheetCenters)) {
          const mappedCenters = sheetCenters.map((c: any) => ({
            id: String(c.id || ""),
            name: String(c.name || ""),
            location: String(c.location || ""),
          }));
          setTrainingCenters(mappedCenters);
          try {
            localStorage.setItem(
              "admin_centers_cache",
              JSON.stringify(mappedCenters),
            );
          } catch (e) {}
        }

        if (Array.isArray(sheetSchools)) {
          const mappedSchools = sheetSchools.map((s: any) => ({
            id: String(s.id || ""),
            name: String(s.name || ""),
            trainingCenterId: String(s.trainingCenterId || s.centerId || ""),
            trainingCenterName: String(s.trainingCenterName || s.centerName || ""),
            shippingAddress: String(s.shippingAddress || s.address || ""),
            contactPerson: String(s.contactPerson || s.contact || ""),
            contactPhone: String(s.contactPhone || s.phone || ""),
          }));
          setSchools(mappedSchools);
          try {
            localStorage.setItem(
              "admin_schools_cache",
              JSON.stringify(mappedSchools),
            );
          } catch (e) {}
        }
      } catch (error) {
        console.warn("Google Sheets static data fallback also failed:", error);
      }
    };
    fetchDashboardData();

    const fetchSettings = async () => {
      try {
        const sheetSettings = await googleSheetService.fetchRecords("Settings");
        const paymentSet = sheetSettings.find((s: any) => s.id === "payment");
        if (paymentSet) {
          const payload = {
            bankName: paymentSet.bankName || "ธนาคารกรุงเทพ",
            accountNumber: paymentSet.accountNumber || "123-4-56789-0",
            accountName: paymentSet.accountName || "นาย ทหาร ทดสอบ",
            shippingFee: Number(paymentSet.shippingFee) || 0,
            qrCodeUrl: paymentSet.qrCodeUrl || "",
          };
          setPaymentSettings(payload);
          try {
            localStorage.setItem(
              "admin_payment_cache",
              JSON.stringify(payload),
            );
          } catch (e) {}
        }
      } catch (error) {
        console.warn("Google Sheets payment settings fallback failed:", error);
      }
    };
    fetchSettings();

    return () => {
      unsubscribeOrders();
    };
  }, [navigate, refreshTrigger]);

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await googleSheetService.syncRecord("Settings", {
        id: "payment",
        ...paymentSettings,
        updatedAt: new Date(),
      });
      alert("บันทึกการตั้งค่าสำเร็จ");
    } catch (error) {
      console.error(error);
    } finally {
      setSavingSettings(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      const updateData = {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      };

      const updatedOrder = orders.find((o) => o.id === orderId);
      if (updatedOrder) {
        const payloadToSync: any = { 
          ...updatedOrder,
          status: newStatus,
          updatedAt: updateData.updatedAt
        };
        // Clean up nested arrays and objects that would break
        if (
          payloadToSync._rawItems &&
          (!payloadToSync.items || payloadToSync.items.length === 0)
        ) {
          payloadToSync.items = payloadToSync._rawItems;
        }
        delete payloadToSync._rawItems;

        // Sync to Google Sheet and wait 
        await googleSheetService.syncRecord("Orders", payloadToSync);

        // Sync to Firestore if quota is okay
        if (!isFirestoreQuotaExceeded()) {
          try {
            await setDoc(doc(db, "orders", orderId), { 
              status: newStatus,
              updatedAt: updateData.updatedAt 
            }, { merge: true });
          } catch (e) {
            console.warn("Firestore save status fail:", e);
          }
        }
      }

      // Optimistic state updates
      setSelectedOrder((prev) =>
        prev ? { ...prev, status: newStatus } : null,
      );

      setOrders((prevOrders) => {
        const nextOrders = prevOrders.map((order) =>
          order.id === orderId
            ? { ...order, status: newStatus, updatedAt: updateData.updatedAt }
            : order,
        );
        try {
          localStorage.setItem("admin_orders_cache", JSON.stringify(nextOrders));
        } catch (e) {
          console.warn("Could not save to localStorage inside updateOrderStatus:", e);
        }
        return nextOrders;
      });

    } catch (error) {
      console.error(error);
    }
  };

  const saveOrderRemarks = async (orderId: string) => {
    try {
      const updateData = {
        remarks: remarksInput,
        updatedAt: new Date().toISOString(),
      };

      const updatedOrder = orders.find((o) => o.id === orderId);
      
      // Optimistic state updates FIRST for instant UI feedback
      setSelectedOrder((prev) =>
        prev ? { ...prev, remarks: remarksInput } : null,
      );

      setOrders((prevOrders) => {
        const nextOrders = prevOrders.map((order) =>
          order.id === orderId ? { ...order, ...updateData } : order,
        );
        try {
          localStorage.setItem("admin_orders_cache", JSON.stringify(nextOrders));
        } catch (e) {
          console.warn("Could not save to localStorage inside saveOrderRemarks:", e);
        }
        return nextOrders;
      });

      alert("บันทึกหมายเหตุสำเร็จ");

      // Now sync in background
      if (updatedOrder) {
        // Use a full payload to prevent blanking out other columns in Sheet (Sheet replaces row)
        const payloadToSync: any = { 
          ...updatedOrder,
          id: orderId,
          remarks: remarksInput,
          updatedAt: updateData.updatedAt
        };
        
        if (
          payloadToSync._rawItems &&
          (!payloadToSync.items || payloadToSync.items.length === 0)
        ) {
          payloadToSync.items = payloadToSync._rawItems;
        }
        delete payloadToSync._rawItems;

        // Fire & Forget sync to Google Sheet
        googleSheetService.syncRecord("Orders", payloadToSync).catch(console.error);

        // Sync to Firestore if quota is okay
        if (!isFirestoreQuotaExceeded()) {
          setDoc(doc(db, "orders", orderId), { 
            remarks: remarksInput,
            updatedAt: updateData.updatedAt 
          }, { merge: true }).catch(e => console.warn("Firestore save remarks fail:", e));
        }
      }

    } catch (error) {
      console.error(error);
      alert("เกิดข้อผิดพลาดในการบันทึกหมายเหตุ");
    }
  };

  const saveTrackingInfo = async (orderId: string) => {
    try {
      const updateData = {
        trackingNumber: trackingInput.number,
        shippingProvider: trackingInput.provider,
        status: "preparing" as OrderStatus, // Auto update status when tracking is added
        updatedAt: new Date().toISOString(),
      };

      const updatedOrder = orders.find((o) => o.id === orderId);
      if (updatedOrder) {
        const payloadToSync: any = { 
          ...updatedOrder,
          trackingNumber: trackingInput.number,
          shippingProvider: trackingInput.provider,
          status: "preparing",
          updatedAt: updateData.updatedAt
        };
        // Clean up nested arrays and objects that would break
        if (
          payloadToSync._rawItems &&
          (!payloadToSync.items || payloadToSync.items.length === 0)
        ) {
          payloadToSync.items = payloadToSync._rawItems;
        }
        delete payloadToSync._rawItems;

        // Sync to Google Sheet and wait 
        await googleSheetService.syncRecord("Orders", payloadToSync);

        // Sync to Firestore if quota is okay
        if (!isFirestoreQuotaExceeded()) {
          try {
            await setDoc(doc(db, "orders", orderId), { 
              trackingNumber: trackingInput.number,
              shippingProvider: trackingInput.provider,
              status: "preparing",
              updatedAt: updateData.updatedAt 
            }, { merge: true });
          } catch (e) {
            console.warn("Firestore save tracking fail:", e);
          }
        }
      }

      // Optimistic state updates
      setSelectedOrder((prev) =>
        prev
          ? {
              ...prev,
              trackingNumber: trackingInput.number,
              shippingProvider: trackingInput.provider,
              status: "preparing",
            }
          : null,
      );

      setOrders((prevOrders) => {
        const nextOrders = prevOrders.map((order) =>
          order.id === orderId ? { ...order, ...updateData } : order,
        );
        try {
          localStorage.setItem("admin_orders_cache", JSON.stringify(nextOrders));
        } catch (e) {
          console.warn("Could not save to localStorage inside saveTrackingInfo:", e);
        }
        return nextOrders;
      });

      alert("บันทึกข้อมูลการจัดส่งสำเร็จ");
    } catch (error) {
      console.error(error);
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูลจัดส่ง");
    }
  };

  const saveOrderItems = async (orderId: string) => {
    if (!editingOrderItems) return;
    try {
      const newSubtotal = editingOrderItems.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );
      const originalOrder = orders.find((o) => o.id === orderId);
      const shippingFee = originalOrder?.shippingFee || 0;
      const newTotalAmount = newSubtotal + shippingFee;

      const updateData = {
        items: editingOrderItems.items,
        subtotal: newSubtotal,
        totalAmount: newTotalAmount,
        updatedAt: new Date().toISOString(),
      };

      if (originalOrder) {
        const payloadToSync: any = { 
          ...originalOrder,
          id: orderId,
          ...updateData
        };
        
        if (
          payloadToSync._rawItems &&
          (!payloadToSync.items || payloadToSync.items.length === 0)
        ) {
          payloadToSync.items = payloadToSync._rawItems;
        }
        delete payloadToSync._rawItems;

        await googleSheetService.syncRecord("Orders", payloadToSync);
      }

      setSelectedOrder((prev) =>
        prev
          ? {
              ...prev,
              items: editingOrderItems.items,
              subtotal: newSubtotal,
              totalAmount: newTotalAmount,
            }
          : null,
      );
      setEditingOrderItems(null);
      alert("บันทึกรายการอุปกรณ์และยอดรวมใหม่สำเร็จ");

      setOrders((prevOrders) =>
        prevOrders.map((order) =>
          order.id === orderId
            ? {
                ...order,
                items: editingOrderItems.items,
                subtotal: newSubtotal,
                totalAmount: newTotalAmount,
                updatedAt: updateData.updatedAt,
              }
            : order,
        ),
      );
    } catch (error) {
      console.error(error);
    }
  };

  const handlePrintLabel = (
    order: Order,
    action: "print" | "pdf" = "print",
  ) => {
    let printWindow: Window | null = null;
    let iframeId = `pdf-iframe-${Date.now()}`;

    printWindow = window.open("", "_blank");

    if (!printWindow) return;

    const schoolData = schools.find((s) => s.name === order.school);
    const shippingAddress =
      schoolData?.shippingAddress || "ไม่ได้ระบุที่อยู่จัดส่ง";
    const contactInfo = schoolData?.contactPerson
      ? `${schoolData.contactPerson} (${schoolData.contactPhone || "-"})`
      : "-";

    const html = `
      <html>
        <head>
          <title>Shipping Label - ${order.id}</title>
          
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap');
            body { font-family: 'Sarabun', sans-serif; padding: 20px; background: #f0f0f0; display: flex; justify-content: center; }
            .label-container { 
              background: white;
              border: 4px solid #1a2f23; 
              padding: 40px; 
              width: 120mm; 
              min-height: 160mm; 
              box-shadow: 0 10px 30px rgba(0,0,0,0.1);
              position: relative;
              border-radius: 20px;
            }
            .header { border-bottom: 4px solid #1a2f23; padding-bottom: 20px; margin-bottom: 30px; text-align: center; }
            .section { margin-bottom: 25px; }
            .label { font-weight: bold; font-size: 14px; color: #1a2f23; opacity: 0.6; text-transform: uppercase; letter-spacing: 1px; }
            .value { font-size: 22px; font-weight: 800; color: #1a2f23; line-height: 1.2; margin-top: 5px; }
            .sub-value { font-size: 16px; font-weight: 600; color: #4a5d52; margin-top: 5px; }
            .items-list { background: #f8faf9; padding: 20px; border-radius: 15px; border: 2px solid #e1e8e4; }
            .footer { position: absolute; bottom: 30px; left: 40px; right: 40px; border-top: 2px solid #e1e8e4; padding-top: 15px; font-size: 12px; text-align: center; color: #8a9d92; font-weight: bold; }
            @media print { 
              body { background: white; padding: 0; } 
              .label-container { border: 2px solid #000; box-shadow: none; border-radius: 0; width: 100%; height: 100%; } 
            }
          </style>
        </head>
        <body>
          <div class="label-container" id="pdf-content">
            <div class="header">
              <h1 style="margin: 0; font-size: 28px; font-weight: 900; color: #1a2f23;">ใบปะหน้าพัสดุ</h1>
              <p style="margin: 5px 0; font-size: 12px; font-weight: bold; color: #4a5d52;">ชมรมผู้กำกับนักศึกษาวิชาทหาร มทบ.45</p>
            </div>
            
            <div class="section">
              <div class="label">ผู้รับ (Recipient):</div>
              <div class="value">${order.fullName}</div>
              <div class="sub-value">${order.school}</div>
              <div class="sub-value">${order.trainingCenter}</div>
              <div class="sub-value" style="font-size: 18px; color: #1a2f23;">โทร: ${order.phone}</div>
            </div>

            <div class="section" style="margin-top: 30px; border-top: 2px dashed #1a2f23; padding-top: 20px;">
              <div class="label">ที่อยู่จัดส่งโรงเรียน:</div>
              <div class="value" style="font-size: 18px;">${shippingAddress}</div>
              <div class="sub-value">ผู้ติดต่อ: ${contactInfo}</div>
            </div>

            <div class="section">
              <div class="label">รายการสินค้า:</div>
              <div class="items-list">
                ${(order.items || []).map((item) => `<div style="margin-bottom: 5px;">• ${item.name} (${formatItemSize(item.name, item.size)}) x ${item.quantity}</div>`).join("")}
              </div>
            </div>

            <div class="footer">
              <p style="margin: 0;">ORDER ID: ${order.id.toUpperCase()}</p>
              <p style="margin: 5px 0 0 0;">พิมพ์เมื่อ: ${new Date().toLocaleString("th-TH")}</p>
            </div>
          </div>
          <script>
            
            const printAction = () => {
              if ('${action}' === 'pdf') {
                document.title = 'shipping_label_${order?.id || "label"}';
                setTimeout(() => window.print(), 500);
              } else {
                window.print();
              }
            };
            if (document.fonts) {
              document.fonts.ready.then(() => { setTimeout(printAction, 500); });
            } else {
              setTimeout(printAction, 500);
            }

          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleLogout = async () => {
    localStorage.removeItem("adminEmail");
    navigate("/");
  };

  const bulkUpdateStatus = async (status: OrderStatus) => {
    if (!status) return;
    try {
      // @ts-ignore
      window._isSyncPaused = true;
      for (const id of selectedOrderIds) {
        await safeUpdateOrder(id, {
          status,
          updatedAt: new Date().toISOString(),
        });
      }
      setSelectedOrderIds([]);
      alert("อัปเดตสถานะสำเร็จ");
    } catch (error) {
      console.error(error);
      alert("เกิดข้อผิดพลาดในการอัปเดตสถานะ");
    } finally {
      // @ts-ignore
      window._isSyncPaused = false;
    }
  };

  const handleExportToExcel = () => {
    if (filteredOrders.length === 0) {
      alert("ไม่มีข้อมูลให้ส่งออก");
      return;
    }

    const reportDate = format(new Date(), "dd/MM/yyyy HH:mm");

    // --- PART 1: Summary Sheet ---
    const summaryData = [
      ["--- รายงานสรุปภาพรวม (Summary) ---"],
      ["ข้อมูล ณ วันที่", reportDate],
      ["ตัวกรองที่เลือก:"],
      [
        "สถานะ",
        filterStatus === "all"
          ? "ทั้งหมด"
          : STATUS_CONFIG[filterStatus]?.label || filterStatus,
      ],
      ["ศูนย์ฝึก/จังหวัด", filterCenter === "all" ? "ทั้งหมด" : filterCenter],
      ["โรงเรียน", filterSchool === "all" ? "ทั้งหมด" : filterSchool],
      ["เพศ", filterGender === "all" ? "ทั้งหมด" : filterGender],
      ["วันที่", filterDate ? format(filterDate, "dd/MM/yyyy") : "ทั้งหมด"],
      [""],
      ["สถิติหลัก:"],
      ["รายได้รวม (บาท)", stats.totalSales],
      ["ภารกิจที่รอดำเนินการ (รายการ)", stats.pendingOrders],
      ["ภารกิจที่สำเร็จ (รายการ)", stats.completedOrders],
      ["คำสั่งซื้อรวม (รายการ)", stats.totalOrders],
      [""],
      ["แยกตามสถานะ:"],
      [
        "รับคำสั่งซื้อ",
        filteredOrders.filter((o) => o.status === "pending").length,
      ],
      [
        "ดำเนินการคำสั่งซื้อ",
        filteredOrders.filter((o) => o.status === "verifying").length,
      ],
      [
        "กำลังจัดส่ง",
        filteredOrders.filter((o) => o.status === "preparing").length,
      ],
      [
        "จัดส่งสำเร็จ",
        filteredOrders.filter((o) => o.status === "completed").length,
      ],
      ["ยกเลิก", filteredOrders.filter((o) => o.status === "cancelled").length],
    ];

    // --- PART 2: Detailed Sheet ---
    const detailedHeaders = [
      "หมายเลขสั่งซื้อ",
      "วันที่สั่งซื้อ",
      "ชื่อ-นามสกุล",
      "เบอร์โทร",
      "ศูนย์ฝึก/จังหวัด",
      "โรงเรียน",
      "เพศ",
      "ชั้นปี",
      "ส่วนสูง",
      "รายการสินค้า",
      "ยอดรวม (บาท)",
      "สถานะ",
    ];

    const detailRows = filteredOrders.map((order) => {
      let dateStr = "-";
      try {
        const d = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
        dateStr = format(d, "dd/MM/yyyy HH:mm");
      } catch(e) {}
      const itemsStr = sortOrderItemsBySize(getFilteredItems(order.items))
        .map((item) => `${item.name} (${formatItemSize(item.name, item.size)}) x${item.quantity}`)
        .join(" | ");
      const statusLabel =
        (STATUS_CONFIG[order.status as OrderStatus] || STATUS_CONFIG.pending)
          ?.label || order.status;

      return [
        order.id,
        dateStr,
        order.fullName,
        order.phone,
        order.trainingCenter || "-",
        order.school || "-",
        order.gender || "-",
        order.year || "-",
        order.height || "-",
        itemsStr,
        getOrderAmount(order),
        statusLabel,
      ];
    });

    // Create Workbook
    const wb = XLSX.utils.book_new();

    // Create Summary Worksheet
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "สรุปภาพรวม");

    // Create Details Worksheet
    const wsDetailsBuffer = [detailedHeaders, ...detailRows];
    const wsDetails = XLSX.utils.aoa_to_sheet(wsDetailsBuffer);
    XLSX.utils.book_append_sheet(wb, wsDetails, "รายละเอียดคำสั่งซื้อ");

    // Download Excel File
    XLSX.writeFile(
      wb,
      `ROTC-Shop-Report-${format(new Date(), "dd-MM-yyyy-HHmm")}.xlsx`,
    );
  };

  
  const getFilteredItems = (items: OrderItem[]) => {
    return items.filter(item => {
      const pMatch = filterProduct === "all" || item.name === filterProduct;
      const sMatch = filterSize === "all" || item.size === filterSize;
      return pMatch && sMatch;
    });
  };

  const filteredOrders = orders
    .filter((o) => {
      const matchesStatus = filterStatus === "all" || o.status === filterStatus;
      const matchesSearch =
        String(o.fullName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(o.id || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCenter =
        filterCenter === "all" || o.trainingCenter === filterCenter;
      const matchesSchool = filterSchool === "all" || o.school === filterSchool;
      const matchesGender = filterGender === "all" || o.gender === filterGender;
      const hasMatchingItem = o.items.some((item) => {
        const pMatch = filterProduct === "all" || item.name === filterProduct;
        const sMatch = filterSize === "all" || item.size === filterSize;
        return pMatch && sMatch;
      });
      const matchesDate = !filterDate ? true : (() => {
        try {
          const dateToCompare = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
          return format(dateToCompare, "yyyy-MM-dd") === format(filterDate, "yyyy-MM-dd");
        } catch(e) {
          return false;
        }
      })();
      return (
        matchesStatus &&
        matchesSearch &&
        matchesCenter &&
        matchesSchool &&
        matchesGender &&
        hasMatchingItem &&
        matchesDate
      );
    })
    .sort((a, b) => {
      if (!sortOrder) {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime() || 0;
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime() || 0;
        return dateB - dateA;
      }
      const nameA = String(a.fullName || "").toLowerCase();
      const nameB = String(b.fullName || "").toLowerCase();
      return sortOrder === "asc"
        ? nameA.localeCompare(nameB, "th")
        : nameB.localeCompare(nameA, "th");
    });

  const duplicateSlips = useMemo(() => {
    const slipCounts = new Map<string, string[]>();
    orders.forEach((o) => {
      const slipRaw = o.slipUrl || o.paymentRef || recoveredSlips[o.id];
      const slip = slipRaw ? String(slipRaw) : null;
      if (
        slip &&
        (slip.toLowerCase().startsWith("http") ||
          slip.toLowerCase().startsWith("data:"))
      ) {
        const orderIds = slipCounts.get(slip) || [];
        orderIds.push(o.id);
        slipCounts.set(slip, orderIds);
      }
    });
    return new Set(
      Array.from(slipCounts.entries())
        .filter(([_, orderIds]) => orderIds.length > 1)
        .map(([slip]) => slip),
    );
  }, [orders]);

  const trackingOrders = orders.filter(
    (o) => o.status === "preparing" || o.status === "completed",
  );

  const stats = {
    totalSales: filteredOrders
      .filter((o) => o.status !== "cancelled")
      .reduce((sum, o) => sum + getOrderAmount(o), 0),
    pendingOrders: filteredOrders.filter(
      (o) => o.status === "pending" || o.status === "verifying",
    ).length,
    completedOrders: filteredOrders.filter((o) => o.status === "completed")
      .length,
    totalOrders: filteredOrders.length,
  };

  // Chart Data
  const chartData = Object.entries(
    filteredOrders.reduce(
      (acc, o) => {
        let date = "Unknown";
        if (o.createdAt) {
          try {
            const d = o.createdAt.toDate
              ? o.createdAt.toDate()
              : new Date(o.createdAt);
            date = format(
              d,
              revenueFilter === "daily"
                ? "dd/MM"
                : revenueFilter === "monthly"
                  ? "MM/yyyy"
                  : "yyyy",
            );
          } catch (e) {}
        }
        acc[date] = (acc[date] || 0) + getOrderAmount(o);
        return acc;
      },
      {} as Record<string, number>,
    ),
  )
    .map(([name, amount]) => ({ name, amount }))
    .slice(-10);

  const renderSidebar = () => (
    <div
      className="w-64 bg-white border-r-2 border-army-bg h-screen fixed top-0 left-0 z-[100] flex flex-col md:translate-x-0 transition-transform duration-300 ease-in-out"
      style={{
        transform:
          isSidebarOpen || window.innerWidth >= 768
            ? "translateX(0)"
            : "translateX(-100%)",
      }}
    >
      <div className="p-8 border-b-2 border-army-bg flex items-center justify-between">
        <h1 className="text-2xl font-black text-army-dark uppercase tracking-tighter flex items-center space-x-3">
          <div className="w-8 h-8 bg-army-dark text-white rounded-lg flex items-center justify-center">
            <LayoutDashboard size={18} />
          </div>
          <span>ADMIN</span>
        </h1>
        <button
          className="md:hidden text-army-muted"
          onClick={() => setIsSidebarOpen(false)}
        >
          <X size={24} />
        </button>
      </div>
      <div className="flex-grow py-6 px-4 space-y-2 overflow-y-auto">
        <button
          onClick={() => handleTabChange("summary")}
          className={cn(
            "w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-black uppercase tracking-normal transition-all",
            activeTab === "summary"
              ? "bg-army-dark text-white"
              : "text-army-muted hover:bg-army-bg hover:text-army-dark",
          )}
        >
          <TrendingUp size={20} />
          <span>สรุปคำสั่งซื้อ</span>
        </button>
        <button
          onClick={() => handleTabChange("orders")}
          className={cn(
            "w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-black uppercase tracking-normal transition-all",
            activeTab === "orders"
              ? "bg-army-dark text-white"
              : "text-army-muted hover:bg-army-bg hover:text-army-dark",
          )}
        >
          <ShoppingCart size={20} />
          <span>จัดการคำสั่งซื้อ</span>
        </button>
        <button
          onClick={() => handleTabChange("tracking")}
          className={cn(
            "w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-black uppercase tracking-normal transition-all",
            activeTab === "tracking"
              ? "bg-army-dark text-white"
              : "text-army-muted hover:bg-army-bg hover:text-army-dark",
          )}
        >
          <Truck size={20} />
          <span>ติดตามพัสดุ</span>
        </button>
        <button
          onClick={() => navigate("/admin/products")}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-black uppercase tracking-normal transition-all text-army-muted hover:bg-army-bg hover:text-army-dark"
        >
          <Package size={20} />
          <span>จัดการสต็อก</span>
        </button>
        <button
          onClick={() => handleTabChange("settings")}
          className={cn(
            "w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-black uppercase tracking-normal transition-all",
            activeTab === "settings"
              ? "bg-army-dark text-white"
              : "text-army-muted hover:bg-army-bg hover:text-army-dark",
          )}
        >
          <SettingsIcon size={20} />
          <span>ตั้งค่าการชำระเงิน</span>
        </button>
        <button
          onClick={() => handleTabChange("schools")}
          className={cn(
            "w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-black uppercase tracking-normal transition-all",
            activeTab === "schools"
              ? "bg-army-dark text-white"
              : "text-army-muted hover:bg-army-bg hover:text-army-dark",
          )}
        >
          <Building2 size={20} />
          <span>พิมพ์ใบปะหน้า</span>
        </button>
        <button
          onClick={() => handleTabChange("print_orders")}
          className={cn(
            "w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-black uppercase tracking-normal transition-all",
            activeTab === "print_orders"
              ? "bg-army-dark text-white"
              : "text-army-muted hover:bg-army-bg hover:text-army-dark",
          )}
        >
          <Printer size={20} />
          <span>พิมพ์ใบสั่งซื้อ</span>
        </button>
        <button
          onClick={() => handleTabChange("embroidery")}
          className={cn(
            "w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-black uppercase tracking-normal transition-all",
            activeTab === "embroidery"
              ? "bg-army-dark text-white"
              : "text-army-muted hover:bg-army-bg hover:text-army-dark",
          )}
        >
          <Scissors size={20} />
          <span>รายชื่อสำหรับปัก</span>
        </button>
        <button
          onClick={() => handleTabChange("admins")}
          className={cn(
            "w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-black uppercase tracking-normal transition-all",
            activeTab === "admins"
              ? "bg-army-dark text-white"
              : "text-army-muted hover:bg-army-bg hover:text-army-dark",
          )}
        >
          <Users size={20} />
          <span>จัดการแอดมิน</span>
        </button>
      </div>
      <div className="p-4 border-t-2 border-army-bg space-y-2">
        <button
          onClick={() => navigate("/")}
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

  const AdminManagement = useMemo(() => () => {
    const [admins, setAdmins] = useState<{ id: string; email: string }[]>([]);
    const [newAdminEmail, setNewAdminEmail] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
      const fetchAdmins = async () => {
        try {
          const sheetAdmins = await googleSheetService.fetchRecords("Admins");
          if (sheetAdmins && sheetAdmins.length > 0) {
            setAdmins(
              sheetAdmins.map((a: any) => ({
                id: a.id || a.email,
                email: a.email,
              })),
            );
          }
        } catch (error) {
          console.error("Error fetching admins:", error);
        }
      };
      fetchAdmins();
    }, []);

    const addAdmin = async () => {
      if (!newAdminEmail) return;
      setLoading(true);
      try {
        await googleSheetService.syncRecord("Admins", {
          id: newAdminEmail,
          email: newAdminEmail,
          role: "admin",
          createdAt: new Date(),
        });
        setAdmins((prev) => [
          ...prev,
          { id: newAdminEmail, email: newAdminEmail },
        ]);
        setNewAdminEmail("");
        alert("เพิ่มแอดมินสำเร็จ");
      } catch (error) {
        console.error("Error adding admin:", error);
        alert("เกิดข้อผิดพลาดในการเพิ่มแอดมิน");
      } finally {
        setLoading(false);
      }
    };

    const [confirmDelete, setConfirmDelete] = useState<{
      id: string;
      email: string;
    } | null>(null);

    const deleteAdmin = async (id: string) => {
      try {
        await googleSheetService.deleteRecord("Admins", id);
        setAdmins((prev) => prev.filter((a) => a.id !== id));
        alert("ลบแอดมินสำเร็จ");
        setConfirmDelete(null);
      } catch (error) {
        console.error(error);
      }
    };

    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
        {/* Confirmation Modal */}
        {confirmDelete && (
          <div className="fixed inset-0 bg-army-dark/50 z-[200] flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-3xl border-2 border-army-dark shadow-2xl max-w-sm w-full space-y-6">
              <h3 className="text-xl font-black text-army-dark uppercase tracking-tighter">
                ยืนยันการลบ
              </h3>
              <p className="text-sm font-bold text-army-muted">
                คุณต้องการลบแอดมิน {confirmDelete.email} ใช่หรือไม่?
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 px-6 py-3 bg-army-bg text-army-dark rounded-xl font-black uppercase tracking-widest text-xs"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={() => deleteAdmin(confirmDelete.id)}
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl font-black uppercase tracking-widest text-xs"
                >
                  ลบ
                </button>
              </div>
            </div>
          </div>
        )}

        <div>
          <h2 className="text-4xl font-black text-army-dark uppercase tracking-tighter mb-2">
            จัดการแอดมิน
          </h2>
          <p className="text-army-muted font-bold uppercase tracking-widest text-sm">
            เพิ่มหรือลบรายชื่อแอดมิน
          </p>
        </div>
        <div className="bg-white p-8 rounded-3xl border-2 border-army-dark shadow-xl space-y-6">
          <div className="flex gap-4">
            <input
              type="email"
              value={newAdminEmail}
              onChange={(e) => setNewAdminEmail(e.target.value)}
              placeholder="อีเมลแอดมินใหม่"
              className="flex-grow px-6 py-4 bg-army-bg border-2 border-army-bg rounded-2xl focus:border-army-primary transition-all outline-none font-bold text-base"
            />
            <button
              onClick={addAdmin}
              disabled={loading}
              className="px-8 py-4 bg-army-dark text-white rounded-2xl font-black uppercase tracking-widest hover:bg-army-primary transition-all text-base"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                "เพิ่ม"
              )}
            </button>
          </div>
          <div className="space-y-4">
            {admins.map((admin) => (
              <div
                key={admin.id}
                className="flex items-center justify-between p-6 bg-army-bg rounded-2xl"
              >
                <span className="font-mono text-base font-bold text-army-dark">
                  {admin.email}
                </span>
                <button
                  onClick={() => setConfirmDelete(admin)}
                  className="text-red-600 hover:text-red-800 font-black uppercase tracking-widest text-sm"
                >
                  ลบ
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }, []);

  const PrintOrdersManagement = useMemo(() => ({
    orders,
    setOrders,
  }: {
    orders: Order[];
    setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  }) => {
    const [selectedType, setSelectedType] = useState<
      | "center"
      | "school"
      | "product"
      | "individual"
      | "gender"
      | "alphabetical"
      | "year"
      | null
    >(null);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState("");
    const [isUndoing, setIsUndoing] = useState<string | null>(null);
    const [orderedFilter, setOrderedFilter] = useState<"all" | "ordered" | "not_ordered">("all");
    const [embroideredFilter, setEmbroideredFilter] = useState<"all" | "embroidered" | "not_embroidered">("all");

    const handleSetItemOrderedStatus = async (itemId: string, targetValue: boolean, e: React.MouseEvent) => {
      e.stopPropagation();
      const statusText = targetValue ? "สั่งซื้อแล้ว" : "ยังไม่สั่งซื้อ";
      setConfirmModal({
        title: targetValue ? "ยืนยันการตั้งสถานะ" : "ยืนยันการยกเลิก",
        message: `ยืนยันการเปลี่ยนสถานะเป็น "${statusText}" สำหรับรายการนี้หรือไม่?`,
        onConfirm: async () => {
          setIsUndoing(itemId);
          try {
            let ordersToUpdate: Order[] = [];
            switch(selectedType) {
              case "center":
                ordersToUpdate = orders.filter(o => (o.trainingCenter || "ไม่ระบุศูนย์ฝึก") === itemId);
                break;
              case "school":
                ordersToUpdate = orders.filter(o => (o.school || "ไม่ระบุโรงเรียน") === itemId);
                break;
              case "gender":
                ordersToUpdate = orders.filter(o => (o.gender || "ไม่ระบุเพศ") === itemId);
                break;
              case "alphabetical":
              case "individual":
                ordersToUpdate = orders.filter(o => o.id === itemId);
                break;
              case "product":
                ordersToUpdate = orders.filter(o => o.items.some(i => `${i.name} (${formatItemSize(i.name, i.size)})` === itemId));
                break;
              case "year":
                ordersToUpdate = orders.filter(o => (o.year || "ไม่ระบุชั้นปี") === itemId);
                break;
            }

            const updatedOrderIds = new Set(ordersToUpdate.map(o => o.id));
            setOrders(prev => prev.map(ord => updatedOrderIds.has(ord.id) ? { ...ord, isOrdered: targetValue } : ord));

            // @ts-ignore
            window._isSyncPaused = true;
            for (const o of ordersToUpdate) {
              const payload: any = { ...o, isOrdered: targetValue };
              if (!payload.items || payload.items.length === 0) payload.items = payload._rawItems;
              delete payload._rawItems;
              try {
                await setDoc(doc(db, "orders", o.id), { isOrdered: targetValue }, { merge: true });
              } catch (dbErr) {
                console.warn("Firestore setDoc error:", dbErr);
              }
              await googleSheetService.syncRecord("Orders", payload);
            }
          } catch (err) {
            console.error(err);
            alert("เกิดข้อผิดพลาดในการอัปเดตสถานะ");
          } finally {
            // @ts-ignore
            window._isSyncPaused = false;
            setIsUndoing(null);
          }
        }
      });
    };

    const handleBulkMarkOrderedStatus = async (itemIds: Set<string>, targetValue: boolean) => {
      if (itemIds.size === 0) return;
      const statusText = targetValue ? "สั่งซื้อแล้ว" : "ยังไม่สั่งซื้อ";
      setConfirmModal({
        title: targetValue ? "ยืนยันการตั้งสถานะกลุ่ม" : "ยืนยันการยกเลิกกลุ่ม",
        message: `ยืนยันการเปลี่ยนสถานะเป็น "${statusText}" สำหรับทั้ง ${itemIds.size} กลุ่ม/รายการที่เลือกหรือไม่?`,
        onConfirm: async () => {
          setLoading(true);
          try {
            let allOrdersToUpdate: Order[] = [];
            for (const itemId of Array.from(itemIds)) {
              let ordersToUpdate: Order[] = [];
              switch(selectedType) {
                case "center":
                  ordersToUpdate = orders.filter(o => (o.trainingCenter || "ไม่ระบุศูนย์ฝึก") === itemId);
                  break;
                case "school":
                  ordersToUpdate = orders.filter(o => (o.school || "ไม่ระบุโรงเรียน") === itemId);
                  break;
                case "gender":
                  ordersToUpdate = orders.filter(o => (o.gender || "ไม่ระบุเพศ") === itemId);
                  break;
                case "alphabetical":
                case "individual":
                  ordersToUpdate = orders.filter(o => o.id === itemId);
                  break;
                case "product":
                  ordersToUpdate = orders.filter(o => o.items.some(i => `${i.name} (${formatItemSize(i.name, i.size)})` === itemId));
                  break;
                case "year":
                  ordersToUpdate = orders.filter(o => (o.year || "ไม่ระบุชั้นปี") === itemId);
                  break;
              }
              allOrdersToUpdate.push(...ordersToUpdate);
            }

            // Remove duplicates
            const uniqueMap = new Map<string, Order>();
            allOrdersToUpdate.forEach(o => uniqueMap.set(o.id, o));
            const uniqueOrdersToUpdate = Array.from(uniqueMap.values());

            if (uniqueOrdersToUpdate.length === 0) return;

            const updatedOrderIds = new Set(uniqueOrdersToUpdate.map(o => o.id));
            setOrders(prev => prev.map(ord => updatedOrderIds.has(ord.id) ? { ...ord, isOrdered: targetValue } : ord));

            // @ts-ignore
            window._isSyncPaused = true;
            
            // Perform updates sequentially or concurrently
            for (const o of uniqueOrdersToUpdate) {
              const payload: any = { ...o, isOrdered: targetValue };
              if (!payload.items || payload.items.length === 0) payload.items = payload._rawItems;
              delete payload._rawItems;
              try {
                await setDoc(doc(db, "orders", o.id), { isOrdered: targetValue }, { merge: true });
              } catch (dbErr) {
                console.warn("Firestore setDoc error:", dbErr);
              }
              await googleSheetService.syncRecord("Orders", payload);
            }

          } catch (err) {
            console.error(err);
            alert("เกิดข้อผิดพลาดในการอัปเดตสถานะแบบกลุ่ม");
          } finally {
            // @ts-ignore
            window._isSyncPaused = false;
            setLoading(false);
          }
        }
      });
    };

    const getAvailableItems = () => {
      if (!selectedType) return [];

      let items: any[] = [];
      if (selectedType === "center") {
        const centers = Array.from(
          new Set(orders.map((o) => o.trainingCenter || "ไม่ระบุศูนย์ฝึก")),
        ).sort();
        items = centers.map((c) => {
          const centerOrders = orders.filter(
            (o) => (o.trainingCenter || "ไม่ระบุศูนย์ฝึก") === c,
          );
          return {
            id: c,
            label: c,
            isOrdered:
              centerOrders.length > 0 && centerOrders.every((o) => o.isOrdered),
            isEmbroidered:
              centerOrders.length > 0 && centerOrders.every((o) => o.isEmbroidered),
          };
        });
      } else if (selectedType === "school") {
        const schools = Array.from(
          new Set(orders.map((o) => o.school || "ไม่ระบุโรงเรียน")),
        ).sort();
        items = schools.map((s) => {
          const schoolOrders = orders.filter(
            (o) => (o.school || "ไม่ระบุโรงเรียน") === s,
          );
          return {
            id: s,
            label: s,
            isOrdered:
              schoolOrders.length > 0 && schoolOrders.every((o) => o.isOrdered),
            isEmbroidered:
              schoolOrders.length > 0 && schoolOrders.every((o) => o.isEmbroidered),
          };
        });
      } else if (selectedType === "gender") {
        items = ["ชาย", "หญิง"].map((g) => {
          const genderOrders = orders.filter(
            (o) => (o.gender || "ไม่ระบุเพศ") === g,
          );
          return {
            id: g,
            label: g,
            isOrdered:
              genderOrders.length > 0 && genderOrders.every((o) => o.isOrdered),
            isEmbroidered:
              genderOrders.length > 0 && genderOrders.every((o) => o.isEmbroidered),
          };
        });
      } else if (selectedType === "alphabetical") {
        items = [...orders]
          .sort((a, b) => a.fullName.localeCompare(b.fullName, "th"))
          .map((o) => ({
            id: o.id,
            label: `${o.fullName} (${o.id.slice(0, 8).toUpperCase()})`,
            isOrdered: o.isOrdered,
            isEmbroidered: o.isEmbroidered,
          }));
      } else if (selectedType === "product") {
        const productsMap = new Map<string, typeof orders>();
        orders.forEach((o) =>
          (o.items || []).forEach((item) => {
            const normalizedName = item.name.trim().replace(/\s+/g, ' ');
            let pName = `${normalizedName} (${formatItemSize(item.name, item.size)})`;
            if (!productsMap.has(pName)) productsMap.set(pName, []);
            productsMap.get(pName)!.push(o);
          }),
        );
        let productKeysObj = Array.from(productsMap.keys()).map(k => {
          const match = k.match(/^(.*?)\s*\((.*?)\)(?: - (.*))?$/);
          if (match) return { key: k, name: match[1], size: match[2] };
          return { key: k, name: k, size: "" };
        });
        
        let productKeys = sortOrderItemsBySize(productKeysObj).map((o: any) => o.key);
        
        items = productKeys
          .map((p) => {
            const productOrders = productsMap.get(p)!;
            return {
              id: p,
              label: p,
              isOrdered:
                productOrders.length > 0 &&
                productOrders.every((o) => o.isOrdered),
              isEmbroidered:
                productOrders.length > 0 &&
                productOrders.every((o) => o.isEmbroidered),
            };
          });
      } else if (selectedType === "individual") {
        items = orders.map((o) => ({
          id: o.id,
          label: `${o.fullName} (${o.id.slice(0, 8).toUpperCase()})`,
          isOrdered: o.isOrdered,
          isEmbroidered: o.isEmbroidered,
        }));
      } else if (selectedType === "year") {
        const years = Array.from(
          new Set(orders.map((o) => o.year || "ไม่ระบุชั้นปี")),
        ).sort();
        items = years.map((y) => {
          const yearOrders = orders.filter(
            (o) => (o.year || "ไม่ระบุชั้นปี") === y,
          );
          return {
            id: y,
            label: y,
            isOrdered:
              yearOrders.length > 0 && yearOrders.every((o) => o.isOrdered),
            isEmbroidered:
              yearOrders.length > 0 && yearOrders.every((o) => o.isEmbroidered),
          };
        });
      }

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        items = items.filter((item) => {
          const label = typeof item === "string" ? item : item.label;
          return label.toLowerCase().includes(query);
        });
      }

      // Filter by orderedFilter
      if (orderedFilter === "ordered") {
        items = items.filter((item) => typeof item !== "string" && item.isOrdered === true);
      } else if (orderedFilter === "not_ordered") {
        items = items.filter((item) => typeof item !== "string" && item.isOrdered !== true);
      }

      // Filter by embroideredFilter
      if (embroideredFilter === "embroidered") {
        items = items.filter((item) => typeof item !== "string" && item.isEmbroidered === true);
      } else if (embroideredFilter === "not_embroidered") {
        items = items.filter((item) => typeof item !== "string" && item.isEmbroidered !== true);
      }

      return items;
    };

    const toggleItem = (item: string) => {
      const newSelected = new Set(selectedItems);
      if (newSelected.has(item)) {
        newSelected.delete(item);
      } else {
        newSelected.add(item);
      }
      setSelectedItems(newSelected);
    };

    const selectAll = () => {
      const items = getAvailableItems();
      const itemIds = items.map((item) =>
        typeof item === "string" ? item : item.id,
      );
      setSelectedItems(new Set(itemIds));
    };

    const handlePrint = (
      type:
        | "center"
        | "school"
        | "product"
        | "individual"
        | "gender"
        | "alphabetical"
        | "year",
      filterItems?: Set<string>,
      action: "print" | "pdf" | "pdf_not_ordered" = "print",
    ) => {
      let printWindow: Window | null = null;
      let iframeId = `pdf-iframe-${Date.now()}`;

      // Filter orders based on selected items if provided
      let filteredOrders = [...orders];
      if (filterItems && filterItems.size > 0) {
        if (type === "center") {
          filteredOrders = filteredOrders.filter((o) =>
            filterItems.has(o.trainingCenter || "ไม่ระบุศูนย์ฝึก"),
          );
        } else if (type === "school") {
          filteredOrders = filteredOrders.filter((o) =>
            filterItems.has(o.school || "ไม่ระบุโรงเรียน"),
          );
        } else if (type === "gender") {
          filteredOrders = filteredOrders.filter((o) =>
            filterItems.has(o.gender || "ไม่ระบุเพศ"),
          );
        } else if (type === "individual" || type === "alphabetical") {
          filteredOrders = filteredOrders.filter((o) => filterItems.has(o.id));
        } else if (type === "year") {
          filteredOrders = filteredOrders.filter((o) =>
            filterItems.has(o.year || "ไม่ระบุชั้นปี"),
          );
        }
      }

      if (action === "pdf_not_ordered") {
        filteredOrders = filteredOrders.filter(o => !o.isOrdered);
      }

      if (filteredOrders.length === 0 && action === "pdf_not_ordered") {
        alert("ไม่มีรายการที่ยังไม่ได้สั่งซื้อ");
        return;
      }

      // Generate directly without limits
      let currentAction = action;

      printWindow = window.open("", "_blank");

      if (!printWindow) return;

      let content = "";
      const dateStr = new Date().toLocaleDateString("th-TH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      // Sort ALL filtered orders by gender (ชาย first) and then by name (ก-ฮ)
      filteredOrders.sort((a, b) => {
        const genderA = a.gender || "ไม่ระบุเพศ";
        const genderB = b.gender || "ไม่ระบุเพศ";
        if (genderA !== genderB) {
          return genderA.localeCompare(genderB, "th");
        }
        return a.fullName.localeCompare(b.fullName, "th");
      });

      const chunkArray = (arr: any[], size: number) => {
        const result = [];
        for (let i = 0; i < arr.length; i += size) {
          result.push({ items: arr.slice(i, i + size), startIndex: i });
        }
        return result;
      };

      let totalProductQuantity = 0;

      if (type === "center") {
        const grouped = filteredOrders.reduce((acc: any, order) => {
          const center = order.trainingCenter || "ไม่ระบุศูนย์ฝึก";
          const school = order.school || "ไม่ระบุโรงเรียน";
          if (!acc[center]) acc[center] = {};
          if (!acc[center][school]) acc[center][school] = {};
          const gender = order.gender || "ไม่ระบุเพศ";
          if (!acc[center][school][gender]) acc[center][school][gender] = [];
          acc[center][school][gender].push(order);
          return acc;
        }, {});

        content = Object.entries(grouped)
          .map(([center, schoolGroup]: [string, any]) => {
            return Object.entries(schoolGroup).map(([school, genderGroup]: [string, any], schoolIdx) => {
              const genderEntries = Object.entries(genderGroup);
              const firstGender = genderEntries.slice(0, 1);
              const remainingGenders = genderEntries.slice(1);

              return `
          <div class="report-section">
            ${firstGender
              .map(
                ([gender, centerOrders]: [string, any]) => `
              ${chunkArray(centerOrders, 10)
                .map(
                  (chunk, index) => `
                <div class="keep-together" style="margin-top: 15px;">
                  ${schoolIdx === 0 && index === 0 ? `<h2>ศูนย์ฝึก: ${center}</h2>` : ""}
                  ${index === 0 ? `<h3>โรงเรียน: ${school} | เพศ: ${gender} (${centerOrders.length} รายการ)</h3>` : ""}
                  <table>
                    <thead>
                      <tr>
                        <th style="width: 5%">ลำดับ</th>
                        <th style="width: 15%">ศูนย์ฝึก</th>
                        <th style="width: 15%">โรงเรียน</th>
                        <th style="width: 15%">ชื่อ-นามสกุล</th>
                        <th style="width: 42%">รายการ</th>
                        <th style="width: 8%">ยอดรวม</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${chunk.items
                        .map(
                          (o: any, i: number) => `
                        <tr>
                          <td>${chunk.startIndex + i + 1}</td>
                          <td>${center}</td>
                          <td style="white-space: normal;">${school.replace(/วิทยา/g, '<br/>วิทยา')}</td>
                          <td>${o.fullName} ${(o.gender === 'ชาย' || o.gender === 'ช' || o.gender?.toLowerCase() === 'male' || o.gender?.toLowerCase() === 'm') ? '(ช)' : (o.gender === 'หญิง' || o.gender === 'ญ' || o.gender?.toLowerCase() === 'female' || o.gender?.toLowerCase() === 'f') ? '(ญ)' : ''}</td>
                          <td><div>${sortOrderItemsBySize(getFilteredItems(o.items)).map((item: any) => `${item.name} (${formatItemSize(item.name, item.size)}) x ${item.quantity}`).join("</div><div>")}</div></td>
                          <td>${formatPrice(getOrderAmount(o))}</td>
                        </tr>
                      `,
                        )
                        .join("")}
                    </tbody>
                  </table>
                </div>
              `,
                )
                .join('<div style="height: 15px;"></div>')}
            `,
              )
              .join("")}
            ${remainingGenders
              .map(
                ([gender, centerOrders]: [string, any]) => `
              ${chunkArray(centerOrders, 10)
                .map(
                  (chunk, index) => `
                <div class="keep-together" style="margin-top: 15px;">
                  ${index === 0 ? `<h3>โรงเรียน: ${school} | เพศ: ${gender} (${centerOrders.length} รายการ)</h3>` : ""}
                  <table>
                    <thead>
                      <tr>
                        <th style="width: 5%">ลำดับ</th>
                        <th style="width: 15%">ศูนย์ฝึก</th>
                        <th style="width: 15%">โรงเรียน</th>
                        <th style="width: 15%">ชื่อ-นามสกุล</th>
                        <th style="width: 42%">รายการ</th>
                        <th style="width: 8%">ยอดรวม</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${chunk.items
                        .map(
                          (o: any, i: number) => `
                        <tr>
                          <td>${chunk.startIndex + i + 1}</td>
                          <td>${center}</td>
                          <td style="white-space: normal;">${school.replace(/วิทยา/g, '<br/>วิทยา')}</td>
                          <td>${o.fullName} ${(o.gender === 'ชาย' || o.gender === 'ช' || o.gender?.toLowerCase() === 'male' || o.gender?.toLowerCase() === 'm') ? '(ช)' : (o.gender === 'หญิง' || o.gender === 'ญ' || o.gender?.toLowerCase() === 'female' || o.gender?.toLowerCase() === 'f') ? '(ญ)' : ''}</td>
                          <td><div>${sortOrderItemsBySize(getFilteredItems(o.items)).map((item: any) => `${item.name} (${formatItemSize(item.name, item.size)}) x ${item.quantity}`).join("</div><div>")}</div></td>
                          <td>${formatPrice(getOrderAmount(o))}</td>
                        </tr>
                      `,
                        )
                        .join("")}
                    </tbody>
                  </table>
                </div>
              `,
                )
                .join('<div style="height: 15px;"></div>')}
            `,
              )
              .join("")}
          </div>
        `;
            }).join("");
          })
          .join("");
      } else if (type === "year") {
        const grouped = filteredOrders.reduce((acc: any, order) => {
          const year = order.year || "ไม่ระบุชั้นปี";
          const school = order.school || "ไม่ระบุโรงเรียน";
          if (!acc[year]) acc[year] = {};
          if (!acc[year][school]) acc[year][school] = {};
          const gender = order.gender || "ไม่ระบุเพศ";
          if (!acc[year][school][gender]) acc[year][school][gender] = [];
          acc[year][school][gender].push(order);
          return acc;
        }, {});

        content = Object.entries(grouped)
          .map(([year, schoolGroup]: [string, any]) => {
            return Object.entries(schoolGroup).map(([school, genderGroup]: [string, any], schoolIdx) => {
              const genderEntries = Object.entries(genderGroup);
              const firstGender = genderEntries.slice(0, 1);
              const remainingGenders = genderEntries.slice(1);

              return `
          <div class="report-section">
            ${firstGender
              .map(
                ([gender, yearOrders]: [string, any]) => `
              ${chunkArray(yearOrders, 10)
                .map(
                  (chunk, index) => `
                <div class="keep-together" style="margin-top: 15px;">
                  ${schoolIdx === 0 && index === 0 ? `<h2>ชั้นปี: ${year}</h2>` : ""}
                  ${index === 0 ? `<h3>โรงเรียน: ${school} | เพศ: ${gender} (${yearOrders.length} รายการ)</h3>` : ""}
                  <table>
                    <thead>
                      <tr>
                        <th style="width: 5%">ลำดับ</th>
                        <th style="width: 15%">ชื่อ-นามสกุล</th>
                        <th style="width: 15%">ศูนย์ฝึก</th>
                        <th style="width: 57%">รายการ</th>
                        <th style="width: 8%">ยอดรวม</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${chunk.items
                        .map(
                          (o: any, i: number) => `
                        <tr>
                          <td>${chunk.startIndex + i + 1}</td>
                          <td>${o.fullName} ${(o.gender === 'ชาย' || o.gender === 'ช' || o.gender?.toLowerCase() === 'male' || o.gender?.toLowerCase() === 'm') ? '(ช)' : (o.gender === 'หญิง' || o.gender === 'ญ' || o.gender?.toLowerCase() === 'female' || o.gender?.toLowerCase() === 'f') ? '(ญ)' : ''}</td>
                          <td>${o.trainingCenter}</td>
                          <td><div>${sortOrderItemsBySize(getFilteredItems(o.items)).map((item: any) => `${item.name} (${formatItemSize(item.name, item.size)}) x ${item.quantity}`).join("</div><div>")}</div></td>
                          <td>${formatPrice(getOrderAmount(o))}</td>
                        </tr>
                      `,
                        )
                        .join("")}
                    </tbody>
                  </table>
                </div>
              `,
                )
                .join('<div style="height: 15px;"></div>')}
            `,
              )
              .join("")}
            ${remainingGenders
              .map(
                ([gender, yearOrders]: [string, any]) => `
              ${chunkArray(yearOrders, 10)
                .map(
                  (chunk, index) => `
                <div class="keep-together" style="margin-top: 15px;">
                  ${index === 0 ? `<h3>โรงเรียน: ${school} | เพศ: ${gender} (${yearOrders.length} รายการ)</h3>` : ""}
                  <table>
                    <thead>
                      <tr>
                        <th style="width: 5%">ลำดับ</th>
                        <th style="width: 15%">ชื่อ-นามสกุล</th>
                        <th style="width: 15%">ศูนย์ฝึก</th>
                        <th style="width: 57%">รายการ</th>
                        <th style="width: 8%">ยอดรวม</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${chunk.items
                        .map(
                          (o: any, i: number) => `
                        <tr>
                          <td>${chunk.startIndex + i + 1}</td>
                          <td>${o.fullName} ${(o.gender === 'ชาย' || o.gender === 'ช' || o.gender?.toLowerCase() === 'male' || o.gender?.toLowerCase() === 'm') ? '(ช)' : (o.gender === 'หญิง' || o.gender === 'ญ' || o.gender?.toLowerCase() === 'female' || o.gender?.toLowerCase() === 'f') ? '(ญ)' : ''}</td>
                          <td>${o.trainingCenter}</td>
                          <td><div>${sortOrderItemsBySize(getFilteredItems(o.items)).map((item: any) => `${item.name} (${formatItemSize(item.name, item.size)}) x ${item.quantity}`).join("</div><div>")}</div></td>
                          <td>${formatPrice(getOrderAmount(o))}</td>
                        </tr>
                      `,
                        )
                        .join("")}
                    </tbody>
                  </table>
                </div>
              `,
                )
                .join('<div style="height: 15px;"></div>')}
            `,
              )
              .join("")}
          </div>
        `;
            }).join("");
          })
          .join("");
      } else if (type === "school") {
        const grouped = filteredOrders.reduce((acc: any, order) => {
          const school = order.school || "ไม่ระบุโรงเรียน";
          if (!acc[school]) acc[school] = {};
          const gender = order.gender || "ไม่ระบุเพศ";
          if (!acc[school][gender]) acc[school][gender] = [];
          acc[school][gender].push(order);
          return acc;
        }, {});

        content = Object.entries(grouped)
          .map(([school, genderGroup]: [string, any]) => {
            const genderEntries = Object.entries(genderGroup);
            const firstGender = genderEntries.slice(0, 1);
            const remainingGenders = genderEntries.slice(1);

            return `
          <div class="report-section">
            ${firstGender
              .map(
                ([gender, schoolOrders]: [string, any]) => `
              ${chunkArray(schoolOrders, 10)
                .map(
                  (chunk, index) => `
                <div class="keep-together" style="margin-top: 15px;">
                  ${index === 0 ? `<h2>โรงเรียน: ${school}</h2><h3>เพศ: ${gender} (${schoolOrders.length} รายการ)</h3>` : ""}
                  <table>
                    <thead>
                      <tr>
                        <th style="width: 5%">ลำดับ</th>
                        <th style="width: 12%">ชื่อ-นามสกุล</th>
                        <th style="width: 15%">ศูนย์ฝึก</th>
                        <th style="width: 60%">รายการ</th>
                        <th style="width: 8%">ยอดรวม</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${chunk.items
                        .map(
                          (o: any, i: number) => `
                        <tr>
                          <td>${chunk.startIndex + i + 1}</td>
                          <td>${o.fullName} ${(o.gender === 'ชาย' || o.gender === 'ช' || o.gender?.toLowerCase() === 'male' || o.gender?.toLowerCase() === 'm') ? '(ช)' : (o.gender === 'หญิง' || o.gender === 'ญ' || o.gender?.toLowerCase() === 'female' || o.gender?.toLowerCase() === 'f') ? '(ญ)' : ''}</td>
                          <td>${o.trainingCenter}</td>
                          <td><div>${sortOrderItemsBySize(getFilteredItems(o.items)).map((item: any) => `${item.name} (${formatItemSize(item.name, item.size)}) x ${item.quantity}`).join("</div><div>")}</div></td>
                          <td>${formatPrice(getOrderAmount(o))}</td>
                        </tr>
                      `,
                        )
                        .join("")}
                    </tbody>
                  </table>
                </div>
              `,
                )
                .join('<div style="height: 15px;"></div>')}
            `,
              )
              .join("")}
            ${remainingGenders
              .map(
                ([gender, schoolOrders]: [string, any]) => `
              ${chunkArray(schoolOrders, 10)
                .map(
                  (chunk, index) => `
                <div class="keep-together" style="margin-top: 15px;">
                  ${index === 0 ? `<h3>เพศ: ${gender} (${schoolOrders.length} รายการ)</h3>` : ""}
                  <table>
                    <thead>
                      <tr>
                        <th style="width: 5%">ลำดับ</th>
                        <th style="width: 12%">ชื่อ-นามสกุล</th>
                        <th style="width: 15%">ศูนย์ฝึก</th>
                        <th style="width: 60%">รายการ</th>
                        <th style="width: 8%">ยอดรวม</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${chunk.items
                        .map(
                          (o: any, i: number) => `
                        <tr>
                          <td>${chunk.startIndex + i + 1}</td>
                          <td>${o.fullName} ${(o.gender === 'ชาย' || o.gender === 'ช' || o.gender?.toLowerCase() === 'male' || o.gender?.toLowerCase() === 'm') ? '(ช)' : (o.gender === 'หญิง' || o.gender === 'ญ' || o.gender?.toLowerCase() === 'female' || o.gender?.toLowerCase() === 'f') ? '(ญ)' : ''}</td>
                          <td>${o.trainingCenter}</td>
                          <td><div>${sortOrderItemsBySize(getFilteredItems(o.items)).map((item: any) => `${item.name} (${formatItemSize(item.name, item.size)}) x ${item.quantity}`).join("</div><div>")}</div></td>
                          <td>${formatPrice(getOrderAmount(o))}</td>
                        </tr>
                      `,
                        )
                        .join("")}
                    </tbody>
                  </table>
                </div>
              `,
                )
                .join('<div style="height: 15px;"></div>')}
            `,
              )
              .join("")}
          </div>
        `;
          })
          .join("");
      } else if (type === "gender" || type === "alphabetical") {
        const grouped = filteredOrders.reduce((acc: any, order) => {
          const gender = order.gender || "ไม่ระบุเพศ";
          const school = order.school || "ไม่ระบุโรงเรียน";
          if (!acc[gender]) acc[gender] = {};
          if (!acc[gender][school]) acc[gender][school] = [];
          acc[gender][school].push(order);
          return acc;
        }, {});

        content = Object.entries(grouped)
          .map(([gender, schoolGroup]: [string, any]) => {
            return Object.entries(schoolGroup).map(([school, genderOrders]: [string, any], schoolIdx) => {
              return `
        <div class="report-section">
          ${chunkArray(genderOrders, 10)
            .map(
              (chunk, index) => `
          <div class="keep-together" style="margin-top: 15px;">
            ${schoolIdx === 0 && index === 0 ? `<h2>เพศ: ${gender}</h2>` : ""}
            ${index === 0 ? `<h3>โรงเรียน: ${school} (${genderOrders.length} รายการ)</h3>` : ""}
            <table>
              <thead>
                <tr>
                  <th style="width: 5%">ลำดับ</th>
                  <th style="width: 15%">ชื่อ-นามสกุล</th>
                  <th style="width: 15%">ศูนย์ฝึก</th>
                  <th style="width: 57%">รายการ</th>
                  <th style="width: 8%">ยอดรวม</th>
                </tr>
              </thead>
              <tbody>
                ${chunk.items
                  .map(
                    (o: any, i: number) => `
                  <tr>
                    <td>${chunk.startIndex + i + 1}</td>
                    <td>${o.fullName} ${(o.gender === 'ชาย' || o.gender === 'ช' || o.gender?.toLowerCase() === 'male' || o.gender?.toLowerCase() === 'm') ? '(ช)' : (o.gender === 'หญิง' || o.gender === 'ญ' || o.gender?.toLowerCase() === 'female' || o.gender?.toLowerCase() === 'f') ? '(ญ)' : ''}</td>
                    <td>${o.trainingCenter}</td>
                    <td><div>${sortOrderItemsBySize(getFilteredItems(o.items)).map((item: any) => `${item.name} (${formatItemSize(item.name, item.size)}) x ${item.quantity}`).join("</div><div>")}</div></td>
                    <td>${formatPrice(getOrderAmount(o))}</td>
                  </tr>
                `,
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
          `,
            )
            .join('<div style="height: 15px;"></div>')}
        </div>
      `;
            }).join("");
          })
          .join("");
      } else if (type === "product") {
        const productSummary: any = {};
        
        filteredOrders.forEach((order) => {
          (getFilteredItems(order.items || [])).forEach((item) => {
            const normalizedName = item.name.trim().replace(/\s+/g, ' ');
            const filterKey = `${normalizedName} (${formatItemSize(item.name, item.size)})`;
            if (filterItems && filterItems.size > 0 && !filterItems.has(filterKey))
              return;

            let key = filterKey;
            
            const isTShirt = normalizedName.includes("เสื้อยืดรองในสีกากี");

            if (!productSummary[key])
              productSummary[key] = {
                name: normalizedName,
                size: item.size,
                quantity: 0,
                quantityMale: 0,
                quantityFemale: 0,
                total: 0,
                isTShirt,
              };
              
            productSummary[key].quantity += item.quantity;
            productSummary[key].total += item.price * item.quantity;
            
            if (isTShirt) {
               const genderStr = (item.gender || order.gender || "ไม่ระบุเพศ").trim();
               const isMale = genderStr === "ชาย" || (genderStr.includes("ชาย") && !genderStr.includes("หญิง")) || genderStr === "ช" || genderStr.toLowerCase() === "m" || genderStr.toLowerCase() === "male";
               const isFemale = genderStr === "หญิง" || genderStr.includes("หญิง") || genderStr === "ญ" || genderStr.toLowerCase() === "f" || genderStr.toLowerCase() === "female";
               
               if (isMale) productSummary[key].quantityMale += item.quantity;
               else if (isFemale) productSummary[key].quantityFemale += item.quantity;
            }

            totalProductQuantity += item.quantity;
          });
        });

        let sortedProducts = sortOrderItemsBySize(Object.values(productSummary));

        content = `
        <div class="report-section">
          ${chunkArray(sortedProducts, 15)
            .map(
              (chunk, index) => `
          <div class="keep-together" style="margin-top: 15px;">
            ${index === 0 ? `<h2>สรุปตามรายการสินค้า</h2>` : ""}
            <table>
              <thead>
                <tr>
                  <th style="width: 10%">ลำดับ</th>
                  <th style="width: 35%">รายการสินค้า</th>
                  <th style="width: 15%">ขนาด</th>
                  <th style="width: 10%">ชาย</th>
                  <th style="width: 10%">หญิง</th>
                  <th style="width: 10%">จำนวนรวม</th>
                  <th style="width: 10%">ยอดรวม</th>
                </tr>
              </thead>
              <tbody>
                ${chunk.items
                  .map(
                    (p: any, i: number) => `
                  <tr>
                    <td>${chunk.startIndex + i + 1}</td>
                    <td>${p.name}</td>
                    <td>${formatItemSize(p.name, p.size)}</td>
                    <td>${p.isTShirt ? (p.quantityMale > 0 ? p.quantityMale : "0") : "-"}</td>
                    <td>${p.isTShirt ? (p.quantityFemale > 0 ? p.quantityFemale : "0") : "-"}</td>
                    <td>${p.quantity}</td>
                    <td>${formatPrice(p.total)}</td>
                  </tr>
                `,
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
          `,
            )
            .join('<div style="height: 15px;"></div>')}
        </div>
      `;
      } else {
        const grouped = filteredOrders.reduce((acc: any, order) => {
          const school = order.school || "ไม่ระบุโรงเรียน";
          const gender = order.gender || "ไม่ระบุเพศ";
          if (!acc[school]) acc[school] = {};
          if (!acc[school][gender]) acc[school][gender] = [];
          acc[school][gender].push(order);
          return acc;
        }, {});

        content = Object.entries(grouped)
          .map(([school, genderGroup]: [string, any]) => {
            const genderEntries = Object.entries(genderGroup);
            const firstGender = genderEntries.slice(0, 1);
            const remainingGenders = genderEntries.slice(1);

            return `
        <div class="report-section">
          ${firstGender
            .map(
              ([gender, genderOrders]: [string, any]) => `
            ${chunkArray(genderOrders, 10)
              .map(
                (chunk, index) => `
              <div class="keep-together" style="margin-top: 15px;">
                ${index === 0 ? `<h2>รายการคำสั่งซื้อรายบุคคล</h2><h3>โรงเรียน: ${school} | เพศ: ${gender} (${genderOrders.length} รายการ)</h3>` : ""}
                <table>
                  <thead>
                    <tr>
                      <th style="width: 5%">ลำดับ</th>
                      <th style="width: 12%">ORDER ID</th>
                      <th style="width: 15%">ชื่อ-นามสกุล</th>
                      <th style="width: 50%">รายการ</th>
                      <th style="width: 8%">ยอดรวม</th>
                      <th style="width: 10%">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${chunk.items
                      .map(
                        (o: any, i: number) => `
                      <tr>
                        <td>${chunk.startIndex + i + 1}</td>
                        <td>${o.id.slice(0, 8).toUpperCase()}</td>
                        <td>${o.fullName} ${(o.gender === 'ชาย' || o.gender === 'ช' || o.gender?.toLowerCase() === 'male' || o.gender?.toLowerCase() === 'm') ? '(ช)' : (o.gender === 'หญิง' || o.gender === 'ญ' || o.gender?.toLowerCase() === 'female' || o.gender?.toLowerCase() === 'f') ? '(ญ)' : ''}</td>
                        <td><div>${sortOrderItemsBySize(getFilteredItems(o.items)).map((item: any) => `${item.name} (${formatItemSize(item.name, item.size)}) x ${item.quantity}`).join("</div><div>")}</div></td>
                        <td>${formatPrice(getOrderAmount(o))}</td>
                        <td>${STATUS_CONFIG[o.status]?.label || o.status}</td>
                      </tr>
                    `,
                      )
                      .join("")}
                  </tbody>
                </table>
              </div>
            `,
              )
              .join('<div style="height: 15px;"></div>')}
          `,
            )
            .join("")}
          ${remainingGenders
            .map(
              ([gender, genderOrders]: [string, any]) => `
            ${chunkArray(genderOrders, 10)
              .map(
                (chunk, index) => `
              <div class="keep-together" style="margin-top: 15px;">
                ${index === 0 ? `<h3>โรงเรียน: ${school} | เพศ: ${gender} (${genderOrders.length} รายการ)</h3>` : ""}
                <table>
                  <thead>
                    <tr>
                      <th style="width: 5%">ลำดับ</th>
                      <th style="width: 12%">ORDER ID</th>
                      <th style="width: 15%">ชื่อ-นามสกุล</th>
                      <th style="width: 50%">รายการ</th>
                      <th style="width: 8%">ยอดรวม</th>
                      <th style="width: 10%">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${chunk.items
                      .map(
                        (o: any, i: number) => `
                      <tr>
                        <td>${chunk.startIndex + i + 1}</td>
                        <td>${o.id.slice(0, 8).toUpperCase()}</td>
                        <td>${o.fullName} ${(o.gender === 'ชาย' || o.gender === 'ช' || o.gender?.toLowerCase() === 'male' || o.gender?.toLowerCase() === 'm') ? '(ช)' : (o.gender === 'หญิง' || o.gender === 'ญ' || o.gender?.toLowerCase() === 'female' || o.gender?.toLowerCase() === 'f') ? '(ญ)' : ''}</td>
                        <td><div>${sortOrderItemsBySize(getFilteredItems(o.items)).map((item: any) => `${item.name} (${formatItemSize(item.name, item.size)}) x ${item.quantity}`).join("</div><div>")}</div></td>
                        <td>${formatPrice(getOrderAmount(o))}</td>
                        <td>${STATUS_CONFIG[o.status]?.label || o.status}</td>
                      </tr>
                    `,
                      )
                      .join("")}
                  </tbody>
                </table>
              </div>
            `,
              )
              .join('<div style="height: 15px;"></div>')}
          `,
            )
            .join("")}
        </div>
      `;
          })
          .join("");
      }
      
      const grandTotalCount = filteredOrders.length;
      
      content += `
        <div style="margin-top: 30px; padding: 15px 20px; background-color: #1a2f23 !important; border-radius: 8px; font-weight: bold; font-size: 16px; color: white !important; display: flex; justify-content: space-between; align-items: center; box-shadow: inset 0 0 0 1000px #1a2f23; page-break-inside: avoid;">
          <span>สรุปยอดรวมทั้งหมด</span>
          <div style="text-align: right;">
            ${type === "product" 
              ? `<span style="display: block; font-size: 16px; color: #bdfa89;">จำนวนสินค้าทั้งหมด: ${totalProductQuantity} ชิ้น</span>` 
              : `<span style="display: block; font-size: 14px; margin-bottom: 4px;">จำนวนสั่งซื้อทั้งหมด: ${grandTotalCount} รายการ</span>`
            }
          </div>
        </div>
      `;

      const html = `
      <html>
        <head>
          <title>รายงานการสั่งซื้อ - ${dateStr}</title>
          
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap');
            body { 
              font-family: 'Sarabun', sans-serif; 
              padding: 20px; 
              color: #1a2f23; 
              background-color: white !important; 
              -webkit-print-color-adjust: exact !important; 
              print-color-adjust: exact !important; 
            }
            #pdf-content { background-color: white !important; min-height: 100%; height: auto; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 3px double #1a2f23; padding-bottom: 15px; }
            .header h1 { margin: 0 0 8px 0; font-size: 26px; font-weight: bold; color: #1a2f23; }
            .header p { margin: 0; font-size: 14px; font-weight: bold; color: #4a5d52; }
            
            .report-section { margin-bottom: 45px; }
            
            .keep-together {
              page-break-inside: auto !important;
              break-inside: auto !important;
            }
            
            h2 { 
              font-size: 18px; 
              background: #1a2f23 !important; 
              color: white !important; 
              padding: 10px 15px; 
              margin: 25px 0 15px 0; 
              border-radius: 4px;
              font-weight: bold;
              display: block;
              page-break-after: avoid; 
              box-shadow: inset 0 0 0 1000px #1a2f23;
            }
            
            .gender-section { 
              margin-top: 25px; 
              page-break-inside: avoid; 
              page-break-after: auto;
            }
            
            h3 { 
              font-size: 15px; 
              color: #1a2f23; 
              border-bottom: 2px solid #1a2f23; 
              padding-bottom: 6px; 
              margin: 15px 0 10px 0; 
              font-weight: bold;
              page-break-after: avoid; 
            }
            
            table { 
              width: 100%; 
              max-width: 100%;
              table-layout: fixed;
              border-collapse: collapse; 
              margin-top: 10px; 
              font-size: 11px; 
              line-height: 1.5;
              page-break-inside: auto; 
            }
            tr { 
              page-break-inside: avoid; 
              page-break-after: auto; 
            }
            thead { 
              display: table-header-group; 
              page-break-inside: avoid; 
            }
            th, td { 
              border: 1px solid #ccd6d0; 
              padding: 10px 8px; 
              text-align: left; 
              vertical-align: top; 
            }
            th { 
              background: #f1f5f3 !important; 
              font-weight: bold; 
              color: #1a2f23;
              box-shadow: inset 0 0 0 1000px #f1f5f3;
            }
            tr:nth-child(even) { 
              background: #fbfcfc; 
            }
            td div {
              line-height: 1.6;
            }
            
            @media print {
              @page { margin: 12mm; }
              body { padding: 0; margin: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div id="pdf-content">
            <div class="header">
              <h1>รายงานสรุปข้อมูลการสั่งซื้อ</h1>
              <p>ชมรมผู้กำกับนักศึกษาวิชาทหาร มทบ.45 | วันที่พิมพ์: ${dateStr}</p>
            </div>
            ${content}
          </div>
          <script>
            
            const printCurrent = () => {
              if ('${currentAction}' === 'pdf' || '${currentAction}' === 'pdf_not_ordered') {
                document.title = 'order_report_${dateStr}';
                setTimeout(() => window.print(), 500);
              } else {
                window.print();
              }
            };
            if (document.fonts) {
              document.fonts.ready.then(() => { setTimeout(printCurrent, 500); });
            } else {
              setTimeout(printCurrent, 500);
            }

          </script>
        </body>
      </html>
    `;

      printWindow.document.write(html);
      printWindow.document.close();
    };

    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
        <div>
          <h2 className="text-4xl font-black text-army-dark uppercase tracking-tighter mb-2">
            พิมพ์ใบสั่งซื้อ
          </h2>
          <p className="text-army-muted font-bold uppercase tracking-widest text-sm">
            เลือกรูปแบบการพิมพ์รายงานสรุปข้อมูลการสั่งซื้อ
          </p>
        </div>

        {!selectedType ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button
              onClick={() => setSelectedType("center")}
              className="bg-white p-8 rounded-3xl border-2 border-army-dark shadow-xl hover:bg-army-dark hover:text-white transition-all group text-left space-y-4"
            >
              <div className="w-16 h-16 bg-army-bg text-army-dark rounded-2xl flex items-center justify-center group-hover:bg-white/10 group-hover:text-white transition-all">
                <Building2 size={32} />
              </div>
              <div>
                <h3 className="text-xl font-black uppercase tracking-tighter">
                  แยกตามศูนย์ฝึก
                </h3>
                <p className="text-sm font-bold opacity-60">
                  พิมพ์ข้อมูลการสั่งซื้อสรุปตามหน่วยฝึก/ศูนย์ฝึก
                </p>
              </div>
            </button>

            <button
              onClick={() => setSelectedType("school")}
              className="bg-white p-8 rounded-3xl border-2 border-army-dark shadow-xl hover:bg-army-dark hover:text-white transition-all group text-left space-y-4"
            >
              <div className="w-16 h-16 bg-army-bg text-army-dark rounded-2xl flex items-center justify-center group-hover:bg-white/10 group-hover:text-white transition-all">
                <School size={32} />
              </div>
              <div>
                <h3 className="text-xl font-black uppercase tracking-tighter">
                  แยกตามโรงเรียน
                </h3>
                <p className="text-sm font-bold opacity-60">
                  พิมพ์ข้อมูลการสั่งซื้อสรุปตามสถานศึกษา
                </p>
              </div>
            </button>

            <button
              onClick={() => setSelectedType("product")}
              className="bg-white p-8 rounded-3xl border-2 border-army-dark shadow-xl hover:bg-army-dark hover:text-white transition-all group text-left space-y-4"
            >
              <div className="w-16 h-16 bg-army-bg text-army-dark rounded-2xl flex items-center justify-center group-hover:bg-white/10 group-hover:text-white transition-all">
                <Package size={32} />
              </div>
              <div>
                <h3 className="text-xl font-black uppercase tracking-tighter">
                  แยกตามรายการสินค้า
                </h3>
                <p className="text-sm font-bold opacity-60">
                  พิมพ์สรุปจำนวนสินค้าที่ต้องจัดเตรียมทั้งหมด
                </p>
              </div>
            </button>

            <button
              onClick={() => setSelectedType("individual")}
              className="bg-white p-8 rounded-3xl border-2 border-army-dark shadow-xl hover:bg-army-dark hover:text-white transition-all group text-left space-y-4"
            >
              <div className="w-16 h-16 bg-army-bg text-army-dark rounded-2xl flex items-center justify-center group-hover:bg-white/10 group-hover:text-white transition-all">
                <Users size={32} />
              </div>
              <div>
                <h3 className="text-xl font-black uppercase tracking-tighter">
                  แยกตามรายการคำสั่งซื้อ
                </h3>
                <p className="text-sm font-bold opacity-60">
                  พิมพ์รายละเอียดการสั่งซื้อรายบุคคลทั้งหมด
                </p>
              </div>
            </button>

            <button
              onClick={() => setSelectedType("year")}
              className="bg-white p-8 rounded-3xl border-2 border-army-dark shadow-xl hover:bg-army-dark hover:text-white transition-all group text-left space-y-4"
            >
              <div className="w-16 h-16 bg-army-bg text-army-dark rounded-2xl flex items-center justify-center group-hover:bg-white/10 group-hover:text-white transition-all">
                <Calendar size={32} />
              </div>
              <div>
                <h3 className="text-xl font-black uppercase tracking-tighter">
                  แยกตามชั้นปี
                </h3>
                <p className="text-sm font-bold opacity-60">
                  พิมพ์ข้อมูลการสั่งซื้อสรุปตามชั้นปี
                </p>
              </div>
            </button>

            <button
              onClick={() => setSelectedType("gender")}
              className="bg-white p-8 rounded-3xl border-2 border-army-dark shadow-xl hover:bg-army-dark hover:text-white transition-all group text-left space-y-4"
            >
              <div className="w-16 h-16 bg-army-bg text-army-dark rounded-2xl flex items-center justify-center group-hover:bg-white/10 group-hover:text-white transition-all">
                <UserCircle size={32} />
              </div>
              <div>
                <h3 className="text-xl font-black uppercase tracking-tighter">
                  แยกตามเพศ
                </h3>
                <p className="text-sm font-bold opacity-60">
                  พิมพ์ข้อมูลการสั่งซื้อแยกชาย-หญิง
                </p>
              </div>
            </button>

            <button
              onClick={() => setSelectedType("alphabetical")}
              className="bg-white p-8 rounded-3xl border-2 border-army-dark shadow-xl hover:bg-army-dark hover:text-white transition-all group text-left space-y-4"
            >
              <div className="w-16 h-16 bg-army-bg text-army-dark rounded-2xl flex items-center justify-center group-hover:bg-white/10 group-hover:text-white transition-all">
                <SortAsc size={32} />
              </div>
              <div>
                <h3 className="text-xl font-black uppercase tracking-tighter">
                  เรียงตามตัวอักษร
                </h3>
                <p className="text-sm font-bold opacity-60">
                  พิมพ์ข้อมูลการสั่งซื้อเรียงตามชื่อ-นามสกุล
                </p>
              </div>
            </button>
          </div>
        ) : (
          <div className="bg-white p-8 rounded-3xl border-2 border-army-dark shadow-xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <button
                onClick={() => {
                  setSelectedType(null);
                  setSelectedItems(new Set());
                  setSearchQuery("");
                  setOrderedFilter("all");
                  setEmbroideredFilter("all");
                }}
                className="flex items-center space-x-2 text-army-muted hover:text-army-dark font-black uppercase tracking-widest text-xs"
              >
                <ArrowLeft size={16} />
                <span>กลับไปเลือกรูปแบบ</span>
              </button>
              <div className="flex flex-wrap gap-3 items-center">
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-army-muted"
                    size={16}
                  />
                  <input
                    type="text"
                    placeholder="ค้นหา..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2 bg-army-bg border-2 border-army-bg focus:border-army-dark rounded-xl text-sm font-bold outline-none transition-all w-64"
                  />
                </div>
                <button
                  onClick={selectAll}
                  className="px-4 py-2 bg-army-bg text-army-dark rounded-xl font-black uppercase tracking-widest text-xs hover:bg-army-light transition-all text-center whitespace-nowrap"
                >
                  เลือกทั้งหมด
                </button>
                <button
                  onClick={() => handleBulkMarkOrderedStatus(selectedItems, true)}
                  disabled={selectedItems.size === 0}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black uppercase tracking-widest text-xs transition-all disabled:opacity-50 flex items-center space-x-1.5 whitespace-nowrap"
                  title="ทำเครื่องหมายว่า สั่งซื้อแล้ว แก่กลุ่มรายชื่อที่เลือกทั้งหมด"
                >
                  <Check size={14} />
                  <span>ตั้ง "สั่งซื้อแล้ว" ({selectedItems.size})</span>
                </button>
                <button
                  onClick={() => handleBulkMarkOrderedStatus(selectedItems, false)}
                  disabled={selectedItems.size === 0}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-750 text-white rounded-xl font-black uppercase tracking-widest text-xs transition-all disabled:opacity-50 flex items-center space-x-1.5 whitespace-nowrap"
                  title="ทำเครื่องหมายว่า ยังไม่สั่งซื้อ แก่กลุ่มรายชื่อที่เลือกทั้งหมด"
                >
                  <X size={14} />
                  <span>ตั้ง "ยังไม่สั่งซื้อ" ({selectedItems.size})</span>
                </button>
                <button
                  onClick={() => handlePrint(selectedType, selectedItems)}
                  disabled={selectedItems.size === 0}
                  className="px-6 py-2 bg-army-dark text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-army-primary transition-all disabled:opacity-50 flex items-center space-x-2 whitespace-nowrap"
                >
                  <Printer size={16} />
                  <span>พิมพ์ที่เลือก ({selectedItems.size})</span>
                </button>
                <button
                  onClick={() =>
                    handlePrint(selectedType, selectedItems, "pdf")
                  }
                  disabled={selectedItems.size === 0}
                  className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center space-x-2 whitespace-nowrap"
                >
                  <Download size={16} />
                  <span>บันทึก PDF</span>
                </button>
                <button
                  onClick={() =>
                    handlePrint(selectedType, selectedItems, "pdf_not_ordered")
                  }
                  disabled={selectedItems.size === 0}
                  className="px-6 py-2 bg-sky-600 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-sky-700 transition-all disabled:opacity-50 flex items-center space-x-2 whitespace-nowrap"
                >
                  <Download size={16} />
                  <span>เฉพาะยังไม่สั่งซื้อ</span>
                </button>
              </div>
            </div>

            {/* Filter controls row */}
            <div className="flex flex-wrap items-center gap-6 bg-army-bg/30 p-4 rounded-2xl border-2 border-army-bg">
              <span className="text-[10px] font-black uppercase tracking-wider text-army-muted shrink-0">
                ตัวกรองข้อมูลสถานะ:
              </span>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-army-dark whitespace-nowrap">สั่งซื้อ:</span>
                <select
                  value={orderedFilter}
                  onChange={(e) => setOrderedFilter(e.target.value as any)}
                  className="px-3 py-1.5 bg-white border border-army-light rounded-xl text-xs font-extrabold outline-none focus:border-army-dark transition-all cursor-pointer"
                >
                  <option value="all">ทั้งหมด</option>
                  <option value="not_ordered">ยังไม่ได้สั่งซื้อ</option>
                  <option value="ordered">สั่งซื้อแล้ว</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto p-2">
              {getAvailableItems().map((item) => {
                const id = typeof item === "string" ? item : item.id;
                const label = typeof item === "string" ? item : item.label;
                const isSelected = selectedItems.has(id);
                const isOrdered = typeof item !== "string" && !!item.isOrdered;
                const isEmbroidered = typeof item !== "string" && !!item.isEmbroidered;

                return (
                  <button
                    key={id}
                    onClick={() => toggleItem(id)}
                    className={cn(
                      "flex items-start space-x-3 p-4 rounded-2xl border-2 transition-all text-left h-full relative",
                      isSelected
                        ? "bg-army-dark border-army-dark text-white shadow-lg"
                        : "bg-army-bg border-army-bg text-army-dark hover:border-army-light",
                    )}
                  >
                    <div
                      className={cn(
                        "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 mt-0.5",
                        isSelected
                          ? "bg-white border-white text-army-dark"
                          : "bg-white border-army-light",
                      )}
                    >
                      {isSelected && <CheckCircle2 size={14} />}
                    </div>
                    <div className="flex flex-col h-full justify-between items-start w-full pr-6">
                      <span className={cn(
                        "font-bold text-sm leading-tight break-words mb-2",
                        isSelected ? "text-white" : "text-army-dark"
                      )}>
                        {label}
                      </span>
                      <div className="flex flex-wrap gap-1.5 mt-auto">
                        <span className={cn(
                          "px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider",
                          isOrdered 
                            ? (isSelected ? "bg-white/10 text-emerald-300" : "bg-emerald-100 text-emerald-800")
                            : (isSelected ? "bg-white/10 text-amber-300" : "bg-amber-100 text-amber-800")
                        )}>
                          {isOrdered ? "สั่งซื้อแล้ว" : "ยังไม่สั่งซื้อ"}
                        </span>
                      </div>
                    </div>
                     {isOrdered ? (
                      <div 
                        className={cn(
                          "absolute top-2 right-2 group/badge p-1 rounded-full shadow-sm transition-colors z-10",
                          isSelected 
                            ? "text-emerald-300 bg-white/10 hover:bg-white/20 hover:text-red-300" 
                            : "text-emerald-500 bg-emerald-100 hover:bg-red-100 hover:text-red-600"
                        )}
                        title="สั่งซื้อแล้ว (คลิกเพื่อยกเลิก)"
                        onClick={(e) => handleSetItemOrderedStatus(id, false, e)}
                      >
                        {isUndoing === id ? (
                          <Loader2 size={14} className="animate-spin text-red-500" />
                        ) : (
                          <>
                            <Check size={14} className="group-hover/badge:hidden" />
                            <X size={14} className="hidden group-hover/badge:block" />
                          </>
                        )}
                      </div>
                    ) : (
                      <div 
                        className={cn(
                          "absolute top-2 right-2 group/badge p-1 rounded-full shadow-sm transition-colors z-10",
                          isSelected 
                            ? "text-amber-300/60 bg-white/5 hover:bg-white/10 hover:text-white" 
                            : "text-gray-400 bg-gray-100 hover:bg-emerald-100 hover:text-emerald-600"
                        )}
                        title="ยังไม่ได้สั่งซื้อ (คลิกเพื่อตั้งว่าสั่งซื้อแล้ว)"
                        onClick={(e) => handleSetItemOrderedStatus(id, true, e)}
                      >
                        {isUndoing === id ? (
                          <Loader2 size={14} className="animate-spin text-emerald-500" />
                        ) : (
                          <ShoppingCart size={14} />
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }, []);

  const EmbroideryManagement = useMemo(() => ({
    orders,
    onRefresh,
    isRefreshing,
  }: {
    orders: Order[];
    onRefresh?: () => void;
    isRefreshing?: boolean;
  }) => {
    const [downloading, setDownloading] = useState(false);
    const [downloadingNot, setDownloadingNot] = useState(false);
    const [togglingId, setTogglingId] = useState<string | null>(null);

    const handleToggleEmbroidered = async (order: Order) => {
      setTogglingId(order.id);
      const newValue = !order.isEmbroidered;
      
      const matchingOrders = order.fullName
        ? orders.filter(o => o.fullName === order.fullName)
        : [order];
      const matchingIds = new Set(matchingOrders.map(o => o.id));

      // Optimistic Update and localStorage save
      const updatedOrdersObj = orders.map((o) => (matchingIds.has(o.id) ? { ...o, isEmbroidered: newValue } : o));
      setOrders(updatedOrdersObj);
      try {
        localStorage.setItem("admin_orders_cache", JSON.stringify(updatedOrdersObj));
      } catch (e) {}

      // Track recent local updates to prevent polling/staleness reversion
      // @ts-ignore
      if (!window._recentEmbroideredUpdates) {
        // @ts-ignore
        window._recentEmbroideredUpdates = {};
      }
      matchingOrders.forEach(o => {
        // @ts-ignore
        window._recentEmbroideredUpdates[o.id] = { value: newValue, timestamp: Date.now() };
      });

      try {
        // @ts-ignore
        window._isSyncPaused = true;
        for (const o of matchingOrders) {
          const payloadToSync: any = { ...o, isEmbroidered: newValue };
          if (!payloadToSync.items || payloadToSync.items.length === 0) {
            payloadToSync.items = payloadToSync._rawItems;
          }
          delete payloadToSync._rawItems;
          try {
            await setDoc(doc(db,  "orders",  o.id), { isEmbroidered: newValue }, { merge: true });
          } catch (dbErr) {
            console.warn("Firestore setDoc error:", dbErr);
            try { handleFirestoreError(dbErr, OperationType.UPDATE, `orders/${o.id}`); } catch (e) {}
          }
          await googleSheetService.syncRecord("Orders", payloadToSync);
        }
      } catch (err) {
        console.error(err);
        alert("เกิดข้อผิดพลาดในการอัปเดตสถานะ");
        // Revert on error
        const revertedOrdersObj = orders.map((o) => (matchingIds.has(o.id) ? { ...o, isEmbroidered: !newValue } : o));
        setOrders(revertedOrdersObj);
        try {
          localStorage.setItem("admin_orders_cache", JSON.stringify(revertedOrdersObj));
        } catch (e) {}

        // @ts-ignore
        if (window._recentEmbroideredUpdates) {
          matchingIds.forEach(id => {
            // @ts-ignore
            delete window._recentEmbroideredUpdates[id];
          });
        }
      } finally {
        // @ts-ignore
        window._isSyncPaused = false;
        setTogglingId(null);
      }
    };

    const handleMarkAllGroupEmbroidered = async (ordersToMark: Order[]) => {
      const pending = ordersToMark.filter(o => !o.isEmbroidered);
      if (pending.length === 0) {
        setConfirmModal({
          title: "ยืนยันการยกเลิก",
          message: `ยืนยันการยกเลิกสถานะ "ปักแล้ว" สำหรับทั้งกลุ่มหรือไม่?`,
          onConfirm: async () => {
            const updatedIds = new Set(ordersToMark.map(o => o.id));
            const updatedOrdersObj = orders.map((ord) => (updatedIds.has(ord.id) ? { ...ord, isEmbroidered: false } : ord));
            setOrders(updatedOrdersObj);
            try {
              localStorage.setItem("admin_orders_cache", JSON.stringify(updatedOrdersObj));
            } catch (e) {}
            
            // Track recent local updates to prevent polling/staleness reversion
            // @ts-ignore
            if (!window._recentEmbroideredUpdates) {
              // @ts-ignore
              window._recentEmbroideredUpdates = {};
            }
            ordersToMark.forEach(o => {
              // @ts-ignore
              window._recentEmbroideredUpdates[o.id] = { value: false, timestamp: Date.now() };
            });

            // @ts-ignore
            window._isSyncPaused = true;
            try {
              const payloadsToSync = [];
              for (const o of ordersToMark) {
                const payloadToSync: any = { ...o, isEmbroidered: false };
                if (!payloadToSync.items || payloadToSync.items.length === 0) {
                  payloadToSync.items = payloadToSync._rawItems;
                }
                delete payloadToSync._rawItems;
                payloadsToSync.push(payloadToSync);

                try {
                  await setDoc(doc(db, "orders", o.id), { isEmbroidered: false }, { merge: true });
                } catch (dbErr) {
                  console.warn("Firestore setDoc error:", dbErr);
                  try { handleFirestoreError(dbErr, OperationType.UPDATE, `orders/${o.id}`); } catch (e) {}
                }
              }

              // Fast batch atomic operation writes all in 1 connection
              await googleSheetService.syncRecords("Orders", payloadsToSync);
            } catch (err) {
              console.error(err);
              alert("เกิดข้อผิดพลาดในการยกเลิกสถานะบางรายการ");
            } finally {
              // @ts-ignore
              window._isSyncPaused = false;
            }
          }
        });
        return;
      }
      
      setConfirmModal({
        title: "ยืนยันการทำเครื่องหมาย",
        message: `ยืนยันการทำเครื่องหมายว่า "ปักแล้ว" สำหรับ ${pending.length} รายการหรือไม่?`,
        onConfirm: async () => {
          const updatedIds = new Set(pending.map(o => o.id));
          const updatedOrdersObj = orders.map((ord) => (updatedIds.has(ord.id) ? { ...ord, isEmbroidered: true } : ord));
          setOrders(updatedOrdersObj);
          try {
            localStorage.setItem("admin_orders_cache", JSON.stringify(updatedOrdersObj));
          } catch (e) {}

          // Track recent local updates to prevent polling/staleness reversion
          // @ts-ignore
          if (!window._recentEmbroideredUpdates) {
            // @ts-ignore
            window._recentEmbroideredUpdates = {};
          }
          pending.forEach(o => {
            // @ts-ignore
            window._recentEmbroideredUpdates[o.id] = { value: true, timestamp: Date.now() };
          });
          
          // @ts-ignore
          window._isSyncPaused = true;
          try {
            const payloadsToSync = [];
            for (const o of pending) {
              const payloadToSync: any = { ...o, isEmbroidered: true };
              if (!payloadToSync.items || payloadToSync.items.length === 0) {
                payloadToSync.items = payloadToSync._rawItems;
              }
              delete payloadToSync._rawItems;
              payloadsToSync.push(payloadToSync);

              try {
                await setDoc(doc(db, "orders", o.id), { isEmbroidered: true }, { merge: true });
              } catch (dbErr) {
                console.warn("Firestore setDoc error:", dbErr);
                try { handleFirestoreError(dbErr, OperationType.UPDATE, `orders/${o.id}`); } catch (e) {}
              }
            }

            // Fast batch atomic operation writes all in 1 connection
            await googleSheetService.syncRecords("Orders", payloadsToSync);
          } catch (err) {
            console.error(err);
            alert("เกิดข้อผิดพลาดในการอัปเดตสถานะบางรายการ");
          } finally {
            // @ts-ignore
            window._isSyncPaused = false;
          }
        }
      });
    };

    // Group and sort logic
    const validOrders = useMemo(() => {
      return orders.filter((o) => o.status !== "cancelled");
    }, [orders]);

    const getFishboneQuantity = (order: Order) => {
      if (!order.items || !Array.isArray(order.items)) return 0;
      return order.items
        .filter(
          (item) =>
            item.productId === "prod-1" ||
            (item.name && item.name.includes("ก้างปลา")),
        )
        .reduce((sum, item) => sum + item.quantity, 0);
    };

    const groupedAndSortedData = useMemo(() => {
      const groups: Record<string, { orders: Order[]; totalPacks: number }> =
        {};

      validOrders.forEach((order) => {
        const q = getFishboneQuantity(order);
        // We only include people who have ordered the fishbone tracksuit for embroidery
        if (q > 0) {
          const schoolName = order.school || "ไม่ระบุโรงเรียน";
          if (!groups[schoolName]) {
            groups[schoolName] = { orders: [], totalPacks: 0 };
          }
          groups[schoolName].orders.push(order);
          groups[schoolName].totalPacks += q;
        }
      });

      // Sort schools alphabetically
      const sortedSchoolNames = Object.keys(groups).sort((a, b) =>
        a.localeCompare(b, "th"),
      );

      // Sort students inside each school alphabetically
      const result: {
        schoolName: string;
        orders: Order[];
        totalPacks: number;
      }[] = [];
      sortedSchoolNames.forEach((schoolName) => {
        const sortedOrders = [...groups[schoolName].orders].sort((a, b) =>
          a.fullName.localeCompare(b.fullName, "th"),
        );
        result.push({
          schoolName,
          orders: sortedOrders,
          totalPacks: groups[schoolName].totalPacks,
        });
      });

      return result;
    }, [validOrders]);

    const totalEmbroideryCount = useMemo(() => {
      return groupedAndSortedData.reduce(
        (sum, item) => sum + item.totalPacks,
        0,
      );
    }, [groupedAndSortedData]);

    const handleDownloadPDF = async (onlyNotEmbroidered: boolean = false) => {
      const filteredGroups = groupedAndSortedData.map(group => ({
        schoolName: group.schoolName,
        orders: onlyNotEmbroidered ? group.orders.filter(o => !o.isEmbroidered) : group.orders,
      })).filter(g => g.orders.length > 0);
      
      if (filteredGroups.length === 0 && onlyNotEmbroidered) {
        alert("ไม่มีรายการที่ยังไม่ปัก");
        return;
      }
      
      const allDownloadedOrders = filteredGroups.flatMap(g => g.orders);
      const unembroideredOrders = allDownloadedOrders.filter(o => !o.isEmbroidered);
      
      const executeDownload = (shouldMarkEmbroidered: boolean) => {
        if (onlyNotEmbroidered) {
          setDownloadingNot(true);
        } else {
          setDownloading(true);
        }
        
      // Removed limitation to allow single full download
      const isLargeDoc = false;

      let printWindow: Window | null = null;
      let iframeId = `pdf-iframe-${Date.now()}`;

      printWindow = window.open("", "_blank");

      if (!printWindow) {
        if (onlyNotEmbroidered) setDownloadingNot(false);
        else setDownloading(false);
        return;
      }

      const dateStr = new Date().toLocaleDateString("th-TH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      let tableContentHtml = "";
      
      let grandTotalPacks = 0;
      const totalSchools = filteredGroups.length;

      filteredGroups.forEach((group, groupIdx) => {
        let totalPacks = group.orders.reduce((sum, o) => sum + getFishboneQuantity(o), 0);
        grandTotalPacks += totalPacks;
        
        const MAX_ROWS = 32;
        const chunks = [];
        for (let i = 0; i < group.orders.length; i += MAX_ROWS) {
          chunks.push(group.orders.slice(i, i + MAX_ROWS));
        }

        chunks.forEach((chunk, chunkIndex) => {
          const isMultiple = chunks.length > 1;
          const isLast = chunkIndex === chunks.length - 1;
          const pageIndicator = isMultiple ? ` (หน้า ${chunkIndex + 1}/${chunks.length})` : "";
          
          tableContentHtml += `
          <div class="school-page" style="page-break-inside: avoid; margin-bottom: 40px; padding-bottom: 30px; border-bottom: ${isLast ? '1px dashed #cad4cf' : 'none'};">
            <div class="header">
              <h1 style="font-size: 20px; font-weight: bold; margin-bottom: 5px;">รายชื่อผู้สั่งซื้อชุดก้างปลาสำหรับปักเครื่องหมาย${pageIndicator}</h1>
              <p style="font-size: 14px; font-weight: bold; color: #4a5d52; margin: 0 0 5px 0;">โรงเรียน: ${group.schoolName}</p>
              <p style="margin: 5px 0 0 0; font-size: 11px; color: #4a5d52;">ชมรมผู้กำกับนักศึกษาวิชาทหาร มทบ.45 | ข้อมูลออก ณ วันที่ ${dateStr}</p>
            </div>
            
            <table style="width: 100%; table-layout: fixed; border-collapse: collapse; margin-top: 15px; font-size: 11px;">
              <thead>
                <tr>
                  <th style="width: 8%; border: 1px solid #1a2f23; background-color: #1a2f23 !important; color: white !important; font-weight: bold; padding: 6px 4px; font-size: 11px; text-align: center; box-shadow: inset 0 0 0 1000px #1a2f23;">ลำดับ</th>
                  <th style="width: 35%; border: 1px solid #1a2f23; background-color: #1a2f23 !important; color: white !important; font-weight: bold; padding: 6px 10px; font-size: 11px; text-align: left; box-shadow: inset 0 0 0 1000px #1a2f23;">ชื่อ-นามสกุล</th>
                  <th style="width: 10%; border: 1px solid #1a2f23; background-color: #1a2f23 !important; color: white !important; font-weight: bold; padding: 6px 4px; font-size: 11px; text-align: center; box-shadow: inset 0 0 0 1000px #1a2f23;">ชั้นปี</th>
                  <th style="width: 10%; border: 1px solid #1a2f23; background-color: #1a2f23 !important; color: white !important; font-weight: bold; padding: 6px 4px; font-size: 11px; text-align: center; box-shadow: inset 0 0 0 1000px #1a2f23;">เพศ</th>
                  <th style="width: 20%; border: 1px solid #1a2f23; background-color: #1a2f23 !important; color: white !important; font-weight: bold; padding: 6px 4px; font-size: 11px; text-align: center; box-shadow: inset 0 0 0 1000px #1a2f23;">เบอร์โทร</th>
                  <th style="width: 17%; border: 1px solid #1a2f23; background-color: #1a2f23 !important; color: white !important; font-weight: bold; padding: 6px 4px; font-size: 11px; text-align: center; box-shadow: inset 0 0 0 1000px #1a2f23;">จำนวนที่สั่งปัก (ชุด)</th>
                </tr>
              </thead>
              <tbody>
                ${chunk
                  .map(
                    (o, idx) => {
                      const absoluteIdx = (chunkIndex * MAX_ROWS) + idx + 1;
                      return `
                  <tr style="background-color: ${idx % 2 === 1 ? "#f8faf9" : "white"}; page-break-inside: avoid;">
                    <td style="border: 1px solid #cad4cf; padding: 6px 4px; text-align: center;">${absoluteIdx}</td>
                    <td style="border: 1px solid #cad4cf; padding: 6px 10px; font-weight: bold; font-size: 12px; text-align: left;">${o.fullName} ${(o.gender === 'ชาย' || o.gender === 'ช' || o.gender?.toLowerCase() === 'male' || o.gender?.toLowerCase() === 'm') ? '(ช)' : (o.gender === 'หญิง' || o.gender === 'ญ' || o.gender?.toLowerCase() === 'female' || o.gender?.toLowerCase() === 'f') ? '(ญ)' : ''}</td>
                    <td style="border: 1px solid #cad4cf; padding: 6px 4px; text-align: center;">${o.year || "-"}</td>
                    <td style="border: 1px solid #cad4cf; padding: 6px 4px; text-align: center;">${o.gender || "-"}</td>
                    <td style="border: 1px solid #cad4cf; padding: 6px 4px; text-align: center;">${o.phone || "-"}</td>
                    <td style="border: 1px solid #cad4cf; padding: 6px 4px; text-align: center; font-weight: bold; font-size: 12px; color: #1a2f23;">${getFishboneQuantity(o)}</td>
                  </tr>
                `;
                    }
                  )
                  .join("")}
              </tbody>
            </table>
            
            ${isLast ? `
            <div style="margin-top: 15px; padding: 10px; background-color: #e1e8e4 !important; border-radius: 6px; border: 1px solid #1a2f23; font-weight: bold; font-size: 12px; color: #1a2f23; display: flex; justify-content: space-between; align-items: center; box-shadow: inset 0 0 0 1000px #e1e8e4; page-break-inside: avoid;">
              <span>สรุปชุดฝึกโรงเรียน ${group.schoolName}</span>
              <span>มีผู้สั่งปักรวมทั้งสิ้น: ${totalPacks} ชุด</span>
            </div>
            ` : ''}
          </div>
          `;
        });
      });

      if (filteredGroups.length === 0) {
        tableContentHtml = `
        <div style="text-align: center; padding: 50px; font-size: 14px; font-weight: bold; color: #4a5d52;">
          ไม่มีรายชื่อที่สั่งซื้อชุดก้างปลาในระบบ
        </div>
      `;
      } else {
        tableContentHtml += `
        <div style="margin-top: 30px; padding: 15px 20px; background-color: #1a2f23 !important; border-radius: 8px; font-weight: bold; font-size: 14px; color: white !important; display: flex; justify-content: space-between; align-items: center; box-shadow: inset 0 0 0 1000px #1a2f23; page-break-inside: avoid;">
          <span>ยอดรวมปักชุดก้างปลาทั้งหมด (${totalSchools} โรงเรียน)</span>
          <span style="font-size: 16px;">มีผู้สั่งปักรวมทั้งสิ้น: ${grandTotalPacks} ชุด</span>
        </div>
        `;
      }

      const html = `
      <html>
        <head>
          <title>รายชื่อปักชุดก้างปลา - ${dateStr}</title>
          
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700;800&display=swap');
            body { 
              font-family: 'Sarabun', sans-serif; 
              padding: 15px; 
              color: #1a2f23; 
              background-color: white !important; 
              -webkit-print-color-adjust: exact !important; 
              print-color-adjust: exact !important; 
            }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px dashed #1a2f23; padding-bottom: 12px; page-break-inside: avoid; }
            .school-page {
              margin-bottom: 30px;
            }
            @media print { 
              body { padding: 0; background: white; } 
            }
          </style>
        </head>
        <body>
          <div id="pdf-content">
            ${tableContentHtml}
          </div>
          <script>
            
            const p = () => { setTimeout(() => window.print(), 500); };
            if (document.fonts) {
              document.fonts.ready.then(p);
            } else {
              p();
            }

          </script>
        </body>
      </html>
    `;

      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(async () => {
        if (onlyNotEmbroidered) setDownloadingNot(false);
        else setDownloading(false);
        
        if (shouldMarkEmbroidered && unembroideredOrders.length > 0) {
          try {
            // Find all matching names
            const namesToMark = Array.from(new Set(unembroideredOrders.map(o => o.fullName).filter(Boolean)));
            const allMatchingToMark = orders.filter(
              o => namesToMark.includes(o.fullName) || unembroideredOrders.some(u => u.id === o.id)
            ).filter(o => !o.isEmbroidered);

            const updatedOrderIds = new Set(allMatchingToMark.map(o => o.id));
            
            // Update UI immediately (Optimistic Update)
            const updatedOrdersObj = orders.map((ord) => (updatedOrderIds.has(ord.id) ? { ...ord, isEmbroidered: true } : ord));
            setOrders(updatedOrdersObj);
            try {
              localStorage.setItem("admin_orders_cache", JSON.stringify(updatedOrdersObj));
            } catch (e) {}

            // Track recent local updates to prevent polling/staleness reversion
            // @ts-ignore
            if (!window._recentEmbroideredUpdates) {
              // @ts-ignore
              window._recentEmbroideredUpdates = {};
            }
            allMatchingToMark.forEach(o => {
              // @ts-ignore
              window._recentEmbroideredUpdates[o.id] = { value: true, timestamp: Date.now() };
            });

            // @ts-ignore
            window._isSyncPaused = true;
            
            (async () => {
              try {
                const payloadsToSync = [];
                for (const o of allMatchingToMark) {
                  const payloadToSync: any = { ...o, isEmbroidered: true };
                  if (!payloadToSync.items || payloadToSync.items.length === 0) {
                    payloadToSync.items = payloadToSync._rawItems;
                  }
                  delete payloadToSync._rawItems;
                  payloadsToSync.push(payloadToSync);

                  try {
                    await setDoc(doc(db, "orders", o.id), { isEmbroidered: true }, { merge: true });
                  } catch (dbErr) {
                    console.warn("Firestore setDoc error:", dbErr);
                  }
                }

                // Batch sync with Google Sheets!
                await googleSheetService.syncRecords("Orders", payloadsToSync);
              } catch (e) {
                console.error("Error bulk updating order", e);
              } finally {
                // @ts-ignore
                window._isSyncPaused = false;
              }
            })();
            
          } catch (err) {
            console.error(err);
            alert("เกิดข้อผิดพลาดในการอัปเดตสถานะปัก");
          }
        }
      }, 2000);
    };

    if (unembroideredOrders.length > 0) {
      setConfirmModal({
        title: "ดาวน์โหลดและอัปเดตสถานะอัตโนมัติ",
        message: `คุณต้องการทำเครื่องหมายว่า "ปักแล้ว" ให้กับรายชื่อที่ถูกดาวน์โหลดในครั้งนี้อัตโนมัติเลยหรือไม่?\n\n(มี ${unembroideredOrders.length} รายการที่สถานะยังเป็น "ยังไม่ปัก")`,
        onConfirm: () => {
          executeDownload(true);
        },
        onCancel: () => {
          executeDownload(false);
        }
      });
    } else {
      executeDownload(false);
    }
  };

    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 md:p-10 space-y-8"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-4xl font-black text-army-dark uppercase tracking-tighter mb-2">
              รายชื่อสำหรับปักเครื่องหมาย
            </h2>
            <p className="text-army-muted font-bold uppercase tracking-widest text-sm">
              เรียงรายชื่อผู้สั่งแยกตามโรงเรียนและเรียงตามตัวอักษรสำหรับช่างปัก
            </p>
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap gap-3">
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                className="flex items-center justify-center space-x-3 px-6 py-4 bg-white hover:bg-army-bg disabled:bg-gray-100 text-army-dark border border-army-light rounded-2xl text-sm font-black uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
              >
                <RefreshCw
                  className={cn(
                    "text-army-dark",
                    isRefreshing && "animate-spin",
                  )}
                  size={18}
                />
                <span className="whitespace-nowrap">
                  {isRefreshing ? "กำลังอัปเดต..." : "ดึงข้อมูลล่าสุดพร้อมกัน"}
                </span>
              </button>
            )}
            <button
              onClick={() => handleDownloadPDF(true)}
              disabled={downloadingNot || groupedAndSortedData.length === 0}
              className="flex items-center justify-center space-x-3 px-6 py-4 bg-sky-600 hover:bg-sky-700 disabled:bg-gray-300 text-white rounded-2xl text-sm font-black uppercase tracking-wider shadow-xl shadow-sky-600/20 active:scale-95 transition-all cursor-pointer"
            >
              {downloadingNot ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  <span className="whitespace-nowrap">กำลังสร้างไฟล์ PDF...</span>
                </>
              ) : (
                <>
                  <Download size={18} />
                  <span className="whitespace-nowrap">ดาวน์โหลด PDF (เฉพาะยังไม่ปัก)</span>
                </>
              )}
            </button>
            <button
              onClick={() => handleDownloadPDF(false)}
              disabled={downloading || groupedAndSortedData.length === 0}
              className="flex items-center justify-center space-x-3 px-6 py-4 bg-emerald-700 hover:bg-emerald-800 disabled:bg-gray-300 text-white rounded-2xl text-sm font-black uppercase tracking-wider shadow-xl shadow-emerald-700/20 active:scale-95 transition-all cursor-pointer"
            >
              {downloading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  <span className="whitespace-nowrap">กำลังสร้างไฟล์ PDF...</span>
                </>
              ) : (
                <>
                  <Download size={18} />
                  <span className="whitespace-nowrap">ดาวน์โหลด PDF ทั้งหมด</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[3rem] border-2 border-army-bg shadow-sm space-y-6">
          <div className="flex justify-between items-center bg-army-bg p-6 rounded-2xl border border-army-light">
            <div>
              <span className="text-xs font-black text-army-muted uppercase tracking-widest block">
                สรุปยอดรวมทั้งสิ้น
              </span>
              <span className="text-3xl font-black text-army-dark">
                {groupedAndSortedData.length} โรงเรียน
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs font-black text-army-muted uppercase tracking-widest block font-sans">
                จำนวนสั่งปักทั้งหมด
              </span>
              <span className="text-3xl font-black text-emerald-700">
                {totalEmbroideryCount} ชุด
              </span>
            </div>
          </div>

          {groupedAndSortedData.length === 0 ? (
            <div className="text-center py-20 bg-army-bg/30 rounded-2xl border-2 border-dashed border-army-light">
              <div className="p-4 bg-army-light rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center text-army-dark">
                <Scissors size={28} />
              </div>
              <p className="font-bold text-army-dark">
                ไม่พบข้อมูลผู้สั่งซื้อชุดก้างปลาในระบบขณะนี้
              </p>
              <p className="text-xs text-army-muted">
                เมื่อมีคำสั่งซื้อชุดฝึกผ้าก้างปลา
                จะแสดงรายชื่อปักสำหรับช่างโดยอัตโนมัติ
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {groupedAndSortedData.map((group, idx) => (
                <motion.div
                  key={group.schoolName}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="border-2 border-army-bg rounded-2xl overflow-hidden"
                >
                  <div className="bg-army-dark text-white px-6 py-4 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                    <div className="flex items-center space-x-2">
                      <School size={18} className="text-army-light" />
                      <span className="font-bold text-sm tracking-wide">
                        {group.schoolName}
                      </span>
                    </div>
                    <span className="text-xs px-3 py-1.5 bg-white/10 rounded-full font-bold">
                      รวมปัก {group.totalPacks} ชุด
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-army-bg text-army-dark border-b border-army-light font-bold">
                          <th
                            className="p-4 text-center font-bold animate-pulse"
                            style={{ width: "8%" }}
                          >
                            ลำดับ
                          </th>
                          <th
                            className="p-4 font-bold"
                            style={{ width: "25%" }}
                          >
                            ชื่อ-นามสกุล
                          </th>
                          <th
                            className="p-4 text-center font-bold"
                            style={{ width: "12%" }}
                          >
                            ชั้นปี
                          </th>
                          <th
                            className="p-4 text-center font-bold"
                            style={{ width: "12%" }}
                          >
                            เพศ
                          </th>
                          <th
                            className="p-4 text-center font-bold"
                            style={{ width: "20%" }}
                          >
                            จำนวน (ชุด)
                          </th>
                          <th
                            className="p-4 text-center font-bold text-sky-700 cursor-pointer hover:bg-army-light transition-all rounded-tr-lg"
                            style={{ width: "20%" }}
                            onClick={() => handleMarkAllGroupEmbroidered(group.orders)}
                            title="ทำเครื่องหมายว่าปักแล้วทั้งหมด"
                          >
                            ปักแล้ว (ติ๊กทั้งหมด)
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-army-bg">
                        {group.orders.map((order, orderIdx) => (
                          <tr
                            key={order.id ? `${order.id}-${orderIdx}` : `emb-${orderIdx}`}
                            className="hover:bg-army-bg/35 transition-all"
                          >
                            <td className="p-4 text-center font-medium text-army-muted">
                              {orderIdx + 1}
                            </td>
                            <td className="p-4 font-black text-army-dark">
                              {order.fullName}
                            </td>
                            <td className="p-4 text-center text-army-muted font-bold">
                              {order.year || "-"}
                            </td>
                            <td className="p-4 text-center text-army-muted font-bold">
                              {order.gender || "-"}
                            </td>
                            <td className="p-4 text-center font-black text-emerald-700 text-sm">
                              {getFishboneQuantity(order)}
                            </td>
                            <td className="p-4 text-center">
                              <button
                                onClick={() => handleToggleEmbroidered(order)}
                                disabled={togglingId === order.id}
                                className={cn(
                                  "px-3 py-1.5 rounded-xl font-bold text-xs tracking-wide transition-all duration-200 mx-auto shadow-sm flex items-center justify-center gap-1.5 cursor-pointer",
                                  order.isEmbroidered 
                                    ? "bg-sky-500 text-white shadow-sky-500/20 hover:bg-sky-600 border border-sky-600" 
                                    : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200",
                                  togglingId === order.id && "opacity-60 cursor-wait"
                                )}
                              >
                                {togglingId === order.id ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : order.isEmbroidered ? (
                                  <>
                                    <Check size={14} />
                                    <span>ปักแล้ว</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                    <span>ยังไม่ปัก</span>
                                  </>
                                )}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    );
  }, []);

  const SchoolManagement = useMemo(() => ({
    trainingCenters,
    schools,
  }: {
    trainingCenters: any[];
    schools: any[];
  }) => {
    const [newCenterName, setNewCenterName] = useState("");
    const [newSchool, setNewSchool] = useState({
      name: "",
      centerId: "",
      centerName: "",
      address: "",
      contact: "",
      phone: "",
    });
    const [loading, setLoading] = useState(false);
    const [editingSchool, setEditingSchool] = useState<any | null>(null);
    const [selectedCenterId, setSelectedCenterId] = useState("");
    const [selectedSchoolId, setSelectedSchoolId] = useState("");
    const [schoolSearchQuery, setSchoolSearchQuery] = useState("");

    const [hasAutoSeeded, setHasAutoSeeded] = useState(false);

    // Auto-seed if empty
    useEffect(() => {
      if (!loading && trainingCenters.length === 0 && !hasAutoSeeded) {
        const timer = setTimeout(() => {
          if (trainingCenters.length === 0) {
            console.log("Auto-seeding disabled.");
            // seedData(true); // true means silent/auto
            setHasAutoSeeded(true);
          }
        }, 2000);
        return () => clearTimeout(timer);
      }
    }, [trainingCenters.length, loading, hasAutoSeeded]);

    const selectedSchool = schools.find((s) => s.id === selectedSchoolId);

    const handlePrintSchoolLabel = (
      school: any,
      action: "print" | "pdf" = "print",
    ) => {
      let printWindow: Window | null = null;
      let iframeId = `pdf-iframe-${Date.now()}`;

      printWindow = window.open("", "_blank");

      if (!printWindow) return;

      const html = `
      <html>
        <head>
          <title>Shipping Label - ${school.name}</title>
          
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap');
            @page { size: A4; margin: 10mm; }
            body { font-family: 'Sarabun', sans-serif; padding: 0; margin: 0; background: #f0f0f0; display: flex; justify-content: center; align-items: flex-start; }
            .label-container { 
              background: white;
              border: 5px solid #1a2f23; 
              padding: 60px; 
              width: 170mm; 
              min-height: 240mm; 
              box-shadow: 0 10px 30px rgba(0,0,0,0.1);
              position: relative;
              box-sizing: border-box;
            }
            .header { border-bottom: 5px solid #1a2f23; padding-bottom: 30px; margin-bottom: 50px; text-align: center; }
            .section { margin-bottom: 40px; }
            .label { font-weight: bold; font-size: 16px; color: #1a2f23; opacity: 0.6; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px; }
            .value { font-size: 32px; font-weight: 800; color: #1a2f23; line-height: 1.3; }
            .sub-value { font-size: 20px; font-weight: 600; color: #4a5d52; margin-top: 10px; }
            
            .sender-box {
              border: 2px solid #1a2f23;
              padding: 20px;
              margin-bottom: 50px;
              border-radius: 10px;
            }
            
            .recipient-box {
              border: 4px solid #1a2f23;
              padding: 40px;
              background: #f8faf9;
              border-radius: 20px;
            }

            .footer { position: absolute; bottom: 40px; left: 60px; right: 60px; border-top: 2px solid #e1e8e4; padding-top: 20px; font-size: 14px; text-align: center; color: #8a9d92; font-weight: bold; }
            
            @media print { 
              body { background: white; } 
              .label-container { border: 3px solid #000; box-shadow: none; width: 100%; height: 100%; min-height: auto; } 
              .recipient-box { border: 3px solid #000; }
              .sender-box { border: 1px solid #000; }
            }
          </style>
        </head>
        <body>
          <div class="label-container" id="pdf-content">
            <div class="header">
              <h1 style="margin: 0; font-size: 42px; font-weight: 900; color: #1a2f23;">ใบปะหน้าพัสดุ (A4)</h1>
              <p style="margin: 10px 0; font-size: 18px; font-weight: bold; color: #4a5d52;">ชมรมผู้กำกับนักศึกษาวิชาทหาร มทบ.45</p>
            </div>
            
            <div class="sender-box">
              <div class="label">ผู้ส่ง (Sender):</div>
              <div style="font-size: 18px; font-weight: bold; color: #1a2f23;">ชมรมผู้กำกับนักศึกษาวิชาทหาร มทบ.45</div>
              <div style="font-size: 16px; color: #4a5d52;">ค่ายวิภาวดีรังสิต ต.มะขามเตี้ย อ.เมือง จ.สุราษฎร์ธานี 84000</div>
              <div style="font-size: 16px; color: #4a5d52;">โทร: 091-843-9948</div>
            </div>

            <div class="recipient-box">
              <div class="section">
                <div class="label">ผู้รับ (Recipient):</div>
                <div class="value">${school.name}</div>
                <div class="sub-value">${school.trainingCenterName}</div>
              </div>

              <div class="section" style="margin-top: 40px; border-top: 2px dashed #1a2f23; padding-top: 30px;">
                <div class="label">ที่อยู่จัดส่ง:</div>
                <div class="value" style="font-size: 26px;">${school.shippingAddress || "ไม่ได้ระบุที่อยู่จัดส่ง"}</div>
                <div class="sub-value" style="font-size: 22px; color: #1a2f23; margin-top: 20px;">
                  ผู้ติดต่อ: ${school.contactPerson || "-"} <br/>
                  โทร: ${school.contactPhone || "-"}
                </div>
              </div>
            </div>

            <div class="footer">
              <p style="margin: 0;">SCHOOL ID: ${school.id.toUpperCase()}</p>
              <p style="margin: 10px 0 0 0;">พิมพ์เมื่อ: ${new Date().toLocaleString("th-TH")}</p>
            </div>
          </div>
          <script>
            
            const printAction = () => {
              if ('${action}' === 'pdf') {
                document.title = 'shipping_label_${school?.id || "label"}';
                setTimeout(() => window.print(), 500);
              } else {
                window.print();
              }
            };
            if (document.fonts) {
              document.fonts.ready.then(() => { setTimeout(printAction, 500); });
            } else {
              setTimeout(printAction, 500);
            }

          </script>
        </body>
      </html>
    `;

      printWindow.document.write(html);
      printWindow.document.close();
    };

    const addCenter = async () => {
      if (!newCenterName) return;
      setLoading(true);
      try {
        const generatedId = Math.random()
          .toString(36)
          .substring(2, 10)
          .toUpperCase();
        await googleSheetService.syncRecord("TrainingCenters", {
          id: generatedId,
          name: newCenterName,
          createdAt: new Date(),
        });

        setTrainingCenters((prev) => [
          ...prev,
          { id: generatedId, name: newCenterName, location: "" },
        ]);
        setNewCenterName("");
        alert("เพิ่มศูนย์ฝึกสำเร็จ");
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    const deleteCenter = async (id: string) => {
      setConfirmModal({
        title: "ยืนยันการลบศูนย์ฝึก",
        message:
          "โรงเรียนในสังกัดจะยังคงอยู่แต่จะไม่มีศูนย์ฝึกอ้างอิง คุณต้องการดำเนินการต่อใช่หรือไม่?",
        onConfirm: async () => {
          try {
            await googleSheetService.deleteRecord("TrainingCenters", id);
            setTrainingCenters((prev) => prev.filter((c) => c.id !== id));
          } catch (error) {
            console.error(error);
          }
        },
      });
    };

    const addSchool = async () => {
      if (!newSchool.name || !newSchool.centerId) return;
      setLoading(true);
      try {
        const center = trainingCenters.find((c) => c.id === newSchool.centerId);
        const schoolData = {
          name: newSchool.name,
          trainingCenterId: newSchool.centerId,
          trainingCenterName: center?.name || "",
          shippingAddress: newSchool.address,
          contactPerson: newSchool.contact,
          contactPhone: newSchool.phone,
        };

        const generatedId = Math.random()
          .toString(36)
          .substring(2, 10)
          .toUpperCase();
        await googleSheetService.syncRecord("Schools", {
          id: generatedId,
          ...schoolData,
          createdAt: new Date(),
        });

        setSchools((prev) => [...prev, { id: generatedId, ...schoolData }]);
        setNewSchool({
          name: "",
          centerId: "",
          centerName: "",
          address: "",
          contact: "",
          phone: "",
        });
        alert("เพิ่มโรงเรียนสำเร็จ");
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    const updateSchool = async () => {
      if (!editingSchool) return;
      setLoading(true);
      try {
        const updateData = {
          name: editingSchool.name,
          shippingAddress: editingSchool.shippingAddress || "",
          contactPerson: editingSchool.contactPerson || "",
          contactPhone: editingSchool.contactPhone || "",
        };

        await googleSheetService.syncRecord("Schools", {
          id: editingSchool.id,
          ...updateData,
          updatedAt: new Date(),
        });

        setSchools((prev) =>
          prev.map((s) =>
            s.id === editingSchool.id ? { ...s, ...updateData } : s,
          ),
        );
        setEditingSchool(null);
        alert("อัปเดตข้อมูลโรงเรียนสำเร็จ");
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    const deleteSchool = async (id: string) => {
      setConfirmModal({
        title: "ยืนยันการลบโรงเรียน",
        message: "คุณต้องการลบโรงเรียนนี้ใช่หรือไม่?",
        onConfirm: async () => {
          try {
            await googleSheetService.deleteRecord("Schools", id);
            setSchools((prev) => prev.filter((s) => s.id !== id));
          } catch (error) {
            console.error(error);
          }
        },
      });
    };

    const syncFromOrders = async () => {
      setConfirmModal({
        title: "ดึงข้อมูลจากรายการสั่งซื้อ",
        message:
          'ต้องการดึงข้อมูลศูนย์ฝึกและโรงเรียนจาก "รายการสั่งซื้อที่มีอยู่" ใช่หรือไม่? (ข้อมูลที่ซ้ำจะไม่ถูกเพิ่มใหม่)',
        onConfirm: async () => {
          setLoading(true);
          try {
            const ordersData = await googleSheetService.fetchRecords("Orders");

            let addedCenters = 0;
            let addedSchools = 0;

            // Use temporary sets to track what we've added in this loop
            const tempCenters = [...trainingCenters];
            const tempSchools = [...schools];

            for (const order of ordersData) {
              if (!order.trainingCenter || !order.school) continue;

              // Check center
              let centerId = "";
              const existingCenter = tempCenters.find(
                (c) => c.name === order.trainingCenter,
              );
              if (!existingCenter) {
                centerId = Math.random()
                  .toString(36)
                  .substring(2, 10)
                  .toUpperCase();
                addedCenters++;
                tempCenters.push({ id: centerId, name: order.trainingCenter });
                // Sync to Sheets
                await googleSheetService.syncRecord("TrainingCenters", {
                  id: centerId,
                  name: order.trainingCenter,
                  createdAt: new Date(),
                });
              } else {
                centerId = existingCenter.id;
              }

              // Check school
              const existingSchool = tempSchools.find(
                (s) =>
                  s.name === order.school &&
                  s.trainingCenterName === order.trainingCenter,
              );
              if (!existingSchool) {
                const details =
                  SCHOOL_DETAILS[order.school as keyof typeof SCHOOL_DETAILS];
                const schoolData = {
                  name: order.school,
                  trainingCenterId: centerId,
                  trainingCenterName: order.trainingCenter,
                  shippingAddress: details?.address || "",
                  contactPerson: details?.contact || "",
                  contactPhone: details?.phone || "",
                };
                const schoolId = Math.random()
                  .toString(36)
                  .substring(2, 10)
                  .toUpperCase();
                addedSchools++;
                tempSchools.push({
                  name: order.school,
                  trainingCenterName: order.trainingCenter,
                } as any);
                // Sync to Sheets
                await googleSheetService.syncRecord("Schools", {
                  id: schoolId,
                  ...schoolData,
                  createdAt: new Date(),
                });
              }
            }

            setTrainingCenters(tempCenters);
            setSchools(tempSchools as any);

            alert(
              `ซิงค์ข้อมูลสำเร็จ: เพิ่มศูนย์ฝึกใหม่ ${addedCenters} แห่ง, เพิ่มโรงเรียนใหม่ ${addedSchools} แห่ง จากรายการสั่งซื้อ`,
            );
          } catch (error) {
            console.error("Sync error:", error);
            alert("เกิดข้อผิดพลาดในการซิงค์ข้อมูล");
          } finally {
            setLoading(false);
          }
        },
      });
    };

    const syncAddressesFromConstants = async () => {
      setConfirmModal({
        title: "อัปเดตที่อยู่จากระบบ",
        message:
          "ต้องการอัปเดตที่อยู่และข้อมูลติดต่อของโรงเรียนจากฐานข้อมูลระบบใช่หรือไม่? (ข้อมูลที่ขาดหายไปจะถูกเติมเต็ม)",
        onConfirm: async () => {
          setLoading(true);
          try {
            let updatedCount = 0;
            const updatedSchools = [...schools];
            for (let i = 0; i < updatedSchools.length; i++) {
              const school = updatedSchools[i];
              let details =
                SCHOOL_DETAILS[school.name as keyof typeof SCHOOL_DETAILS];

              if (!details) {
                const normalize = (name: string) =>
                  name
                    .replace(/รร\./g, "โรงเรียน")
                    .replace(/ /g, "")
                    .replace(/[๐-๙]/g, (d) =>
                      "๐๑๒๓๔๕๖๗๘๙".indexOf(d).toString(),
                    );
                const normalizedSchoolName = normalize(school.name);

                const match = Object.entries(SCHOOL_DETAILS).find(
                  ([key]) => normalize(key) === normalizedSchoolName,
                );
                if (match) {
                  details = match[1];
                }
              }

              if (details) {
                const needsUpdate =
                  !school.shippingAddress ||
                  !school.contactPerson ||
                  !school.contactPhone;
                if (needsUpdate) {
                  const updateData = {
                    shippingAddress:
                      school.shippingAddress && school.shippingAddress !== ""
                        ? school.shippingAddress
                        : details.address,
                    contactPerson:
                      school.contactPerson && school.contactPerson !== ""
                        ? school.contactPerson
                        : details.contact,
                    contactPhone:
                      school.contactPhone && school.contactPhone !== ""
                        ? school.contactPhone
                        : details.phone,
                    updatedAt: new Date().toISOString(),
                  };
                  await googleSheetService.syncRecord("Schools", {
                    id: school.id,
                    ...updateData,
                  });
                  updatedSchools[i] = { ...school, ...updateData };
                  updatedCount++;
                }
              }
            }
            setSchools(updatedSchools);
            alert(`อัปเดตข้อมูลสำเร็จ: อัปเดต ${updatedCount} โรงเรียน`);
          } catch (error) {
            console.error("Update error:", error);
            alert("เกิดข้อผิดพลาดในการอัปเดตข้อมูล");
          } finally {
            setLoading(false);
          }
        },
      });
    };

    const seedData = async (isAuto = false) => {
      const performSeed = async () => {
        setLoading(true);
        try {
          console.log("Starting seedData...");
          let addedCenters = 0;
          let addedSchools = 0;

          // Use local tracking to avoid stale state issues during the loop
          const currentCenters = [...trainingCenters];
          const currentSchools = [...schools];

          for (const centerName of TRAINING_CENTERS) {
            let centerId = "";
            const existingCenter = currentCenters.find(
              (c) => c.name === centerName,
            );

            if (!existingCenter) {
              console.log(`Adding center: ${centerName}`);
              centerId = Math.random()
                .toString(36)
                .substring(2, 10)
                .toUpperCase();
              addedCenters++;
              currentCenters.push({ id: centerId, name: centerName } as any);
              // Sync to Sheets
              await googleSheetService.syncRecord("TrainingCenters", {
                id: centerId,
                name: centerName,
                createdAt: new Date(),
              });
            } else {
              centerId = existingCenter.id;
            }

            const schoolsList =
              SCHOOLS_BY_CENTER[centerName as keyof typeof SCHOOLS_BY_CENTER] ||
              [];
            for (const schoolName of schoolsList) {
              const existingSchool = currentSchools.find(
                (s) =>
                  s.name === schoolName && s.trainingCenterName === centerName,
              );

              if (!existingSchool) {
                console.log(`Adding school: ${schoolName} to ${centerName}`);
                const details =
                  SCHOOL_DETAILS[schoolName as keyof typeof SCHOOL_DETAILS];
                const schoolData = {
                  name: schoolName,
                  trainingCenterId: centerId,
                  trainingCenterName: centerName,
                  shippingAddress: details?.address || "",
                  contactPerson: details?.contact || "",
                  contactPhone: details?.phone || "",
                };
                const schoolId = Math.random()
                  .toString(36)
                  .substring(2, 10)
                  .toUpperCase();
                addedSchools++;
                currentSchools.push({
                  name: schoolName,
                  trainingCenterName: centerName,
                } as any);
                // Sync to Sheets
                await googleSheetService.syncRecord("Schools", {
                  id: schoolId,
                  ...schoolData,
                  createdAt: new Date(),
                });
              }
            }
          }

          setTrainingCenters(currentCenters);
          setSchools(currentSchools);

          if (!isAuto) {
            alert(
              `นำเข้าข้อมูลสำเร็จ: เพิ่มศูนย์ฝึกใหม่ ${addedCenters} แห่ง, เพิ่มโรงเรียนใหม่ ${addedSchools} แห่ง`,
            );
          }
        } catch (error) {
          console.error("Seed error:", error);
          if (!isAuto) {
            alert(
              "เกิดข้อผิดพลาดในการนำเข้าข้อมูล: " +
                (error instanceof Error ? error.message : String(error)),
            );
          }
        } finally {
          setLoading(false);
        }
      };

      if (isAuto) {
        performSeed();
      } else {
        setConfirmModal({
          title: "นำเข้าข้อมูลพื้นฐาน",
          message:
            "ต้องการดึงข้อมูลศูนย์ฝึกและโรงเรียนจากระบบใช่หรือไม่? (ข้อมูลที่ซ้ำจะไม่ถูกเพิ่มใหม่)",
          onConfirm: performSeed,
        });
      }
    };

    return (
      <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 pb-20">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-4xl font-black text-army-dark uppercase tracking-tighter mb-2">
              พิมพ์ใบปะหน้า
            </h2>
            <p className="text-army-muted font-bold uppercase tracking-widest text-sm">
              เลือกโรงเรียนและพิมพ์ใบปะหน้าพัสดุ
            </p>
          </div>
        </div>

        {/* Quick Print Section */}
        <div className="bg-white p-8 rounded-3xl border-2 border-army-dark shadow-xl space-y-8">
          <div className="flex items-center space-x-3 text-2xl font-black text-army-dark uppercase tracking-tighter">
            <Printer size={32} />
            <span>เครื่องมือพิมพ์ใบปะหน้า</span>
          </div>

          <div className="space-y-4">
            <label className="text-xs font-black text-army-muted uppercase tracking-widest">
              ค้นหาโรงเรียน (พิมพ์ชื่อเพื่อค้นหาได้ทันที)
            </label>
            <div className="relative">
              <Search
                className="absolute left-6 top-1/2 -translate-y-1/2 text-army-muted"
                size={20}
              />
              <input
                type="text"
                placeholder="พิมพ์ชื่อโรงเรียนเพื่อค้นหา..."
                value={schoolSearchQuery}
                onChange={(e) => setSchoolSearchQuery(e.target.value)}
                className="w-full pl-16 pr-6 py-4 bg-army-bg border-2 border-army-bg rounded-2xl focus:border-army-primary transition-all outline-none font-bold text-base"
              />
            </div>
            {schoolSearchQuery && (
              <div className="bg-army-bg/50 rounded-2xl p-2 max-h-48 overflow-y-auto border-2 border-army-bg">
                {schools
                  .filter((s) =>
                    s.name
                      .toLowerCase()
                      .includes(schoolSearchQuery.toLowerCase()),
                  )
                  .slice(0, 10)
                  .map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSelectedCenterId(s.trainingCenterId);
                        setSelectedSchoolId(s.id);
                        setSchoolSearchQuery("");
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-white rounded-xl transition-all font-bold text-sm flex justify-between items-center"
                    >
                      <span>{s.name}</span>
                      <span className="text-[10px] bg-army-dark text-white px-2 py-1 rounded-full uppercase">
                        {s.trainingCenterName}
                      </span>
                    </button>
                  ))}
                {schools.filter((s) =>
                  s.name
                    .toLowerCase()
                    .includes(schoolSearchQuery.toLowerCase()),
                ).length === 0 && (
                  <div className="p-4 text-center text-army-muted font-bold text-xs uppercase tracking-widest">
                    ไม่พบโรงเรียนที่ค้นหา
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <label className="text-xs font-black text-army-muted uppercase tracking-widest">
                1. เลือกศูนย์ฝึก
              </label>
              <select
                value={selectedCenterId}
                onChange={(e) => {
                  setSelectedCenterId(e.target.value);
                  setSelectedSchoolId("");
                }}
                className="w-full px-6 py-4 bg-army-bg border-2 border-army-bg rounded-2xl focus:border-army-primary transition-all outline-none font-bold text-base"
              >
                <option value="">เลือกศูนย์ฝึก</option>
                {trainingCenters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-4">
              <label className="text-xs font-black text-army-muted uppercase tracking-widest">
                2. เลือกโรงเรียน
              </label>
              <select
                value={selectedSchoolId}
                onChange={(e) => setSelectedSchoolId(e.target.value)}
                disabled={!selectedCenterId}
                className="w-full px-6 py-4 bg-army-bg border-2 border-army-bg rounded-2xl focus:border-army-primary transition-all outline-none font-bold text-base disabled:opacity-50"
              >
                <option value="">เลือกโรงเรียน</option>
                {schools
                  .filter((s) => s.trainingCenterId === selectedCenterId)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {trainingCenters.length === 0 && (
            <div className="p-12 bg-army-bg/30 rounded-[2.5rem] border-4 border-dashed border-army-bg flex flex-col items-center text-center space-y-6">
              <div className="p-6 bg-white rounded-full shadow-xl text-army-dark">
                <Sparkles size={48} />
              </div>
              <div className="space-y-2">
                <h4 className="text-2xl font-black text-army-dark uppercase tracking-tighter">
                  ยังไม่มีข้อมูลศูนย์ฝึกและโรงเรียน
                </h4>
                <p className="text-army-muted font-bold uppercase tracking-widest text-xs max-w-md">
                  กรุณากดปุ่ม "ดึงข้อมูลเริ่มต้น" ที่มุมขวาบน
                  เพื่อนำเข้าข้อมูลศูนย์ฝึกและโรงเรียนทั้งหมดเข้าสู่ระบบ
                </p>
              </div>
              <button
                onClick={() => seedData(false)}
                disabled={loading}
                className="px-10 py-5 bg-army-dark text-white rounded-[2rem] font-black uppercase tracking-widest hover:bg-army-primary transition-all shadow-2xl flex items-center space-x-3 text-lg disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 size={24} className="animate-spin" />
                ) : (
                  <Download size={24} />
                )}
                <span>
                  {loading
                    ? "กำลังนำเข้าข้อมูล..."
                    : "ดึงข้อมูลเริ่มต้นเดี๋ยวนี้"}
                </span>
              </button>
            </div>
          )}

          {selectedSchool && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-8 bg-army-bg rounded-[2.5rem] border-2 border-army-dark/5 space-y-6"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-2xl font-black text-army-dark mb-1">
                    {selectedSchool.name}
                  </h4>
                  <p className="text-xs font-black text-army-muted uppercase tracking-widest">
                    {selectedSchool.trainingCenterName}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <label className="text-xs font-black text-army-muted uppercase tracking-widest">
                    ที่อยู่จัดส่ง:
                  </label>
                  <textarea
                    value={
                      editingSchool?.id === selectedSchool.id
                        ? editingSchool.shippingAddress
                        : selectedSchool.shippingAddress || ""
                    }
                    onChange={(e) =>
                      setEditingSchool({
                        ...(editingSchool || selectedSchool),
                        shippingAddress: e.target.value,
                      })
                    }
                    onFocus={() =>
                      !editingSchool && setEditingSchool(selectedSchool)
                    }
                    placeholder="ระบุที่อยู่จัดส่งโรงเรียน"
                    className="w-full p-4 bg-white border-2 border-army-light/20 rounded-2xl text-base font-bold outline-none focus:border-army-dark h-32 transition-all shadow-sm"
                  />
                  <p className="text-[10px] font-black text-army-muted uppercase tracking-widest mt-1 ml-2 flex items-center space-x-1">
                    <Sparkles size={10} className="text-army-primary" />
                    <span>ข้อมูลที่อยู่จะถูกบันทึกไว้ใช้ในครั้งถัดไป</span>
                  </p>
                </div>
                <div className="space-y-4">
                  <label className="text-xs font-black text-army-muted uppercase tracking-widest">
                    ข้อมูลติดต่อ:
                  </label>
                  <div className="space-y-4">
                    <input
                      type="text"
                      value={
                        editingSchool?.id === selectedSchool.id
                          ? editingSchool.contactPerson
                          : selectedSchool.contactPerson || ""
                      }
                      onChange={(e) =>
                        setEditingSchool({
                          ...(editingSchool || selectedSchool),
                          contactPerson: e.target.value,
                        })
                      }
                      onFocus={() =>
                        !editingSchool && setEditingSchool(selectedSchool)
                      }
                      placeholder="ชื่อผู้ติดต่อ"
                      className="w-full p-4 bg-white border-2 border-army-light/20 rounded-2xl text-base font-bold outline-none focus:border-army-dark transition-all shadow-sm"
                    />
                    <input
                      type="text"
                      value={
                        editingSchool?.id === selectedSchool.id
                          ? editingSchool.contactPhone
                          : selectedSchool.contactPhone || ""
                      }
                      onChange={(e) =>
                        setEditingSchool({
                          ...(editingSchool || selectedSchool),
                          contactPhone: e.target.value,
                        })
                      }
                      onFocus={() =>
                        !editingSchool && setEditingSchool(selectedSchool)
                      }
                      placeholder="เบอร์โทรศัพท์"
                      className="w-full p-4 bg-white border-2 border-army-light/20 rounded-2xl text-base font-bold outline-none focus:border-army-dark transition-all shadow-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <button
                  onClick={updateSchool}
                  disabled={loading || !editingSchool}
                  className="flex-1 py-5 bg-army-dark text-white rounded-[2rem] font-black uppercase tracking-widest hover:bg-army-primary transition-all shadow-xl flex items-center justify-center space-x-3 text-lg disabled:opacity-50"
                >
                  <Save size={24} />
                  <span>บันทึกข้อมูล</span>
                </button>
                <div className="flex flex-1 gap-4">
                  <button
                    onClick={() => handlePrintSchoolLabel(selectedSchool)}
                    className="flex-1 py-5 bg-white text-army-dark border-4 border-army-dark rounded-[2rem] font-black uppercase tracking-widest hover:bg-army-bg transition-all shadow-xl flex items-center justify-center space-x-3 lg:text-lg"
                  >
                    <Printer size={24} />
                    <span>พิมพ์ (A4)</span>
                  </button>
                  <button
                    onClick={() =>
                      handlePrintSchoolLabel(selectedSchool, "pdf")
                    }
                    className="flex-1 py-5 bg-emerald-600 text-white rounded-[2rem] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl flex items-center justify-center space-x-3 lg:text-lg"
                  >
                    <Download size={24} />
                    <span>EXPORT PDF</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Training Center Management */}
          <div className="bg-white p-8 rounded-3xl border-2 border-army-dark shadow-xl space-y-6">
            <h3 className="text-xl font-black text-army-dark uppercase tracking-tighter flex items-center space-x-3">
              <Building2 size={24} />
              <span>จัดการศูนย์ฝึก</span>
            </h3>
            <div className="flex gap-4">
              <input
                type="text"
                value={newCenterName}
                onChange={(e) => setNewCenterName(e.target.value)}
                placeholder="ชื่อศูนย์ฝึกใหม่"
                className="flex-grow px-6 py-4 bg-army-bg border-2 border-army-bg rounded-2xl focus:border-army-primary transition-all outline-none font-bold text-base"
              />
              <button
                onClick={addCenter}
                disabled={loading}
                className="px-8 py-4 bg-army-dark text-white rounded-2xl font-black uppercase tracking-widest hover:bg-army-primary transition-all text-base"
              >
                เพิ่ม
              </button>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {trainingCenters.map((center) => (
                <div
                  key={center.id}
                  className="flex items-center justify-between p-4 bg-army-bg rounded-2xl group hover:bg-white border-2 border-transparent hover:border-army-dark transition-all"
                >
                  <span className="font-bold text-army-dark">
                    {center.name}
                  </span>
                  <button
                    onClick={() => deleteCenter(center.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                  >
                    <XCircle size={20} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* School Management */}
          <div className="bg-white p-8 rounded-3xl border-2 border-army-dark shadow-xl space-y-6">
            <h3 className="text-xl font-black text-army-dark uppercase tracking-tighter flex items-center space-x-3">
              <School size={24} />
              <span>เพิ่มโรงเรียนใหม่</span>
            </h3>
            <div className="space-y-4">
              <select
                value={newSchool.centerId}
                onChange={(e) =>
                  setNewSchool({ ...newSchool, centerId: e.target.value })
                }
                className="w-full px-6 py-4 bg-army-bg border-2 border-army-bg rounded-2xl focus:border-army-primary transition-all outline-none font-bold text-base"
              >
                <option value="">เลือกศูนย์ฝึก</option>
                {trainingCenters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={newSchool.name}
                onChange={(e) =>
                  setNewSchool({ ...newSchool, name: e.target.value })
                }
                placeholder="ชื่อโรงเรียน"
                className="w-full px-6 py-4 bg-army-bg border-2 border-army-bg rounded-2xl focus:border-army-primary transition-all outline-none font-bold text-base"
              />
              <button
                onClick={addSchool}
                disabled={loading}
                className="w-full py-4 bg-army-dark text-white rounded-2xl font-black uppercase tracking-widest hover:bg-army-primary transition-all text-base"
              >
                เพิ่มโรงเรียน
              </button>
            </div>
          </div>
        </div>

        {/* School List & Shipping Info */}
        <div className="bg-white p-8 rounded-3xl border-2 border-army-dark shadow-xl space-y-8">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-black text-army-dark uppercase tracking-tighter">
              รายชื่อโรงเรียนและข้อมูลการจัดส่ง
            </h3>
            <div className="text-[10px] font-black text-army-muted uppercase tracking-widest">
              ทั้งหมด {schools.length} โรงเรียน
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {schools.map((school) => (
              <div
                key={school.id}
                className="bg-army-bg p-6 rounded-[2rem] border-2 border-transparent hover:border-army-dark transition-all group relative"
              >
                <button
                  onClick={() => deleteSchool(school.id)}
                  className="absolute top-4 right-4 p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                >
                  <XCircle size={18} />
                </button>
                <div className="mb-4">
                  <p className="text-[8px] font-black text-army-muted uppercase tracking-widest mb-1">
                    {school.trainingCenterName}
                  </p>
                  <h4 className="text-lg font-black text-army-dark leading-tight">
                    {school.name}
                  </h4>
                </div>

                {editingSchool?.id === school.id ? (
                  <div className="space-y-3 mt-4">
                    <textarea
                      value={editingSchool.shippingAddress}
                      onChange={(e) =>
                        setEditingSchool({
                          ...editingSchool,
                          shippingAddress: e.target.value,
                        })
                      }
                      placeholder="ที่อยู่จัดส่ง"
                      className="w-full p-3 bg-white border-2 border-army-light/20 rounded-xl text-xs font-bold outline-none focus:border-army-dark h-20"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={editingSchool.contactPerson}
                        onChange={(e) =>
                          setEditingSchool({
                            ...editingSchool,
                            contactPerson: e.target.value,
                          })
                        }
                        placeholder="ผู้ติดต่อ"
                        className="w-full p-3 bg-white border-2 border-army-light/20 rounded-xl text-xs font-bold outline-none focus:border-army-dark"
                      />
                      <input
                        type="text"
                        value={editingSchool.contactPhone}
                        onChange={(e) =>
                          setEditingSchool({
                            ...editingSchool,
                            contactPhone: e.target.value,
                          })
                        }
                        placeholder="เบอร์โทร"
                        className="w-full p-3 bg-white border-2 border-army-light/20 rounded-xl text-xs font-bold outline-none focus:border-army-dark"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingSchool(null)}
                        className="flex-1 py-2 bg-white text-army-muted rounded-xl text-[10px] font-black uppercase tracking-widest border-2 border-army-bg"
                      >
                        ยกเลิก
                      </button>
                      <button
                        onClick={updateSchool}
                        className="flex-1 py-2 bg-army-dark text-white rounded-xl text-[10px] font-black uppercase tracking-widest"
                      >
                        บันทึก
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 mt-4">
                    <div className="bg-white/50 p-4 rounded-2xl space-y-2">
                      <p className="text-[8px] font-black text-army-muted uppercase tracking-widest">
                        ที่อยู่จัดส่ง:
                      </p>
                      <p className="text-[10px] font-bold text-army-dark line-clamp-2">
                        {school.shippingAddress || "ยังไม่ได้ระบุที่อยู่"}
                      </p>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="text-[8px] font-black text-army-muted uppercase tracking-widest">
                        {school.contactPerson
                          ? `${school.contactPerson} (${school.contactPhone})`
                          : "ไม่มีข้อมูลผู้ติดต่อ"}
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handlePrintSchoolLabel(school)}
                          className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border-2 border-emerald-100 hover:border-emerald-600 transition-all title='พิมพ์ใบปะหน้า'"
                        >
                          <Printer size={14} />
                        </button>
                        <button
                          onClick={() => handlePrintSchoolLabel(school, "pdf")}
                          className="p-2 bg-blue-50 text-blue-600 rounded-xl border-2 border-blue-100 hover:border-blue-600 transition-all title='Export PDF'"
                        >
                          <Download size={14} />
                        </button>
                        <button
                          onClick={() => setEditingSchool(school)}
                          className="p-2 bg-white text-army-dark rounded-xl border-2 border-army-bg hover:border-army-dark transition-all"
                        >
                          <SettingsIcon size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }, []);

  return (
    <div className="min-h-screen bg-army-bg/30 flex">
      {/* Visual Toast Notifications */}
      <AnimatePresence>
        {toastMessage && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[300] w-full max-w-sm px-4">
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              className={cn(
                "p-4 rounded-3xl shadow-2xl border-2 flex items-start space-x-3 backdrop-blur-md font-sans text-xs font-black uppercase tracking-wide",
                toastType === "success"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : toastType === "error"
                  ? "bg-red-50 text-red-800 border-red-200"
                  : "bg-blue-50 text-blue-800 border-blue-200"
              )}
            >
              <div className="mt-0.5">
                {toastType === "success" ? (
                  <CheckCircle2 size={16} className="text-emerald-500" />
                ) : toastType === "error" ? (
                  <XCircle size={16} className="text-red-500" />
                ) : (
                  <Sparkles size={16} className="text-blue-500" />
                )}
              </div>
              <div className="flex-grow">
                <p>{toastMessage}</p>
              </div>
              <button
                onClick={() => setToastMessage(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={14} />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Generic Confirmation Modal */}
      <AnimatePresence>
        {confirmModal && (
          <div className="fixed inset-0 bg-army-dark/50 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white p-8 rounded-[2.5rem] border-2 border-army-dark shadow-2xl max-w-sm w-full space-y-6"
            >
              <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mx-auto">
                <AlertCircle size={32} />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-black text-army-dark uppercase tracking-tighter">
                  {confirmModal.title}
                </h3>
                <p className="text-sm font-bold text-army-muted">
                  {confirmModal.message}
                </p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    if (confirmModal.onCancel) confirmModal.onCancel();
                    setConfirmModal(null);
                  }}
                  className="flex-1 px-6 py-3 bg-army-bg text-army-dark rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-army-light transition-all"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={() => {
                    confirmModal.onConfirm();
                    setConfirmModal(null);
                  }}
                  className="flex-1 px-6 py-3 bg-army-dark text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-army-primary transition-all shadow-lg shadow-army-dark/20"
                >
                  ยืนยัน
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
          <button
            onClick={() => navigate("/")}
            className="p-2 bg-army-bg rounded-xl text-army-dark"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-black text-army-dark uppercase tracking-tighter flex items-center space-x-2">
            <LayoutDashboard size={20} />
            <span>ADMIN</span>
          </h1>
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="text-army-dark"
          >
            <Menu size={24} />
          </button>
        </div>

        {quotaExceeded && (
          <div className="mb-8 p-4 bg-emerald-50 border-l-4 border-emerald-500 rounded-r-xl shadow-sm">
            <div className="flex items-center">
              <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse mr-3 shrink-0" />
              <div>
                <h3 className="text-emerald-800 font-bold">
                  ระบบเชื่อมต่อฐานข้อมูลภายนอก: ดึงข้อมูลจาก Google Sheets โดยตรง 100% (เรียบร้อยแล้ว)
                </h3>
                <p className="text-emerald-700 text-sm mt-0.5">
                  ระบบจัดเตรียมฐานข้อมูลสำรองและทำงานประสานข้อมูลร่วมกับ Google Sheets ครบถ้วนรวดเร็ว 100%
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "summary" && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4">
            <div>
              <h2 className="text-3xl font-black text-army-dark uppercase tracking-tighter mb-2">
                สรุปคำสั่งซื้อ
              </h2>
              <p className="text-army-muted font-black uppercase tracking-widest text-[10px]">
                ภาพรวมและสถิติการสั่งซื้อทั้งหมด
              </p>
            </div>

            <div className="bg-white rounded-3xl border-2 border-army-dark shadow-xl">
              <div className="p-6 border-b-2 border-army-dark flex flex-col md:flex-row flex-wrap gap-4">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="px-4 py-3 bg-army-bg border-2 border-army-bg rounded-xl text-xs font-black uppercase tracking-normal outline-none focus:border-army-dark transition-all"
                >
                  <option value="all">ทุกสถานะ</option>
                  <option value="pending">รับคำสั่งซื้อ</option>
                  <option value="verifying">ดำเนินการคำสั่งซื้อ</option>
                  <option value="preparing">กำลังจัดส่ง</option>
                  <option value="completed">จัดส่งสำเร็จ</option>
                  <option value="cancelled">ยกเลิก</option>
                </select>
                <select
                  value={filterCenter}
                  onChange={(e) => {
                    setFilterCenter(e.target.value);
                    setFilterSchool("all");
                  }}
                  className="px-4 py-3 bg-army-bg border-2 border-army-bg rounded-xl text-xs font-black uppercase tracking-normal outline-none focus:border-army-dark transition-all"
                >
                  <option value="all">ทุกศูนย์</option>
                  {trainingCenters.map((center) => (
                    <option key={center.id || center.name} value={center.name}>
                      {center.name}
                    </option>
                  ))}
                </select>
                <select
                  value={filterSchool}
                  onChange={(e) => setFilterSchool(e.target.value)}
                  className="px-4 py-3 bg-army-bg border-2 border-army-bg rounded-xl text-xs font-black uppercase tracking-normal outline-none focus:border-army-dark transition-all"
                >
                  <option value="all">ทุกโรงเรียน</option>
                  {filterCenter !== "all" &&
                    schools
                      .filter((s) => s.trainingCenterName === filterCenter)
                      .map((school) => (
                        <option key={school.id || school.name} value={school.name}>
                          {school.name}
                        </option>
                      ))}
                </select>
                <select
                  value={filterGender}
                  onChange={(e) => setFilterGender(e.target.value)}
                  className="px-4 py-3 bg-army-bg border-2 border-army-bg rounded-xl text-xs font-black uppercase tracking-normal outline-none focus:border-army-dark transition-all"
                >
                  <option value="all">ทุกเพศ</option>
                  <option value="ชาย">ชาย</option>
                  <option value="หญิง">หญิง</option>
                </select>
                <div className="relative">
                  <DatePicker
                    selected={filterDate}
                    onChange={(date) => setFilterDate(date)}
                    dateFormat="dd/MM/yyyy"
                    placeholderText="เลือกวันที่"
                    isClearable
                    className="w-32 px-4 py-3 bg-army-bg border-2 border-army-bg rounded-xl text-xs font-black uppercase tracking-tight outline-none focus:border-army-dark transition-all cursor-pointer"
                    locale={th}
                    popperClassName="z-[9999]"
                  />
                  {!filterDate && (
                    <Calendar
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-army-muted pointer-events-none"
                      size={14}
                    />
                  )}
                </div>
                <button
                  onClick={handleExportToExcel}
                  className="flex items-center space-x-2 px-6 py-3 bg-army-dark text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-army-primary transition-all shadow-lg"
                >
                  <Download size={14} />
                  <span>ส่งออก Excel</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  label: "รายได้รวม",
                  value: formatPrice(stats.totalSales),
                  icon: TrendingUp,
                  color: "text-army-dark",
                  bg: "bg-army-bg",
                  trend: "+12.5%",
                  trendUp: true,
                },
                {
                  label: "ภารกิจที่รอดำเนินการ",
                  value: stats.pendingOrders,
                  icon: Clock,
                  color: "text-amber-600",
                  bg: "bg-amber-50",
                  trend: "5 ใหม่",
                  trendUp: false,
                },
                {
                  label: "ภารกิจที่สำเร็จ",
                  value: stats.completedOrders,
                  icon: CheckCircle2,
                  color: "text-emerald-600",
                  bg: "bg-emerald-50",
                  trend: "+8.2%",
                  trendUp: true,
                },
                {
                  label: "คำสั่งซื้อทั้งหมด",
                  value: stats.totalOrders,
                  icon: ShoppingCart,
                  color: "text-army-muted",
                  bg: "bg-army-bg",
                  trend: "ทุกสถานะ",
                  trendUp: true,
                },
              ].map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-white p-8 rounded-3xl border-2 border-army-bg shadow-sm hover:border-army-dark transition-all group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div
                      className={cn(
                        "p-4 rounded-xl shadow-sm border border-army-bg",
                        stat.bg,
                        stat.color,
                      )}
                    >
                      <stat.icon size={24} />
                    </div>
                    <div
                      className={cn(
                        "flex items-center text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full",
                        stat.trendUp
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-army-bg text-army-muted",
                      )}
                    >
                      {stat.trendUp ? (
                        <ArrowUpRight size={12} />
                      ) : (
                        <ArrowDownRight size={12} />
                      )}
                      <span>{stat.trend}</span>
                    </div>
                  </div>
                  <p className="text-sm font-black text-army-muted uppercase tracking-normal mb-1">
                    {stat.label}
                  </p>
                  <h3 className="text-3xl font-mono font-black text-army-dark tracking-tighter">
                    {stat.value}
                  </h3>
                </motion.div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {(
                [
                  "pending",
                  "verifying",
                  "preparing",
                  "completed",
                  "cancelled",
                ] as OrderStatus[]
              ).map((status) => (
                <div
                  key={status}
                  className="bg-white p-6 rounded-2xl border-2 border-army-bg shadow-sm"
                >
                  <p className="text-xs font-black text-army-muted uppercase tracking-normal mb-1">
                    {STATUS_CONFIG[status].label}
                  </p>
                  <h3 className="text-2xl font-mono font-black text-army-dark tracking-tighter">
                    {filteredOrders.filter((o) => o.status === status).length}
                  </h3>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-white p-8 rounded-3xl border-2 border-army-bg shadow-sm">
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-xs font-black text-army-dark uppercase tracking-[0.2em]">
                    ข้อมูลรายได้
                  </h2>
                  <select
                    value={revenueFilter}
                    onChange={(e) => setRevenueFilter(e.target.value as any)}
                    className="bg-army-bg border-2 border-army-bg rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest outline-none focus:border-army-dark transition-all"
                  >
                    <option value="daily">รายวัน</option>
                    <option value="monthly">รายเดือน</option>
                    <option value="yearly">รายปี</option>
                  </select>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#f0f2f0"
                      />
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fontSize: 10,
                          fill: "#6B7F64",
                          fontWeight: "black",
                        }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fontSize: 10,
                          fill: "#6B7F64",
                          fontWeight: "black",
                        }}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "16px",
                          border: "2px solid #2D3A28",
                          boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                          padding: "12px",
                        }}
                        itemStyle={{
                          color: "#2D3A28",
                          fontWeight: "black",
                          fontSize: "12px",
                          textTransform: "uppercase",
                        }}
                        labelStyle={{
                          fontWeight: "black",
                          color: "#6B7F64",
                          marginBottom: "4px",
                          fontSize: "10px",
                        }}
                      />
                      <Bar
                        dataKey="amount"
                        fill="#2D3A28"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="lg:col-span-1 bg-white p-8 rounded-3xl border-2 border-army-bg shadow-sm">
                <h2 className="text-xs font-black text-army-dark uppercase tracking-[0.2em] mb-8">
                  บันทึกภารกิจล่าสุด
                </h2>
                <div className="space-y-6">
                  {orders.slice(0, 5).map((order, idx) => (
                    <div
                      key={order.id ? `${order.id}-${idx}` : `recent-${idx}`}
                      className="flex items-start space-x-4 group"
                    >
                      <div
                        className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border-2 transition-all",
                          (
                            STATUS_CONFIG[order.status as OrderStatus] ||
                            STATUS_CONFIG.pending
                          ).color.includes("white") ||
                            (
                              STATUS_CONFIG[order.status as OrderStatus] ||
                              STATUS_CONFIG.pending
                            ).color.includes("army-dark")
                            ? "bg-army-dark border-army-dark text-white"
                            : "bg-army-bg border-army-bg text-army-muted group-hover:border-army-dark group-hover:text-army-dark",
                        )}
                      >
                        {React.createElement(
                          (
                            STATUS_CONFIG[order.status as OrderStatus] ||
                            STATUS_CONFIG.pending
                          ).icon,
                          { size: 16 },
                        )}
                      </div>
                      <div className="flex-grow min-w-0">
                        <p className="text-[10px] font-black text-army-dark uppercase tracking-tight truncate mb-0.5">
                          {order.fullName}
                        </p>
                        <p className="text-[8px] font-black text-army-muted uppercase tracking-widest">
                          {order.createdAt?.toDate
                            ? format(
                                order.createdAt.toDate(),
                                "HH:mm",
                              ).toUpperCase()
                            : "ตอนนี้"}{" "}
                          • {formatPrice(getOrderAmount(order))}
                        </p>
                      </div>
                      <div
                        className={cn(
                          "px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest",
                          (
                            STATUS_CONFIG[order.status as OrderStatus] ||
                            STATUS_CONFIG.pending
                          ).color,
                        )}
                      >
                        {
                          (
                            STATUS_CONFIG[order.status as OrderStatus] ||
                            STATUS_CONFIG.pending
                          ).label.split(" ")[0]
                        }
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setActiveTab("orders")}
                  className="w-full mt-8 py-4 text-[10px] font-black text-army-muted uppercase tracking-widest hover:text-army-dark hover:bg-army-bg rounded-xl transition-all border-2 border-transparent hover:border-army-bg"
                >
                  ดูข้อมูลทั้งหมด
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "orders" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div>
              <h2 className="text-3xl font-black text-army-dark uppercase tracking-tighter mb-2">
                จัดการคำสั่งซื้อ
              </h2>
              <p className="text-army-muted font-black uppercase tracking-normal text-xs">
                ตรวจสอบและอัปเดตสถานะคำสั่งซื้อ
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-3xl border-2 border-army-dark shadow-xl">
                <p className="text-xs font-black text-army-muted uppercase tracking-normal mb-2">
                  สรุปจำนวนสินค้าที่กรอง
                </p>
                <p className="text-4xl font-black text-army-dark uppercase tracking-tighter">
                  {filteredOrders.reduce(
                    (sum, o) =>
                      sum +
                      o.items
                        .filter(
                          (i) =>
                            (filterProduct === "all" ||
                              i.name === filterProduct) &&
                            (filterSize === "all" || i.size === filterSize),
                        )
                        .reduce((s, i) => s + i.quantity, 0),
                    0,
                  )}
                  <span className="text-sm text-army-muted ml-2">ชิ้น</span>
                </p>
              </div>
              <div className="bg-white p-6 rounded-3xl border-2 border-army-dark shadow-xl">
                <p className="text-xs font-black text-army-muted uppercase tracking-normal mb-2">
                  รายการคำสั่งซื้อที่พบ
                </p>
                <p className="text-4xl font-black text-army-dark uppercase tracking-tighter">
                  {filteredOrders.length}
                  <span className="text-sm text-army-muted ml-2">รายการ</span>
                </p>
              </div>
            </div>

            <div className="bg-white rounded-3xl border-2 border-army-dark shadow-xl">
              <div className="p-6 border-b-2 border-army-dark flex flex-col md:flex-row flex-wrap gap-4">
                <div className="relative flex-grow w-full md:w-64">
                  <Search
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-army-muted"
                    size={16}
                  />
                  <input
                    type="text"
                    placeholder="ค้นหาชื่อหรือหมายเลขรายการ..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-army-bg border-2 border-army-bg rounded-xl text-xs font-black uppercase tracking-tight outline-none focus:border-army-dark transition-all"
                  />
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="px-4 py-3 bg-army-bg border-2 border-army-bg rounded-xl text-xs font-black uppercase tracking-normal outline-none focus:border-army-dark transition-all"
                >
                  <option value="all">ทุกสถานะ</option>
                  <option value="pending">รับคำสั่งซื้อ</option>
                  <option value="verifying">ดำเนินการคำสั่งซื้อ</option>
                  <option value="preparing">กำลังจัดส่ง</option>
                  <option value="completed">จัดส่งสำเร็จ</option>
                  <option value="cancelled">ยกเลิก</option>
                </select>
                <select
                  value={filterCenter}
                  onChange={(e) => {
                    setFilterCenter(e.target.value);
                    setFilterSchool("all");
                  }}
                  className="px-4 py-3 bg-army-bg border-2 border-army-bg rounded-xl text-xs font-black uppercase tracking-normal outline-none focus:border-army-dark transition-all"
                >
                  <option value="all">ทุกศูนย์</option>
                  {trainingCenters.map((center) => (
                    <option key={center.id || center.name} value={center.name}>
                      {center.name}
                    </option>
                  ))}
                </select>
                <select
                  value={filterSchool}
                  onChange={(e) => setFilterSchool(e.target.value)}
                  className="px-4 py-3 bg-army-bg border-2 border-army-bg rounded-xl text-xs font-black uppercase tracking-normal outline-none focus:border-army-dark transition-all"
                >
                  <option value="all">ทุกโรงเรียน</option>
                  {filterCenter !== "all" &&
                    schools
                      .filter((s) => s.trainingCenterName === filterCenter)
                      .map((school) => (
                        <option key={school.id || school.name} value={school.name}>
                          {school.name}
                        </option>
                      ))}
                </select>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                  className="px-4 py-3 bg-army-bg border-2 border-army-bg rounded-xl text-xs font-black uppercase tracking-normal outline-none focus:border-army-dark transition-all"
                >
                  <option value="">เรียงตาม</option>
                  <option value="asc">เรียงชื่อ ก-ฮ</option>
                  <option value="desc">เรียงชื่อ ฮ-ก</option>
                </select>
                <select
                  value={filterGender}
                  onChange={(e) => setFilterGender(e.target.value)}
                  className="px-4 py-3 bg-army-bg border-2 border-army-bg rounded-xl text-xs font-black uppercase tracking-normal outline-none focus:border-army-dark transition-all"
                >
                  <option value="all">ทุกเพศ</option>
                  <option value="ชาย">ชาย</option>
                  <option value="หญิง">หญิง</option>
                </select>
                <select
                  value={filterProduct}
                  onChange={(e) => {
                    setFilterProduct(e.target.value);
                    setFilterSize("all");
                  }}
                  className="px-4 py-3 bg-army-bg border-2 border-army-bg rounded-xl text-xs font-black uppercase tracking-normal outline-none focus:border-army-dark transition-all"
                >
                  <option value="all">ทุกรายการสินค้า</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <select
                  value={filterSize}
                  onChange={(e) => setFilterSize(e.target.value)}
                  className="px-4 py-3 bg-army-bg border-2 border-army-bg rounded-xl text-xs font-black uppercase tracking-normal outline-none focus:border-army-dark transition-all"
                >
                  <option value="all">ทุก Size</option>
                  {filterProduct !== "all" &&
                    (
                      products.find((p) => p.name === filterProduct)?.sizes ||
                      []
                    ).map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                </select>
                <div className="relative">
                  <DatePicker
                    selected={filterDate}
                    onChange={(date) => setFilterDate(date)}
                    dateFormat="dd/MM/yyyy"
                    placeholderText="เลือกวันที่"
                    isClearable
                    className="w-32 px-4 py-3 bg-army-bg border-2 border-army-bg rounded-xl text-xs font-black uppercase tracking-tight outline-none focus:border-army-dark transition-all cursor-pointer"
                    locale={th}
                    popperClassName="z-[9999]"
                  />
                  {!filterDate && (
                    <Calendar
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-army-muted pointer-events-none"
                      size={14}
                    />
                  )}
                </div>
                <button
                  onClick={handleExportToExcel}
                  className="flex items-center space-x-2 px-6 py-3 bg-army-dark text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-army-primary transition-all shadow-lg"
                >
                  <Download size={14} />
                  <span>ส่งออก Excel</span>
                </button>
              </div>

              {selectedOrderIds.length > 0 && (
                <div className="p-4 bg-army-bg border-b-2 border-army-dark flex items-center justify-between">
                  <p className="text-xs font-black text-army-dark uppercase tracking-normal">
                    เลือกแล้ว {selectedOrderIds.length} รายการ
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleBulkDelete}
                      className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-sm"
                    >
                      <Trash2 size={14} />
                      <span>ลบที่เลือก</span>
                    </button>
                    <select
                      onChange={(e) =>
                        bulkUpdateStatus(e.target.value as OrderStatus)
                      }
                      className="px-4 py-2 bg-white border-2 border-army-dark rounded-lg text-xs font-black uppercase tracking-normal outline-none"
                    >
                      <option value="">เลือกสถานะใหม่</option>
                      <option value="pending">รับคำสั่งซื้อ</option>
                      <option value="verifying">ดำเนินการคำสั่งซื้อ</option>
                      <option value="preparing">กำลังจัดส่ง</option>
                      <option value="completed">จัดส่งสำเร็จ</option>
                      <option value="cancelled">ยกเลิก</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-army-bg text-army-muted text-[10px] font-black uppercase tracking-[0.2em]">
                    <tr>
                      <th className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={
                            selectedOrderIds.length === filteredOrders.length &&
                            filteredOrders.length > 0
                          }
                          onChange={(e) =>
                            setSelectedOrderIds(
                              e.target.checked
                                ? filteredOrders.map((o) => o.id)
                                : [],
                            )
                          }
                        />
                      </th>
                      <th className="px-6 py-4">หมายเลขรายการ</th>
                      <th className="px-6 py-4">ชื่อกำลังพล / หน่วยฝึก</th>
                      <th className="px-6 py-4">ยอดรวม</th>
                      <th className="px-6 py-4">การชำระเงิน</th>
                      <th className="px-6 py-4">สถานะ</th>
                      <th className="px-6 py-4">วันที่สั่งซื้อ</th>
                      <th className="px-6 py-4 text-right">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-army-bg">
                    {filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((order, idx) => (
                      <tr
                        key={order.id ? `${order.id}-${idx}` : `order-${idx}`}
                        className={cn(
                          "hover:bg-army-bg/50 transition-colors group",
                          order.status === "completed" && "bg-emerald-50",
                        )}
                      >
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedOrderIds.includes(order.id)}
                            onChange={(e) =>
                              setSelectedOrderIds(
                                e.target.checked
                                  ? [...selectedOrderIds, order.id]
                                  : selectedOrderIds.filter(
                                      (id) => id !== order.id,
                                    ),
                              )
                            }
                          />
                        </td>
                        <td className="px-6 py-4 font-mono text-xs font-black text-army-light group-hover:text-army-dark">
                          #{order.id.slice(0, 8).toUpperCase()}
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs font-black text-army-dark uppercase tracking-tight">
                            {order.fullName}
                          </p>
                          <p className="text-xs font-black text-army-muted uppercase tracking-normal mt-1">
                            {order.school}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-mono font-black text-army-dark">
                            {formatPrice(getOrderAmount(order))}
                          </p>
                          <p className="text-[10px] font-black text-army-muted uppercase tracking-normal mt-1">
                            {order.items.length} รายการ
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            <span className="inline-block text-[10px] font-black text-army-muted uppercase tracking-normal">
                              {order.paymentMethod === "transfer"
                                ? "โอนเงิน"
                                : "QR"}
                            </span>
                            <div className="flex flex-col gap-1 items-stretch ml-2">
                              {(() => {
                                const slipContent =
                                  order.slipUrl ||
                                  order.paymentRef ||
                                  recoveredSlips[order.id];
                                if (!slipContent) {
                                  return (
                                    <div className="relative">
                                      <input
                                        type="file"
                                        accept="image/*"
                                        id={`upload-slip-${order.id}`}
                                        className="hidden"
                                        onChange={(e) => handleAdminUploadSlip(order.id, e)}
                                      />
                                      <label
                                        htmlFor={`upload-slip-${order.id}`}
                                        className="flex flex-col items-center justify-center px-2 py-1.5 rounded-lg border transition-all shadow-sm whitespace-nowrap bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 w-full cursor-pointer"
                                      >
                                        <div className="flex items-center space-x-1">
                                          {uploadingSlipId === order.id ? (
                                             <span className="text-[10px] font-black animate-pulse">กำลังอัปโหลด...</span>
                                          ) : (
                                            <>
                                              <Upload size={14} />
                                              <span className="text-[10px] font-black">
                                                เพิ่มสลิป
                                              </span>
                                            </>
                                          )}
                                        </div>
                                      </label>
                                    </div>
                                  );
                                }
                                const isDuplicate =
                                  slipContent &&
                                  duplicateSlips.has(slipContent);
                                const aiBad =
                                  order.aiVerification &&
                                  (!order.aiVerification.isValidSlip ||
                                    !order.aiVerification.amountMatches);
                                const isWarning = isDuplicate || aiBad;
                                return (
                                  <button
                                    onClick={() =>
                                      setViewingSlipUrl(slipContent!)
                                    }
                                    className={cn(
                                      "flex flex-col items-center justify-center px-2 py-1.5 rounded-lg border transition-all shadow-sm whitespace-nowrap w-full",
                                      isWarning
                                        ? "bg-red-100 text-red-700 hover:bg-red-200 border-red-200"
                                        : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200",
                                    )}
                                  >
                                    <div className="flex items-center space-x-1">
                                      <Eye size={14} />
                                      <span className="text-[10px] font-black">
                                        {isWarning
                                          ? "ตรวจสอบสลิป"
                                          : "ดูรูปสลิป"}
                                      </span>
                                    </div>
                                    {isDuplicate && (
                                      <span className="text-[8px] font-bold text-red-600 mt-0.5">
                                        ⚠️ สลิปซ้ำ
                                      </span>
                                    )}
                                    {aiBad && (
                                      <span
                                        className="text-[8px] font-bold text-red-600 mt-0.5"
                                        title={order.aiVerification!.message}
                                      >
                                        ⚠️ ยอดไม่ตรง/ปลอม
                                      </span>
                                    )}
                                  </button>
                                );
                              })()}

                              {(order.slipUrl ||
                                order.paymentRef ||
                                recoveredSlips[order.id]) &&
                                !order.aiVerification && (
                                  <button
                                    onClick={() => handleVerifySlip(order)}
                                    disabled={verifyingSlips[order.id]}
                                    className="flex items-center justify-center space-x-1 w-full px-2 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 rounded-lg transition-all"
                                  >
                                    {verifyingSlips[order.id] ? (
                                      <Loader2
                                        size={12}
                                        className="animate-spin"
                                      />
                                    ) : (
                                      <Sparkles size={12} />
                                    )}
                                    <span className="text-[9px] font-bold">
                                      AI ตรวจสอบ
                                    </span>
                                  </button>
                                )}
                              {(order.slipUrl ||
                                order.paymentRef ||
                                recoveredSlips[order.id]) &&
                                order.aiVerification && (
                                  <div
                                    className={`flex items-center justify-center space-x-1 w-full px-2 py-1 border rounded-lg transition-all ${!order.aiVerification.isValidSlip || !order.aiVerification.amountMatches ? "bg-red-50 text-red-600 border-red-200" : "bg-emerald-50 text-emerald-600 border-emerald-200"}`}
                                    title={order.aiVerification.message}
                                  >
                                    {!order.aiVerification.isValidSlip ||
                                    !order.aiVerification.amountMatches ? (
                                      <XCircle size={12} />
                                    ) : (
                                      <CheckCircle2 size={12} />
                                    )}
                                    <span className="text-[9px] font-bold">
                                      AI ตรวจแล้ว
                                    </span>
                                  </div>
                                )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={cn(
                              "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-normal border-2 whitespace-nowrap",
                              (
                                STATUS_CONFIG[order.status as OrderStatus] ||
                                STATUS_CONFIG.pending
                              ).color,
                            )}
                          >
                            {
                              (
                                STATUS_CONFIG[order.status as OrderStatus] ||
                                STATUS_CONFIG.pending
                              ).label
                            }
                          </span>
                        </td>
                        <td className="px-6 py-4 text-[10px] font-black text-army-muted uppercase tracking-normal">
                          {order.createdAt?.toDate
                            ? format(
                                order.createdAt.toDate(),
                                "d MMM yy HH:mm",
                                { locale: th },
                              ).toUpperCase()
                            : "-"}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => {
                                setSelectedOrder(order);
                                setTrackingInput({
                                  provider: order.shippingProvider || "",
                                  number: order.trackingNumber || "",
                                });
                                setRemarksInput(order.remarks || "");
                              }}
                              className="p-2 text-army-light hover:text-army-dark hover:bg-white border-2 border-transparent hover:border-army-dark rounded-xl transition-all shadow-sm"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteOrder(order.id)}
                              className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 border-2 border-transparent hover:border-red-600 rounded-xl transition-all shadow-sm"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredOrders.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-6 py-12 text-center text-army-muted text-xs font-black uppercase tracking-widest"
                        >
                          ไม่พบข้อมูลคำสั่งซื้อ
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination Controls */}
              {filteredOrders.length > itemsPerPage && (
                <div className="flex justify-between items-center px-6 py-4 bg-white border-t-2 border-army-bg rounded-b-3xl">
                  <span className="text-xs font-black text-army-muted uppercase tracking-widest">
                    แสดง {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredOrders.length)} จากทั้งหมด {filteredOrders.length} รายการ
                  </span>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 border-2 border-army-bg rounded-xl text-xs font-black uppercase tracking-widest text-army-dark hover:bg-army-bg disabled:opacity-50 transition-all"
                    >
                      ก่อนหน้า
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredOrders.length / itemsPerPage), p + 1))}
                      disabled={currentPage === Math.ceil(filteredOrders.length / itemsPerPage)}
                      className="px-4 py-2 border-2 border-army-bg rounded-xl text-xs font-black uppercase tracking-widest text-army-dark hover:bg-army-bg disabled:opacity-50 transition-all"
                    >
                      ถัดไป
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "tracking" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-black text-army-dark uppercase tracking-tighter mb-2">
                  ติดตามพัสดุ
                </h2>
                <p className="text-army-muted font-black uppercase tracking-normal text-xs">
                  จัดการข้อมูลการจัดส่งและหมายเลขพัสดุ
                </p>
              </div>
            </div>

            {/* Tracking Search Section (Customer Style) */}
            <div className="bg-army-bg p-8 rounded-[3rem] border-2 border-army-dark shadow-xl space-y-6">
              <div className="text-center space-y-2">
                <h3 className="text-xl font-black text-army-dark uppercase tracking-tight">
                  ค้นหาพัสดุแบบลูกค้า
                </h3>
                <p className="text-[10px] font-black text-army-muted uppercase tracking-widest">
                  ตรวจสอบสถานะแบบเดียวกับที่ลูกค้าเห็น
                </p>
              </div>

              <div className="flex justify-center">
                <div className="bg-white p-1.5 rounded-2xl inline-flex border-2 border-army-bg">
                  <button
                    onClick={() => setTrackingSearchType("phone")}
                    className={cn(
                      "px-4 py-2 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center space-x-2",
                      trackingSearchType === "phone"
                        ? "bg-army-dark text-white shadow-sm"
                        : "text-army-muted hover:text-army-dark",
                    )}
                  >
                    <Phone size={12} />
                    <span>เบอร์โทร</span>
                  </button>
                  <button
                    onClick={() => setTrackingSearchType("orderId")}
                    className={cn(
                      "px-4 py-2 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center space-x-2",
                      trackingSearchType === "orderId"
                        ? "bg-army-dark text-white shadow-sm"
                        : "text-army-muted hover:text-army-dark",
                    )}
                  >
                    <Hash size={12} />
                    <span>เลขรายการ</span>
                  </button>
                </div>
              </div>

              <form
                onSubmit={handleTrackingSearch}
                className="relative max-w-xl mx-auto"
              >
                <input
                  type={trackingSearchType === "phone" ? "tel" : "text"}
                  placeholder={
                    trackingSearchType === "phone"
                      ? "ระบุเบอร์โทรศัพท์"
                      : "ระบุหมายเลขรายการ"
                  }
                  value={trackingSearchValue}
                  onChange={(e) => setTrackingSearchValue(e.target.value)}
                  className="w-full pl-6 pr-32 py-4 bg-white border-2 border-army-dark rounded-2xl focus:ring-4 focus:ring-army-bg/30 transition-all outline-none font-black text-sm"
                />
                <button
                  type="submit"
                  disabled={trackingSearchLoading || !trackingSearchValue}
                  className="absolute right-2 top-2 bottom-2 px-6 bg-army-dark text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-army-primary transition-all flex items-center space-x-2 disabled:opacity-50"
                >
                  {trackingSearchLoading ? (
                    <Loader2 className="animate-spin" size={14} />
                  ) : (
                    <Search size={14} />
                  )}
                  <span>ตรวจสอบ</span>
                </button>
              </form>
              {trackingSearchError && (
                <p className="text-center text-red-600 font-black uppercase tracking-widest text-[10px]">
                  {trackingSearchError}
                </p>
              )}
            </div>

            {/* Tracking Detail Content (Inline) */}
            <AnimatePresence>
              {viewingTrackingOrder && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="relative w-full overflow-hidden bg-army-bg rounded-[3rem] shadow-2xl border-2 border-army-dark"
                >
                  <button
                    onClick={() => setViewingTrackingOrder(null)}
                    className="absolute right-8 top-8 z-10 p-2 bg-white rounded-full text-army-dark hover:bg-army-bg transition-all border-2 border-army-dark"
                  >
                    <X size={24} />
                  </button>

                  <div className="p-8 space-y-8">
                    <div
                      ref={captureRef}
                      className="bg-army-bg p-8 rounded-[3rem] space-y-8"
                    >
                      {/* Status Card */}
                      <div className="bg-white rounded-[3rem] border-2 border-army-dark shadow-2xl overflow-hidden">
                        <div
                          className={cn(
                            "p-10 text-white flex flex-col sm:flex-row justify-between items-center gap-8",
                            (
                              STATUS_CONFIG[
                                viewingTrackingOrder.status as OrderStatus
                              ] || STATUS_CONFIG.pending
                            ).color,
                          )}
                        >
                          <div className="flex items-center space-x-6">
                            <div className="p-5 bg-white/20 rounded-[1.5rem] backdrop-blur-xl border border-white/30 shadow-xl">
                              {React.createElement(
                                (
                                  STATUS_CONFIG[
                                    viewingTrackingOrder.status as OrderStatus
                                  ] || STATUS_CONFIG.pending
                                ).icon,
                                { size: 40 },
                              )}
                            </div>
                            <div>
                              <p className="text-base font-black uppercase tracking-widest opacity-70 mb-1">
                                สถานะปัจจุบัน
                              </p>
                              <h2 className="text-4xl font-black uppercase tracking-tighter leading-none">
                                {
                                  (
                                    STATUS_CONFIG[
                                      viewingTrackingOrder.status as OrderStatus
                                    ] || STATUS_CONFIG.pending
                                  ).label
                                }
                              </h2>
                            </div>
                          </div>
                          <div className="text-center sm:text-right">
                            <p className="text-base font-black uppercase tracking-widest opacity-70 mb-1">
                              หมายเลขรายการ
                            </p>
                            <p className="text-2xl font-mono font-black">
                              #
                              {viewingTrackingOrder.id
                                .slice(0, 8)
                                .toUpperCase()}
                            </p>
                          </div>
                        </div>

                        <div className="p-10">
                          <p className="text-army-muted font-black uppercase tracking-widest text-base mb-12 text-center sm:text-left leading-relaxed max-w-lg">
                            {
                              (
                                STATUS_CONFIG[
                                  viewingTrackingOrder.status as OrderStatus
                                ] || STATUS_CONFIG.pending
                              ).description
                            }
                          </p>

                          {/* Progress Bar */}
                          <div className="relative flex justify-between items-center mb-16 px-4">
                            <div className="absolute left-0 right-0 h-1 bg-army-bg top-1/2 -translate-y-1/2 z-0" />
                            <div
                              className={cn(
                                "absolute left-0 h-1 top-1/2 -translate-y-1/2 z-0 transition-all duration-1000",
                                (
                                  STATUS_CONFIG[
                                    viewingTrackingOrder.status as OrderStatus
                                  ] || STATUS_CONFIG.pending
                                ).color,
                              )}
                              style={{
                                width:
                                  viewingTrackingOrder.status === "pending"
                                    ? "0%"
                                    : viewingTrackingOrder.status ===
                                        "verifying"
                                      ? "33%"
                                      : viewingTrackingOrder.status ===
                                          "preparing"
                                        ? "66%"
                                        : "100%",
                              }}
                            />

                            {[
                              "pending",
                              "verifying",
                              "preparing",
                              "completed",
                            ].map((s, i) => {
                              const isActive =
                                [
                                  "pending",
                                  "verifying",
                                  "preparing",
                                  "completed",
                                ].indexOf(viewingTrackingOrder.status) >= i;
                              const Config = STATUS_CONFIG[s as OrderStatus];
                              return (
                                <div
                                  key={s}
                                  className="relative z-10 flex flex-col items-center"
                                >
                                  <div
                                    className={cn(
                                      "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 border-2",
                                      isActive
                                        ? Config.color +
                                            " text-white border-transparent shadow-xl"
                                        : "bg-white border-army-bg text-army-light",
                                    )}
                                  >
                                    {isActive ? (
                                      <CheckCircle2 size={24} />
                                    ) : (
                                      <div className="w-2 h-2 bg-army-bg rounded-full" />
                                    )}
                                  </div>
                                  <span
                                    className={cn(
                                      "absolute -bottom-8 text-base font-black uppercase tracking-widest whitespace-nowrap",
                                      isActive
                                        ? "text-army-dark"
                                        : "text-army-light",
                                    )}
                                  >
                                    {Config.label.split(" ")[0]}
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
                                {viewingTrackingOrder.items.map((item, idx) => (
                                  <div
                                    key={idx}
                                    className="flex justify-between items-start"
                                  >
                                    <div className="flex-grow pr-4">
                                      <p className="text-base font-black text-army-dark uppercase tracking-tight">
                                        {item.name} x {item.quantity}
                                      </p>
                                      {item.size && (
                                        <p className="text-base font-black text-army-muted uppercase tracking-widest mt-0.5">
                                          ขนาด: {formatItemSize(item.name, item.size)}
                                        </p>
                                      )}
                                    </div>
                                    <span className="font-mono font-black text-army-dark text-base">
                                      {formatPrice(item.price * item.quantity)}
                                    </span>
                                  </div>
                                ))}
                                {viewingTrackingOrder.shippingFee !==
                                  undefined && (
                                  <div className="flex justify-between text-base font-black text-army-muted uppercase tracking-widest">
                                    <span>ค่าจัดส่ง</span>
                                    <span className="font-mono">
                                      {viewingTrackingOrder.shippingFee > 0
                                        ? formatPrice(
                                            viewingTrackingOrder.shippingFee,
                                          )
                                        : "ฟรี"}
                                    </span>
                                  </div>
                                )}
                                <div className="pt-6 border-t border-army-bg flex justify-between items-end">
                                  <span className="text-base font-black text-army-dark uppercase tracking-widest">
                                    ยอดรวมสุทธิ
                                  </span>
                                  <span className="text-2xl font-mono font-black text-army-dark tracking-tighter">
                                    {formatPrice(
                                      getOrderAmount(viewingTrackingOrder),
                                    )}
                                  </span>
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
                                  <p className="text-base font-black text-army-dark uppercase tracking-tight">
                                    {viewingTrackingOrder.fullName}
                                  </p>
                                  <p className="text-base font-black text-army-muted uppercase tracking-widest">
                                    โรงเรียน: {viewingTrackingOrder.school}
                                  </p>
                                  <p className="text-base font-black text-army-muted uppercase tracking-widest">
                                    ชั้นปี: {viewingTrackingOrder.year}
                                  </p>
                                  <p className="text-base font-black text-army-muted uppercase tracking-widest flex items-center space-x-2 mt-2 pt-2 border-t border-army-light/20">
                                    <Truck size={14} />
                                    <span>
                                      วิธีการรับ: ส่งไปยังโรงเรียนของท่าน
                                    </span>
                                  </p>
                                </div>
                              </div>

                              <div>
                                <h3 className="text-base font-black text-army-dark uppercase tracking-widest flex items-center space-x-3 mb-4">
                                  <Calendar size={18} />
                                  <span>บันทึกภารกิจ</span>
                                </h3>
                                <div className="bg-army-bg p-6 rounded-[2rem] space-y-2 border border-army-light/10">
                                  <p className="text-base font-black text-army-muted uppercase tracking-widest">
                                    วันที่สั่งซื้อ:{" "}
                                    {viewingTrackingOrder.createdAt?.toDate
                                      ? format(
                                          viewingTrackingOrder.createdAt.toDate(),
                                          "d MMM yyyy HH:mm",
                                          { locale: th },
                                        ).toUpperCase()
                                      : "กำลังโหลด..."}
                                  </p>
                                  <p className="text-base font-black text-army-muted uppercase tracking-widest flex items-center space-x-2">
                                    <CreditCard size={14} />
                                    <span>
                                      การชำระเงิน:{" "}
                                      {viewingTrackingOrder.paymentMethod ===
                                      "transfer"
                                        ? "โอนผ่านธนาคาร"
                                        : "ชำระผ่าน QR"}
                                    </span>
                                  </p>
                                  {viewingTrackingOrder.trackingNumber && (
                                    <div className="mt-4 pt-4 border-t border-army-light/20">
                                      <p className="text-xs font-black text-army-dark uppercase tracking-widest mb-1">
                                        หมายเลขพัสดุ
                                      </p>
                                      <p className="text-xl font-mono font-black text-army-primary">
                                        {viewingTrackingOrder.trackingNumber}
                                      </p>
                                      <p className="text-[10px] font-black text-army-muted uppercase tracking-widest">
                                        {viewingTrackingOrder.shippingProvider}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-center pb-8">
                      <button
                        onClick={handleSaveTrackingImage}
                        className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-base hover:bg-emerald-700 transition-all shadow-xl flex items-center space-x-3"
                      >
                        <Upload size={20} className="rotate-180" />
                        <span>บันทึกภาพข้อมูลการสั่งซื้อ</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-black text-army-dark uppercase tracking-tighter mb-2">
                  ตั้งค่าระบบ
                </h2>
                <p className="text-army-muted font-black uppercase tracking-widest text-[10px]">
                  จัดการข้อมูลการชำระเงินและค่าจัดส่ง
                </p>
              </div>
              <button
                onClick={syncAllToSheets}
                disabled={syncing}
                className="flex items-center space-x-3 px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-50 shadow-lg"
              >
                {syncing ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <RefreshCw size={20} />
                )}
                <span>
                  {syncing ? "กำลังซิงค์..." : "ซิงค์ข้อมูลลง Google Sheets"}
                </span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Payment Settings Panel */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-8 rounded-[3rem] border-2 border-army-dark shadow-xl"
              >
                <div className="mb-8">
                  <h3 className="text-xl font-black text-army-dark uppercase tracking-tight">
                    ช่องทางการชำระเงิน
                  </h3>
                  <p className="text-army-muted font-black uppercase tracking-widest text-[8px]">
                    ข้อมูลบัญชีธนาคารและ QR Code
                  </p>
                </div>

                <form onSubmit={saveSettings} className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-army-muted uppercase tracking-widest">
                      ชื่อธนาคาร
                    </label>
                    <input
                      required
                      type="text"
                      value={paymentSettings.bankName}
                      onChange={(e) =>
                        setPaymentSettings({
                          ...paymentSettings,
                          bankName: e.target.value,
                        })
                      }
                      placeholder="เช่น ธนาคารกรุงไทย"
                      className="w-full px-6 py-4 bg-army-bg border-2 border-army-bg rounded-2xl focus:border-army-primary transition-all outline-none font-bold"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-army-muted uppercase tracking-widest">
                      เลขที่บัญชี
                    </label>
                    <input
                      required
                      type="text"
                      value={paymentSettings.accountNumber}
                      onChange={(e) =>
                        setPaymentSettings({
                          ...paymentSettings,
                          accountNumber: e.target.value,
                        })
                      }
                      placeholder="เช่น 123-4-56789-0"
                      className="w-full px-6 py-4 bg-army-bg border-2 border-army-bg rounded-2xl focus:border-army-primary transition-all outline-none font-bold"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-army-muted uppercase tracking-widest">
                      ชื่อบัญชี
                    </label>
                    <input
                      required
                      type="text"
                      value={paymentSettings.accountName}
                      onChange={(e) =>
                        setPaymentSettings({
                          ...paymentSettings,
                          accountName: e.target.value,
                        })
                      }
                      placeholder="เช่น ร้านค้าสวัสดิการ นศท."
                      className="w-full px-6 py-4 bg-army-bg border-2 border-army-bg rounded-2xl focus:border-army-primary transition-all outline-none font-bold"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-army-muted uppercase tracking-widest">
                      ที่อยู่รูปภาพ QR Code (Image URL)
                    </label>
                    <input
                      type="url"
                      value={paymentSettings.qrCodeUrl}
                      onChange={(e) =>
                        setPaymentSettings({
                          ...paymentSettings,
                          qrCodeUrl: e.target.value,
                        })
                      }
                      placeholder="https://example.com/qr-code.jpg"
                      className="w-full px-6 py-4 bg-army-bg border-2 border-army-bg rounded-2xl focus:border-army-primary transition-all outline-none font-bold"
                    />
                    <p className="text-[10px] text-army-muted leading-relaxed">
                      * โปรดนำรูป QR Code
                      ไปฝากไว้ที่เว็บฝากรูปแล้วนำลิงก์มาวางที่นี่
                    </p>
                  </div>

                  {paymentSettings.qrCodeUrl && (
                    <div className="p-6 bg-army-bg rounded-2xl border-2 border-army-light/10 flex flex-col items-center relative">
                      <button
                        type="button"
                        onClick={() =>
                          setPaymentSettings({
                            ...paymentSettings,
                            qrCodeUrl: "",
                          })
                        }
                        className="absolute top-4 right-4 p-2 bg-white text-red-500 rounded-xl hover:bg-red-50 transition-all shadow-sm"
                      >
                        <XCircle size={20} />
                      </button>
                      <p className="text-[8px] font-black text-army-muted uppercase tracking-widest mb-4">
                        ตัวอย่าง QR Code
                      </p>
                      <img
                        src={paymentSettings.qrCodeUrl}
                        alt="QR Preview"
                        className="w-40 h-40 object-contain bg-white p-2 rounded-xl border border-army-light/20"
                        onError={(e) =>
                          (e.currentTarget.style.display = "none")
                        }
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="w-full tactical-button py-6 rounded-2xl flex items-center justify-center space-x-4 disabled:opacity-50"
                  >
                    {savingSettings ? (
                      <Loader2 className="animate-spin" size={24} />
                    ) : (
                      <>
                        <Save size={24} />
                        <span>บันทึกข้อมูลการชำระเงิน</span>
                      </>
                    )}
                  </button>
                </form>
              </motion.div>

              {/* Shipping Settings Panel */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white p-8 rounded-[3rem] border-2 border-army-dark shadow-xl h-fit"
              >
                <div className="mb-8">
                  <h3 className="text-xl font-black text-army-dark uppercase tracking-tight">
                    การจัดส่ง
                  </h3>
                  <p className="text-army-muted font-black uppercase tracking-widest text-[8px]">
                    ตั้งค่าค่าธรรมเนียมการจัดส่ง
                  </p>
                </div>

                <form onSubmit={saveSettings} className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-army-muted uppercase tracking-widest">
                      ค่าจัดส่ง (บาท)
                    </label>
                    <input
                      required
                      type="number"
                      min="0"
                      value={paymentSettings.shippingFee}
                      onChange={(e) =>
                        setPaymentSettings({
                          ...paymentSettings,
                          shippingFee: Number(e.target.value),
                        })
                      }
                      placeholder="เช่น 50"
                      className="w-full px-6 py-4 bg-army-bg border-2 border-army-bg rounded-2xl focus:border-army-primary transition-all outline-none font-bold"
                    />
                  </div>

                  <div className="p-6 bg-army-bg rounded-2xl border-2 border-army-light/10">
                    <p className="text-[10px] font-black text-army-dark uppercase tracking-widest mb-2">
                      คำแนะนำ
                    </p>
                    <p className="text-[10px] font-medium text-army-muted leading-relaxed">
                      ค่าจัดส่งนี้จะถูกนำไปรวมกับยอดสั่งซื้อทั้งหมดในหน้าชำระเงิน
                      หากต้องการให้ส่งฟรี ให้ตั้งค่าเป็น 0
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="w-full tactical-button py-6 rounded-2xl flex items-center justify-center space-x-4 disabled:opacity-50"
                  >
                    {savingSettings ? (
                      <Loader2 className="animate-spin" size={24} />
                    ) : (
                      <>
                        <Save size={24} />
                        <span>บันทึกค่าจัดส่ง</span>
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            </div>
          </div>
        )}

        {activeTab === "schools" && (
          <SchoolManagement
            trainingCenters={trainingCenters}
            schools={schools}
          />
        )}
        {activeTab === "print_orders" && (
          <PrintOrdersManagement orders={orders} setOrders={setOrders} />
        )}
        {activeTab === "embroidery" && (
          <EmbroideryManagement
            orders={orders}
            onRefresh={() => setRefreshTrigger((prev) => prev + 1)}
            isRefreshing={loading}
          />
        )}
        {activeTab === "admins" && <AdminManagement />}
      </div>

      {/* Order Detail Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedOrder(null)}
              className="absolute inset-0 bg-army-dark/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="relative bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col border-4 border-army-dark"
            >
              <div
                className={cn(
                  "p-6 sm:p-8 border-b-2 border-army-bg flex justify-between items-center",
                  selectedOrder.status === "completed"
                    ? "bg-emerald-50"
                    : "bg-army-bg/50",
                )}
              >
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-army-dark uppercase tracking-tighter">
                    ข้อมูลภารกิจ
                  </h3>
                  <p className="text-[10px] text-army-muted font-mono font-black mt-1 uppercase tracking-widest">
                    #{selectedOrder.id.toUpperCase()}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="p-2 hover:bg-white border-2 border-transparent hover:border-army-dark rounded-xl transition-all text-army-muted hover:text-army-dark"
                >
                  <XCircle size={24} />
                </button>
              </div>

              <div className="p-6 sm:p-8 overflow-y-auto flex-grow space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left Column: Status & Tracking */}
                  <div className="space-y-8">
                    {/* Order Status Update */}
                    <div className="bg-army-bg p-6 rounded-[2rem] border-2 border-army-light/20">
                      <label className="block text-[10px] font-black text-army-dark mb-4 uppercase tracking-widest">
                        อัปเดตสถานะภารกิจ
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {Object.entries(STATUS_CONFIG).map(([key, val]) => (
                          <button
                            key={key}
                            onClick={() =>
                              updateOrderStatus(
                                selectedOrder.id,
                                key as OrderStatus,
                              )
                            }
                            className={cn(
                              "px-3 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest border-2 transition-all",
                              selectedOrder.status === key
                                ? val.color
                                : "bg-white border-army-bg text-army-muted hover:border-army-dark hover:text-army-dark",
                            )}
                          >
                            {val.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Tracking Info Update */}
                    <div className="bg-white p-6 rounded-[2rem] border-2 border-army-bg shadow-sm">
                      <label className="block text-[10px] font-black text-army-dark mb-4 uppercase tracking-widest flex items-center space-x-2">
                        <Truck size={16} />
                        <span>ข้อมูลการจัดส่งพัสดุ</span>
                      </label>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[8px] font-black text-army-muted uppercase tracking-widest">
                            บริษัทขนส่ง
                          </label>
                          <input
                            type="text"
                            value={trackingInput.provider}
                            onChange={(e) =>
                              setTrackingInput({
                                ...trackingInput,
                                provider: e.target.value,
                              })
                            }
                            placeholder="เช่น Kerry, Flash, ไปรษณีย์ไทย"
                            className="w-full px-4 py-2 bg-army-bg border-2 border-army-bg rounded-xl focus:border-army-primary transition-all outline-none font-bold text-xs"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[8px] font-black text-army-muted uppercase tracking-widest">
                            หมายเลขพัสดุ (Tracking Number)
                          </label>
                          <input
                            type="text"
                            value={trackingInput.number}
                            onChange={(e) =>
                              setTrackingInput({
                                ...trackingInput,
                                number: e.target.value,
                              })
                            }
                            placeholder="เช่น TH123456789"
                            className="w-full px-4 py-2 bg-army-bg border-2 border-army-bg rounded-xl focus:border-army-primary transition-all outline-none font-bold text-xs font-mono"
                          />
                        </div>
                        <button
                          onClick={() => saveTrackingInfo(selectedOrder.id)}
                          className="w-full py-3 bg-army-dark text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-army-primary transition-all"
                        >
                          บันทึกข้อมูลจัดส่ง
                        </button>
                      </div>
                    </div>

                    {/* Remarks Update */}
                    <div className="bg-white p-6 rounded-[2rem] border-2 border-army-bg shadow-sm">
                      <label className="block text-[10px] font-black text-army-dark mb-4 uppercase tracking-widest flex items-center space-x-2">
                        <FileText size={16} />
                        <span>หมายเหตุ (Admin)</span>
                      </label>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <textarea
                            rows={3}
                            value={remarksInput}
                            onChange={(e) => setRemarksInput(e.target.value)}
                            placeholder="รายละเอียดเพิ่มเติม, ปัญหา, หรือข้อมูลอื่นๆ"
                            className="w-full px-4 py-3 bg-army-bg border-2 border-army-bg rounded-xl focus:border-army-primary transition-all outline-none font-bold text-xs resize-none"
                          />
                        </div>
                        <button
                          onClick={() => saveOrderRemarks(selectedOrder.id)}
                          className="w-full py-3 bg-army-dark text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-army-primary transition-all"
                        >
                          บันทึกหมายเหตุ
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Customer & Payment Info */}
                  <div className="space-y-8">
                    <div>
                      <h4 className="text-[10px] font-black text-army-dark mb-4 uppercase tracking-widest border-b-2 border-army-dark pb-2 inline-block">
                        ข้อมูลกำลังพล
                      </h4>
                      <div className="space-y-2 text-[10px] font-black uppercase tracking-widest bg-army-bg p-4 rounded-2xl">
                        <p className="flex justify-between">
                          <span className="text-army-muted">ชื่อ:</span>{" "}
                          <span className="text-army-dark">
                            {selectedOrder.fullName}
                          </span>
                        </p>
                        <p className="flex justify-between">
                          <span className="text-army-muted">ศูนย์ฝึก:</span>{" "}
                          <span className="text-army-dark">
                            {selectedOrder.trainingCenter}
                          </span>
                        </p>
                        <p className="flex justify-between">
                          <span className="text-army-muted">โรงเรียน:</span>{" "}
                          <span className="text-army-dark">
                            {selectedOrder.school}
                          </span>
                        </p>
                        <p className="flex justify-between">
                          <span className="text-army-muted">ชั้นปี:</span>{" "}
                          <span className="text-army-dark">
                            {selectedOrder.year}
                          </span>
                        </p>
                        <p className="flex justify-between">
                          <span className="text-army-muted">เพศ:</span>{" "}
                          <span className="text-army-dark">
                            {selectedOrder.gender}
                          </span>
                        </p>
                        <p className="flex justify-between">
                          <span className="text-army-muted">ส่วนสูง:</span>{" "}
                          <span className="text-army-dark">
                            {selectedOrder.height} ซม.
                          </span>
                        </p>
                        <p className="flex justify-between">
                          <span className="text-army-muted">เบอร์โทร:</span>{" "}
                          <span className="text-army-dark">
                            {selectedOrder.phone}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black text-army-dark mb-4 uppercase tracking-widest border-b-2 border-army-dark pb-2 inline-block">
                        ข้อมูลการชำระเงิน
                      </h4>
                      <div className="space-y-2 text-[10px] font-black uppercase tracking-widest bg-army-bg p-4 rounded-2xl">
                        <p className="flex justify-between">
                          <span className="text-army-muted">วิธีการ:</span>{" "}
                          <span className="text-army-dark">
                            {selectedOrder.paymentMethod === "transfer"
                              ? "โอนเงิน"
                              : "QR"}
                          </span>
                        </p>
                        {(() => {
                          const drawSlip =
                            selectedOrder.paymentRef ||
                            recoveredSlips[selectedOrder.id];
                          if (!drawSlip) return null;
                          return (
                            <div className="flex flex-col space-y-2 mt-4 pt-4 border-t border-army-light/20">
                              <span className="text-army-muted">
                                อ้างอิงหลักฐานการโอน:
                              </span>
                              {String(drawSlip)
                                .toLowerCase()
                                .startsWith("http") ||
                              String(drawSlip)
                                .toLowerCase()
                                .startsWith("data:") ? (
                                <a
                                  href={drawSlip}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block relative group overflow-hidden rounded-xl border-2 border-army-light/10"
                                >
                                  <img
                                    src={drawSlip}
                                    alt="Slip"
                                    className="w-full max-h-48 object-cover group-hover:scale-105 transition-transform"
                                  />
                                  <div className="absolute inset-0 bg-army-dark/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <span className="text-white text-xs font-bold uppercase tracking-widest drop-shadow-md">
                                      คลิกเพื่อดูรูปเต็ม
                                    </span>
                                  </div>
                                </a>
                              ) : (
                                <span
                                  className="text-army-dark truncate block w-full overflow-hidden text-ellipsis"
                                  title={drawSlip}
                                >
                                  {String(drawSlip)
                                    .toLowerCase()
                                    .startsWith("data:")
                                    ? "รูปสลิปถูกแนบมาแล้ว"
                                    : drawSlip}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                        {selectedOrder.subtotal !== undefined && (
                          <p className="flex justify-between">
                            <span className="text-army-muted">
                              ยอดรวมสินค้า:
                            </span>{" "}
                            <span className="text-army-dark">
                              {formatPrice(selectedOrder.subtotal)}
                            </span>
                          </p>
                        )}
                        {selectedOrder.shippingFee !== undefined && (
                          <p className="flex justify-between">
                            <span className="text-army-muted">ค่าจัดส่ง:</span>{" "}
                            <span className="text-army-dark">
                              {selectedOrder.shippingFee > 0
                                ? formatPrice(selectedOrder.shippingFee)
                                : "ฟรี"}
                            </span>
                          </p>
                        )}
                        <p className="flex justify-between items-end mt-2 pt-2 border-t border-army-light/20">
                          <span className="text-army-muted">ยอดสุทธิ:</span>{" "}
                          <span className="text-xl font-mono font-black text-army-dark tracking-tighter">
                            {formatPrice(getOrderAmount(selectedOrder))}
                          </span>
                        </p>

                        <div className="mt-6 pt-6 border-t border-army-light/20">
                          <h5 className="text-[8px] font-black text-army-dark uppercase tracking-widest mb-3 flex items-center space-x-2">
                            <CheckCircle2
                              size={12}
                              className="text-emerald-600"
                            />
                            <span>จุดตรวจสอบสลิป (Verification Checklist)</span>
                          </h5>
                          <ul className="space-y-2">
                            {[
                              "ตรวจสอบวันที่และเวลาโอน",
                              "ชื่อผู้รับเงินถูกต้อง",
                              "ยอดเงินตรงตามใบสั่งซื้อ",
                              "เลขที่รายการไม่ซ้ำซ้อน",
                            ].map((check, i) => (
                              <li
                                key={i}
                                className="flex items-center space-x-2 text-[8px] font-bold text-army-muted uppercase tracking-widest"
                              >
                                <div className="w-3 h-3 rounded-md border-2 border-army-light/30 flex-shrink-0" />
                                <span>{check}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {(() => {
                          const slipContent =
                            selectedOrder.slipUrl ||
                            selectedOrder.paymentRef ||
                            recoveredSlips[selectedOrder.id];
                          if (!slipContent) {
                            return (
                              <div className="flex flex-col gap-2 mt-4 relative">
                                <input
                                  type="file"
                                  accept="image/*"
                                  id={`upload-slip-drawer-${selectedOrder.id}`}
                                  className="hidden"
                                  onChange={(e) => handleAdminUploadSlip(selectedOrder.id, e)}
                                />
                                <label
                                  htmlFor={`upload-slip-drawer-${selectedOrder.id}`}
                                  className="inline-flex items-center justify-center space-x-2 p-3 rounded-xl transition-all w-full shadow-md bg-blue-50 text-blue-600 shadow-blue-500/20 hover:bg-blue-100 cursor-pointer"
                                >
                                  {uploadingSlipId === selectedOrder.id ? (
                                    <span className="font-bold whitespace-normal text-center text-xs animate-pulse">กำลังอัปโหลด...</span>
                                  ) : (
                                    <>
                                      <Upload size={16} />
                                      <span className="font-bold whitespace-normal text-center text-xs">
                                        คลิกเพื่ออัปโหลดสลิป
                                      </span>
                                    </>
                                  )}
                                </label>
                              </div>
                            );
                          }
                          const isDuplicate =
                            slipContent && duplicateSlips.has(slipContent);
                          const aiBad =
                            selectedOrder.aiVerification &&
                            (!selectedOrder.aiVerification.isValidSlip ||
                              !selectedOrder.aiVerification.amountMatches);
                          const isWarning = isDuplicate || aiBad;
                          return (
                            <div className="flex flex-col gap-2 mt-4">
                              <button
                                onClick={() => setViewingSlipUrl(slipContent!)}
                                className={cn(
                                  "inline-flex items-center justify-center space-x-2 p-3 rounded-xl transition-all w-full shadow-md",
                                  isWarning
                                    ? "bg-red-600 text-white hover:bg-red-700 shadow-red-600/20"
                                    : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-600/20",
                                )}
                              >
                                <Eye size={16} />
                                <span className="font-bold whitespace-normal text-center text-xs">
                                  {isDuplicate
                                    ? "ตรวจสอบสลิป ⚠️ (สลิปซ้ำ)"
                                    : aiBad
                                      ? "ตรวจสอบสลิป ⚠️ (ยอดไม่ตรง/สลิปปลอม)"
                                      : "ดูรูปสลิปโอนเงิน"}
                                </span>
                              </button>
                              {selectedOrder.aiVerification && (
                                <div className="text-[10px] p-2 rounded-lg bg-gray-50 border border-gray-200">
                                  <p>
                                    <b>ผลวิเคราะห์ AI:</b>{" "}
                                    {selectedOrder.aiVerification.message}
                                  </p>
                                  {selectedOrder.aiVerification
                                    .extractedAmount !== null && (
                                    <p>
                                      ตรวจพบยอดเงิน: ฿
                                      {
                                        selectedOrder.aiVerification
                                          .extractedAmount
                                      }
                                    </p>
                                  )}
                                </div>
                              )}
                              {!selectedOrder.aiVerification && (
                                <button
                                  onClick={() =>
                                    handleVerifySlip(selectedOrder)
                                  }
                                  disabled={verifyingSlips[selectedOrder.id]}
                                  className="flex items-center justify-center space-x-2 w-full px-3 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 rounded-lg transition-all"
                                >
                                  {verifyingSlips[selectedOrder.id] ? (
                                    <Loader2
                                      size={16}
                                      className="animate-spin"
                                    />
                                  ) : (
                                    <Sparkles size={16} />
                                  )}
                                  <span className="text-xs font-bold">
                                    ให้ AI ช่วยตรวจสอบ
                                  </span>
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Print Label Buttons */}
                    <div className="flex gap-4">
                      <button
                        onClick={() => handlePrintLabel(selectedOrder)}
                        className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/20"
                      >
                        <Printer size={16} />
                        <span>พิมพ์ใบปะหน้า</span>
                      </button>
                      <button
                        onClick={() => handlePrintLabel(selectedOrder, "pdf")}
                        className="flex-1 py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center justify-center space-x-2 shadow-lg shadow-blue-600/20"
                      >
                        <Download size={16} />
                        <span>EXPORT PDF</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Items List */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-[10px] font-black text-army-dark uppercase tracking-widest border-b-2 border-army-dark pb-2 inline-block">
                      รายการอุปกรณ์
                    </h4>
                    {!editingOrderItems ? (
                      <button
                        onClick={() =>
                          setEditingOrderItems({
                            items: JSON.parse(
                              JSON.stringify(selectedOrder.items),
                            ),
                          })
                        }
                        className="text-[10px] font-black text-blue-600 hover:text-blue-800 uppercase px-3 py-1.5 bg-blue-50/80 rounded-xl hover:bg-blue-100 transition-all border border-blue-200"
                      >
                        แก้ไขขนาด/จำนวน
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingOrderItems(null)}
                          className="text-[10px] font-black text-gray-600 hover:text-gray-800 uppercase px-3 py-1.5 bg-gray-100 rounded-xl transition-all border border-gray-200"
                        >
                          ยกเลิก
                        </button>
                        <button
                          onClick={() => saveOrderItems(selectedOrder.id)}
                          className="text-[10px] font-black text-emerald-600 hover:text-emerald-800 uppercase px-3 py-1.5 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-all shadow-sm border border-emerald-200"
                        >
                          บันทึก
                        </button>
                      </div>
                    )}
                  </div>

                  {editingOrderItems ? (
                    <div className="space-y-4">
                      {editingOrderItems.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center p-4 bg-blue-50/30 rounded-2xl border-2 border-blue-100 shadow-sm animate-in fade-in"
                        >
                          <div className="flex-1 space-y-3 w-full">
                            <p className="text-[10px] font-black text-army-dark uppercase tracking-tight">
                              {item.name}
                            </p>
                            <div className="flex flex-wrap gap-4 items-center">
                              <div className="flex items-center gap-2">
                                <label className="text-[8px] font-black text-army-muted uppercase tracking-widest">
                                  จำนวน:
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) => {
                                    const newItems = [
                                      ...editingOrderItems.items,
                                    ];
                                    newItems[idx].quantity =
                                      parseInt(e.target.value) || 1;
                                    setEditingOrderItems({ items: newItems });
                                  }}
                                  className="w-16 px-2 py-1 text-xs font-bold text-army-dark border-2 border-blue-200 rounded-xl focus:border-blue-400 outline-none transition-all outline-none"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <label className="text-[8px] font-black text-army-muted uppercase tracking-widest">
                                  ขนาด:
                                </label>
                                <input
                                  type="text"
                                  value={item.size || ""}
                                  onChange={(e) => {
                                    const newItems = [
                                      ...editingOrderItems.items,
                                    ];
                                    newItems[idx].size = e.target.value;
                                    setEditingOrderItems({ items: newItems });
                                  }}
                                  className="w-24 px-2 py-1 text-xs font-bold text-army-dark border-2 border-blue-200 rounded-xl focus:border-blue-400 outline-none transition-all"
                                  placeholder="เช่น M, L"
                                />
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t border-blue-100 sm:border-0">
                            <span className="font-mono font-black text-army-dark text-xs">
                              {formatPrice(item.price * item.quantity)}
                            </span>
                            <button
                              onClick={() => {
                                const newItems = editingOrderItems.items.filter(
                                  (_, i) => i !== idx,
                                );
                                setEditingOrderItems({ items: newItems });
                              }}
                              className="p-2 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-xl transition-all border-2 border-transparent hover:border-red-200"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}

                      {editingOrderItems.items.length === 0 && (
                        <div className="p-6 text-center border-2 border-dashed border-red-200 rounded-2xl bg-red-50 text-red-600 font-bold text-[10px] uppercase tracking-widest">
                          ไม่มีสินค้าในคำสั่งซื้อ (ลบหมดแล้ว)
                        </div>
                      )}

                      <div className="p-4 bg-gray-50/80 rounded-2xl border-2 border-dashed border-gray-300 flex flex-col xl:flex-row gap-3 items-stretch xl:items-center">
                        <div className="flex-1 flex flex-col sm:flex-row gap-3">
                          <select
                            id="new-item-product"
                            className="flex-1 px-3 py-2 text-xs font-bold text-army-dark border-2 border-gray-300 focus:border-army-dark outline-none transition-all rounded-xl"
                            defaultValue=""
                          >
                            <option value="" disabled>
                              -- เลือกสินค้าเพิ่มเติม --
                            </option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({formatPrice(p.price)})
                              </option>
                            ))}
                          </select>
                        </div>
                        <button
                          onClick={() => {
                            const selectEl = document.getElementById(
                              "new-item-product",
                            ) as HTMLSelectElement;
                            if (selectEl && selectEl.value) {
                              const p = products.find(
                                (prod) => prod.id === selectEl.value,
                              );
                              if (p) {
                                setEditingOrderItems({
                                  items: [
                                    ...editingOrderItems.items,
                                    {
                                      productId: p.id,
                                      name: p.name,
                                      price: p.price,
                                      quantity: 1,
                                      size: p.sizes?.[0] || "",
                                      gender: "",
                                    },
                                  ],
                                });
                                selectEl.value = "";
                              }
                            }
                          }}
                          className="px-4 py-2.5 bg-army-dark text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-army-primary transition-all whitespace-nowrap shadow-md"
                        >
                          เพิ่มสินค้า
                        </button>
                      </div>

                      <div className="flex justify-between items-center p-4 bg-emerald-50 rounded-2xl border-2 border-emerald-200 text-emerald-900 shadow-sm mt-4">
                        <span className="text-[10px] font-black uppercase tracking-widest">
                          ยอดสุทธิใหม่ (รวมค่าส่ง):
                        </span>
                        <span className="font-mono font-black text-sm tracking-tighter">
                          {formatPrice(
                            editingOrderItems.items.reduce(
                              (sum, item) => sum + item.price * item.quantity,
                              0,
                            ) + (selectedOrder.shippingFee || 0),
                          )}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedOrder.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center p-4 bg-white rounded-2xl border-2 border-army-bg shadow-sm"
                        >
                          <div>
                            <p className="text-[10px] font-black text-army-dark uppercase tracking-tight">
                              {item.name}
                            </p>
                            <p className="text-[8px] font-black text-army-muted uppercase tracking-widest mt-1">
                              จำนวน: {item.quantity}
                              {item.gender ? ` | เพศ: ${item.gender}` : ""}
                              {item.size ? ` | ขนาด: ${formatItemSize(item.name, item.size)}` : ""}
                            </p>
                          </div>
                          <span className="font-mono font-black text-army-dark text-xs">
                            {formatPrice(item.price * item.quantity)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Slip Image Viewer Modal */}
      <AnimatePresence>
        {viewingSlipUrl && (
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setViewingSlipUrl(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative max-w-4xl max-h-[90vh] flex flex-col items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setViewingSlipUrl(null)}
                className="absolute -top-12 right-0 p-2 text-white hover:text-gray-300 transition-colors"
              >
                <X size={24} />
              </button>
              <img
                src={viewingSlipUrl}
                alt="Slip"
                className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
                referrerPolicy="no-referrer"
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
