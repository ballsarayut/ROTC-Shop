import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth, db, isFirestoreQuotaExceeded } from '../firebase';
import { googleSheetService } from '../services/googleSheetService';
import { ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      console.log('Attempting Google login...');
      const result = await signInWithPopup(auth, provider);
      const email = result.user.email;
      console.log('Google login result:', email);

      if (email === 'masterball.dbs@gmail.com' || email?.startsWith('admin_')) {
        console.log('Authorized by default, navigating to /admin');
        navigate('/admin');
        return;
      }

      // Check Firestore for admin role with quota protection
      let isUserAdmin = false;
      try {
        // Sheets Fallback
        const sheetAdmins = await googleSheetService.fetchRecords('Admins');
        const foundAdmin = sheetAdmins.find((a: any) => a.email === email || a.id === email);
        if (foundAdmin) {
          isUserAdmin = true;
        }
      } catch (err) {
        console.warn('Google Sheets fallback for admin login check failed:', err);
      }

      if (isUserAdmin) {
        console.log('Authorized admin, navigating to /admin');
        navigate('/admin');
      } else {
        console.log('Unauthorized email:', email);
        setError('ปฏิเสธการเข้าถึง: คุณไม่มีสิทธิ์เข้าใช้งานส่วนนี้');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message);
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
        <p className="text-army-muted mb-12 font-black uppercase tracking-widest text-base">เฉพาะเจ้าหน้าที่ที่ได้รับอนุญาตเท่านั้น</p>

        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-10 p-5 bg-red-50 border-2 border-red-100 rounded-2xl flex items-center space-x-4 text-red-600 text-base font-black uppercase tracking-widest"
          >
            <AlertCircle size={24} className="flex-shrink-0" />
            <p className="text-left">{error}</p>
          </motion.div>
        )}

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full tactical-button py-6 rounded-2xl flex items-center justify-center space-x-4 disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          {loading ? (
            <Loader2 className="animate-spin" size={24} />
          ) : (
            <>
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
              </div>
              <span>เข้าสู่ระบบด้วย GOOGLE</span>
            </>
          )}
        </button>

        <div className="mt-12 pt-8 border-t border-army-bg">
          <p className="text-base text-army-muted font-black uppercase tracking-[0.2em] leading-relaxed">
            ระบบรักษาความปลอดภัยทำงานอยู่ <br />
            ที่อยู่ IP ของคุณถูกบันทึกเพื่อการตรวจสอบ
          </p>
        </div>
      </motion.div>
    </div>
  );
}
