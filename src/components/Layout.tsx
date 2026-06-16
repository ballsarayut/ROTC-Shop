import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { User, LayoutDashboard, LogOut, Menu, X, Package, Home } from 'lucide-react';
import { googleSheetService } from '../services/googleSheetService';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface LayoutProps {
  children: React.ReactNode;
  cartCount: number;
}

export default function Layout({ children, cartCount }: LayoutProps) {
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const email = localStorage.getItem('adminEmail');
    if (email) {
      setAdminEmail(email);
      setIsAdmin(true);
    } else {
      setAdminEmail(null);
      setIsAdmin(false);
    }
  }, [location.pathname]); // check when route changes so state updates

  const handleLogout = async () => {
    localStorage.removeItem('adminEmail');
    setAdminEmail(null);
    setIsAdmin(false);
    navigate('/');
  };

  const navItems = [
    { name: 'หน้าแรก', path: '/', icon: Home },
    { name: 'ติดตามพัสดุ', path: '/tracking', icon: Package },
  ];

  if (isAdmin) {
    navItems.push({ name: 'ระบบจัดการ', path: '/admin', icon: LayoutDashboard });
  }

  const isAdminRoute = location.pathname.startsWith('/admin');

  return (
    <div className="min-h-screen bg-army-bg flex flex-col font-sans">
      {/* Header */}
      {!isAdminRoute && (
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b-2 border-army-light/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center min-h-[5rem] py-2 gap-2">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-1.5 sm:space-x-4 group min-w-0 flex-shrink">
              <div className="w-8 h-8 sm:w-12 sm:h-12 bg-army-primary rounded-xl sm:rounded-2xl flex-shrink-0 flex items-center justify-center text-white shadow-xl group-hover:scale-105 transition-transform duration-500">
                <Package size={18} className="sm:w-7 sm:h-7" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] sm:text-lg md:text-xl font-black tracking-tight text-army-dark leading-none truncate sm:whitespace-normal">
                  ชมรมผู้กำกับนักศึกษาวิชาทหาร
                </span>
                <span className="hidden sm:block text-[10px] sm:text-xs md:text-sm font-black text-army-muted tracking-wide mt-1 truncate">
                  หน่วยฝึกนักศึกษาวิชาทหาร มณฑลทหารบกที่ 45
                </span>
              </div>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center space-x-1 flex-shrink-0">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center space-x-2 border-2",
                    location.pathname === item.path
                      ? "bg-army-primary text-white border-army-primary shadow-xl shadow-army-primary/20"
                      : "text-army-muted border-transparent hover:bg-army-bg hover:text-army-dark hover:border-army-light/20"
                  )}
                >
                  <item.icon size={14} />
                  <span>{item.name}</span>
                </Link>
              ))}
            </nav>

            {/* Actions */}
            <div className="flex items-center space-x-1.5 sm:space-x-4 flex-shrink-0">
              <Link
                to="/cart"
                className="relative px-3 py-2 sm:px-6 sm:py-3 text-army-muted hover:bg-army-primary hover:text-white rounded-xl sm:rounded-2xl transition-all border-2 border-transparent hover:border-army-primary shadow-sm flex items-center space-x-2"
              >
                <span className="text-xs sm:text-sm font-black uppercase tracking-widest">ตะกร้า</span>
                {cartCount > 0 && (
                  <span className="bg-army-accent text-white text-[8px] sm:text-xs font-black px-1.5 py-0.5 rounded-lg sm:rounded-xl border-2 border-white shadow-lg">
                    {cartCount}
                  </span>
                )}
              </Link>

              {isAdmin ? (
                <div className="flex items-center space-x-1 sm:space-x-4 bg-army-bg p-0.5 sm:p-1 rounded-xl sm:rounded-2xl border-2 border-army-light/10">
                  <div className="w-7 h-7 sm:w-10 sm:h-10 bg-white rounded-lg sm:rounded-xl flex-shrink-0 flex items-center justify-center text-army-primary border-2 border-army-light/20 shadow-sm">
                    <User size={14} className="sm:w-5 sm:h-5" />
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-[10px] sm:text-sm font-black text-army-dark uppercase tracking-tight truncate max-w-[60px] md:max-w-[120px]">
                      {adminEmail?.split('@')[0]}
                    </p>
                    <p className="text-[8px] sm:text-xs font-black text-army-muted uppercase tracking-widest">
                      ผู้ดูแลระบบ
                    </p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-1 sm:p-2 text-army-muted hover:bg-red-50 hover:text-red-600 rounded-lg sm:rounded-xl transition-all border-2 border-transparent hover:border-red-100"
                    title="ออกจากระบบ"
                  >
                    <LogOut size={14} className="sm:w-5 sm:h-5" />
                  </button>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="flex items-center space-x-1.5 px-2 sm:px-6 py-1.5 sm:py-3 bg-army-primary text-white rounded-xl sm:rounded-2xl text-[9px] sm:text-sm font-black uppercase tracking-widest hover:bg-army-dark transition-all shadow-xl hover:shadow-2xl active:scale-95"
                >
                  <User size={14} className="sm:w-4.5 sm:h-4.5" />
                  <span className="hidden sm:block">เข้าสู่ระบบ</span>
                  <span className="block sm:hidden">เข้าระบบ</span>
                </Link>
              )}

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="lg:hidden p-2 sm:p-3 text-army-muted hover:bg-army-bg rounded-2xl transition-all border-2 border-transparent hover:border-army-light/20"
              >
                {isMenuOpen ? <X size={20} className="sm:w-6 sm:h-6" /> : <Menu size={20} className="sm:w-6 sm:h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-white border-t-2 border-army-bg overflow-hidden"
            >
              <div className="px-6 py-8 space-y-3">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMenuOpen(false)}
                    className={cn(
                      "flex items-center space-x-4 px-6 py-4 rounded-2xl text-base font-black uppercase tracking-[0.2em] transition-all border-2",
                      location.pathname === item.path
                        ? "bg-army-primary text-white border-army-primary shadow-xl"
                        : "text-army-muted border-army-bg hover:bg-army-bg hover:text-army-dark hover:border-army-light/20"
                    )}
                  >
                    <item.icon size={20} />
                    <span>{item.name}</span>
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
      )}

      {/* Main Content */}
      <main className="flex-grow">
        {children}
      </main>

      {/* Footer */}
      {!isAdminRoute && (
      <footer className="bg-white border-t-2 border-army-light/10 py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-12">
            <div className="flex flex-col items-center md:items-start">
              <div className="flex items-center space-x-4 mb-6">
                <div className="w-12 h-12 bg-army-primary rounded-2xl flex-shrink-0 flex items-center justify-center text-white shadow-xl">
                  <Package size={28} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xl font-black tracking-tight text-army-dark leading-none uppercase">
                    ชมรมผู้กำกับนักศึกษาวิชาทหาร
                  </span>
                  <span className="text-sm font-black text-army-muted tracking-wide mt-1 uppercase">
                    หน่วยฝึกนักศึกษาวิชาทหาร มณฑลทหารบกที่ 45
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col items-center md:items-end">
              <h4 className="text-base font-black text-army-dark uppercase tracking-[0.3em] mb-4">ติดต่อเรา</h4>
              <a href="tel:0918439948" className="text-army-primary text-xl md:text-2xl font-black uppercase tracking-widest transition-all hover:scale-105">โทร. 091-843-9948</a>
            </div>
          </div>
          
          <div className="mt-16 pt-8 border-t border-army-bg flex flex-col md:flex-row justify-center items-center gap-6">
            <p className="text-army-light text-base font-black uppercase tracking-[0.3em] text-center">
              © {new Date().getFullYear()} ชมรมผู้กำกับนักศึกษาวิชาทหาร มทบ.45. สงวนลิขสิทธิ์.
            </p>
          </div>
        </div>
      </footer>
      )}
    </div>
  );
}
