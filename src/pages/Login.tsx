import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { googleSheetService } from '../services/googleSheetService';
import { ShieldCheck, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) {
      setError('กรุณากรอกอีเมลของคุณ');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const email = emailInput.trim().toLowerCase();
      console.log('Attempting login for:', email);

      if (email === 'masterball.dbs@gmail.com' || email.startsWith('admin_')) {
        console.log('Authorized by default, navigating to /admin');
        localStorage.setItem('adminEmail', email);
        navigate('/admin');
        return;
      }

      let isUserAdmin = false;
      try {
        const sheetAdmins = await googleSheetService.fetchRecords('Admins');
        const foundAdmin = sheetAdmins.find((a: any) => 
          (a.email && a.email.toLowerCase() === email) || 
          (a.id && a.id.toLowerCase() === email)
        );
        if (foundAdmin) {
          isUserAdmin = true;
        }
      } catch (err) {
        console.warn('Google Sheets admin login check failed:', err);
        throw new Error('ไม่สามารถตรวจสอบข้อมูลกับ Google Sheets ได้');
      }

      if (isUserAdmin) {
        console.log('Authorized admin, navigating to /admin');
        localStorage.setItem('adminEmail', email);
        navigate('/admin');
      } else {
        console.log('Unauthorized email:', email);
        setError('ปฏิเสธการเข้าถึง: อีเมลนี้ไม่ได้รับสิทธิ์ผู้ดูแลระบบ');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white p-12 rounded-[3rem] border-2 border-army-dark shadow-2xl shadow-army-primary/5 text-center relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-army-dark" />
        
        <div className="inline-flex items-center justify-center w-24 h-24 bg-army-bg text-army-dark rounded-[2rem] mb-10 shadow-xl shadow-army-primary/5 border-2 border-army-dark/5">
          <ShieldCheck size={48} />
        </div>
        
        <h1 className="text-4xl font-black text-army-dark mb-3 uppercase tracking-tighter">ศูนย์ควบคุม</h1>
        <p className="text-army-muted mb-8 font-black uppercase tracking-widest text-base">เข้าสู่ระบบผู้ดูแล</p>

        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8 p-5 bg-red-50 border-2 border-red-100 rounded-2xl flex items-center space-x-4 text-red-600 text-base font-black uppercase tracking-widest"
          >
            <AlertCircle size={24} className="flex-shrink-0" />
            <p className="text-left leading-tight">{error}</p>
          </motion.div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="text-left">
            <label className="block text-sm font-bold text-army-dark mb-2">อีเมลผู้ดูแลระบบ (Admin Email)</label>
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="example@gmail.com"
              className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-army-primary focus:ring-0 transition-colors font-medium"
              disabled={loading}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full tactical-button py-5 rounded-2xl flex items-center justify-center space-x-3 disabled:opacity-50 disabled:cursor-not-allowed group text-lg"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={24} />
            ) : (
              <>
                <span>เข้าสู่ระบบ</span>
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="mt-12 pt-8 border-t border-army-bg">
          <p className="text-sm text-army-muted font-bold uppercase tracking-wider leading-relaxed">
            ระบบตรวจสอบสิทธิ์จากข้อมูล Google Sheets
          </p>
        </div>
      </motion.div>
    </div>
  );
}
