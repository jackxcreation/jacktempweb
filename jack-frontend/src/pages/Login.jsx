// src/pages/Login.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'; 
import { Link, useNavigate, useLocation } from 'react-router-dom'; 
import { motion, AnimatePresence } from 'framer-motion'; 
import { FcGoogle } from 'react-icons/fc';
import { FaFacebook } from 'react-icons/fa';
import { IoLogoApple } from 'react-icons/io5';
import { 
  FiMail, FiLock, FiEye, FiEyeOff, FiArrowRight, 
  FiShield, FiX, FiCheck, FiCheckCircle, FiAlertCircle, FiWifi, FiInfo, FiArrowLeft
} from 'react-icons/fi';
import { auth, googleProvider } from '../firebase'; 
import { signInWithPopup } from 'firebase/auth';

import { useUser } from '../context/UserContext';
import axiosInstance from '../api/axiosInstance'; 

// --- Static Framer Motion Variants ---
const containerVariants = { 
  hidden: { opacity: 0 }, 
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } } 
};
const itemVariants = { 
  hidden: { opacity: 0, y: 15 }, 
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 400, damping: 30 } } 
};
const formVariants = {
  hidden: { opacity: 0, x: 24, filter: 'blur(6px)' },
  visible: { opacity: 1, x: 0, filter: 'blur(0px)', transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, x: -24, filter: 'blur(6px)', transition: { duration: 0.22, ease: 'easeIn' } }
};
const toastVariants = {
  hidden: { opacity: 0, y: 40, scale: 0.95, x: "-50%" },
  show: { opacity: 1, y: 0, scale: 1, x: "-50%", transition: { type: "spring", stiffness: 450, damping: 25 } },
  exit: { opacity: 0, y: 20, scale: 0.95, x: "-50%", transition: { duration: 0.2, ease: "easeOut" } }
};

// Regex evaluators
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PHONE_REGEX = /^[0-9]{10}$/;

const Login = ({ setIsLoggedIn }) => {
  const [identifier, setIdentifier] = useState(() => {
    try { return localStorage.getItem('jack_remembered_identifier') || ''; } catch { return ''; }
  });

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authMode, setAuthMode] = useState('IDENTIFIER'); 
  const [otp, setOtp] = useState('');
  
  // Resend Timer State
  const [resendTimer, setResendTimer] = useState(0);

  const [status, setStatus] = useState({ type: '', msg: '' });
  const [rememberMe, setRememberMe] = useState(() => {
    try { return !!localStorage.getItem('jack_remembered_identifier'); } catch { return false; }
  });
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
  
  const navigate = useNavigate();
  const location = useLocation(); 
  const from = location.state?.from || '/'; 

  const inputRef = useRef(null);
  const isMounted = useRef(true);

  const { loginUser, socialLoginUser } = useUser();

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Sign In | Jack Essentials — Secure Access";
  }, []);

  // Network synchronization manager
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => {
      setIsOnline(false);
      setStatus({ type: 'error', msg: 'You are currently offline. Please check your network connection.' });
    };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Countdown timer effect
  useEffect(() => {
    if (resendTimer > 0) {
      const timerId = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timerId);
    }
  }, [resendTimer]);

  const checkCapsLock = useCallback((e) => {
    if (typeof e.getModifierState === 'function') {
      setIsCapsLockOn(e.getModifierState('CapsLock'));
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    if (inputRef.current && !identifier) inputRef.current.focus();
    return () => { isMounted.current = false; };
  }, [identifier]);

  // 4-SECOND AUTO-HIDE ERROR LOGIC
  useEffect(() => {
    let timer;
    if (status.msg && status.type === 'error') {
      timer = setTimeout(() => {
        if (isMounted.current) setStatus({ type: '', msg: '' }); 
      }, 4000);
    }
    return () => clearTimeout(timer); 
  }, [status.msg, status.type]); 

  const handleContinue = (e) => {
    e.preventDefault();
    if (!isOnline) {
      setStatus({ type: 'error', msg: 'Connection failed. You are currently offline.' });
      return;
    }
    const cleanInput = identifier.trim();
    if (!cleanInput) return;

    if (EMAIL_REGEX.test(cleanInput)) {
      setAuthMode('PASSWORD');
    } else if (PHONE_REGEX.test(cleanInput.replace(/\D/g, ''))) {
      handleSendWhatsAppOtp(cleanInput.replace(/\D/g, ''));
    } else {
      setStatus({ type: 'error', msg: 'Please enter a valid email address or 10-digit mobile number.' });
    }
  };

  const handlePasswordLogin = useCallback(async (e) => {
    e.preventDefault();
    if (!isOnline) return;

    const trimmedEmail = identifier.trim().replace(/\s+/g, '');
    if (!trimmedEmail || !password) return;

    setStatus({ type: 'loading', msg: 'Authenticating securely...' });
    
    try {
      const res = await loginUser(trimmedEmail, password);
      if (!isMounted.current) return;

      if (res?.isLocked || (res?.message && res.message.includes('LOCKED')) || (res?.error && res.error.includes('LOCKED'))) {
        setStatus({ type: 'error', msg: 'Account Locked! Redirecting to unlock page...' });
        setTimeout(() => {
          if (isMounted.current) navigate(`/unlock-account?email=${encodeURIComponent(trimmedEmail)}`);
        }, 1500);
        return;
      }

      if (res?.success || res?.user) {
        try {
          if (rememberMe) localStorage.setItem('jack_remembered_identifier', trimmedEmail);
          else localStorage.removeItem('jack_remembered_identifier');
        } catch (storageError) {}

        setStatus({ type: 'success', msg: 'Login successful! Redirecting...' });
        if (setIsLoggedIn) setIsLoggedIn(true);
        setTimeout(() => { 
          if (isMounted.current) {
            const destination = (from === '/login' || from === '/login/') ? '/' : from;
            navigate(destination, { replace: true });
          }
        }, 1000);
      } else {
        setStatus({ type: 'error', msg: res?.error || res?.message || 'Invalid email or password.' });
      }
    } catch (error) {
      if (isMounted.current) {
        const backendError = error.response?.data?.error || error.response?.data?.message || error.message || 'Network error.';
        setStatus({ type: 'error', msg: backendError });
      }
    }
  }, [identifier, password, loginUser, navigate, setIsLoggedIn, rememberMe, isOnline, from]);

  const handleSendWhatsAppOtp = async (cleanPhone) => {
    setStatus({ type: 'loading', msg: 'Sending WhatsApp verification code...' });
    try {
      await axiosInstance.post('/whatsapp/send-otp', { phone: `+91${cleanPhone}` });
      if (!isMounted.current) return;
      setAuthMode('WHATSAPP_OTP');
      setResendTimer(30); // Start 30s countdown
      setStatus({ type: 'success', msg: 'OTP sent to your WhatsApp!' });
    } catch (err) {
      if (isMounted.current) {
        setStatus({ type: 'error', msg: err.response?.data?.message || err.message || 'Failed to send WhatsApp OTP.' });
      }
    }
  };

  const handleVerifyWhatsAppOtp = async (e) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      setStatus({ type: 'error', msg: 'Please enter a valid 6-digit OTP.' });
      return;
    }

    const cleanPhone = `+91${identifier.trim().replace(/\D/g, '')}`;
    setStatus({ type: 'loading', msg: 'Verifying code...' });

    try {
      const res = await axiosInstance.post('/whatsapp/verify-otp', { phone: cleanPhone, otp });
      if (!isMounted.current) return;

      if (res.data?.success) {
        // 🔥 Handle New vs Existing Users safely
        if (res.data.isExistingUser === false) {
          setStatus({ type: 'success', msg: 'Verified! Redirecting to complete profile...' });
          setTimeout(() => {
            if (isMounted.current) {
              navigate('/register', { state: { verificationToken: res.data.verificationToken, phone: identifier } });
            }
          }, 1000);
          return;
        }

        // Existing User Flow
        if (res.data?.user) {
          localStorage.setItem('jack_user', JSON.stringify(res.data.user));
        }

        setStatus({ type: 'success', msg: 'Phone verified successfully! Redirecting...' });
        if (setIsLoggedIn) setIsLoggedIn(true);
        
        // 🔥 Prevent redirecting back to /login
        setTimeout(() => {
          if (isMounted.current) {
            const destination = (from === '/login' || from === '/login/') ? '/' : from;
            window.location.href = destination;
          }
        }, 1000);
      } else {
        setStatus({ type: 'error', msg: res.data?.message || 'Invalid OTP code.' });
      }
    } catch (err) {
      if (isMounted.current) {
        setStatus({ type: 'error', msg: err.response?.data?.message || 'Verification failed. Please try again.' });
      }
    }
  };

  const handleSocialLogin = useCallback(async (provider, providerName) => {
    if (!isOnline) {
      setStatus({ type: 'error', msg: `Cannot connect to ${providerName}. You are offline.` });
      return;
    }
    setStatus({ type: 'loading', msg: `Connecting to ${providerName}...` });
    try {
      const result = await signInWithPopup(auth, provider);
      const dbRes = await socialLoginUser(result?.user?.displayName, result?.user?.email, result?.user?.uid);
      
      if (!isMounted.current) return;

      if (dbRes?.isLocked || (dbRes?.message && dbRes.message.includes('LOCKED')) || (dbRes?.error && dbRes.error.includes('LOCKED'))) {
        setStatus({ type: 'error', msg: 'Account Locked! Redirecting to unlock page...' });
        setTimeout(() => { if (isMounted.current) navigate(`/unlock-account?email=${encodeURIComponent(result?.user?.email)}`); }, 1500);
        return;
      }
      
      if (dbRes?.success || dbRes?.user) {
        setStatus({ type: 'success', msg: `Welcome back, ${result?.user?.displayName?.split(' ')[0] || 'User'}!` });
        if (setIsLoggedIn) setIsLoggedIn(true);
        setTimeout(() => { 
          if (isMounted.current) {
            const destination = (from === '/login' || from === '/login/') ? '/' : from;
            navigate(destination, { replace: true });
          }
        }, 1000);
      } else {
        setStatus({ type: 'error', msg: dbRes?.error || dbRes?.message || `Account sync failed.` });
      }
    } catch (error) {
      if (!isMounted.current) return;
      if (error?.code === 'auth/popup-closed-by-user') {
        setStatus({ type: '', msg: '' }); 
      } else {
        const backendError = error.response?.data?.error || error.response?.data?.message || `Connection to ${providerName} failed.`;
        setStatus({ type: 'error', msg: backendError });
      }
    }
  }, [socialLoginUser, navigate, setIsLoggedIn, isOnline, from]);

  const isLoading = status.type === 'loading';
  const isSuccess = status.type === 'success';

  return (
    <div className="flex min-h-screen bg-[#F6F7FB] font-sans relative overflow-hidden selection:bg-[#FF4500]/20 selection:text-slate-900">
      
      {/* ================= LEFT PANEL — BRAND ================= */}
      <div className="hidden lg:flex lg:w-[45%] bg-[#080B12] text-white flex-col justify-between p-14 xl:p-16 relative overflow-hidden z-10 select-none">
        <div 
          className="absolute inset-0 opacity-[0.12] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.35) 1px, transparent 1px)', backgroundSize: '28px 28px' }}
        />
        <motion.div 
          animate={{ scale: [1, 1.12, 1], opacity: [0.18, 0.28, 0.18], x: [0, 30, 0] }} 
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }} 
          className="absolute top-[-15%] right-[-15%] w-[620px] h-[620px] bg-[#FF4500] rounded-full filter blur-[160px] pointer-events-none"
        />
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.12, 0.22, 0.12], y: [0, -30, 0] }} 
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut", delay: 1.5 }} 
          className="absolute bottom-[-25%] left-[-15%] w-[560px] h-[560px] bg-indigo-600 rounded-full filter blur-[160px] pointer-events-none"
        />
        <div className="absolute top-0 right-0 h-full w-px bg-gradient-to-b from-transparent via-white/10 to-transparent pointer-events-none" />

        <motion.div 
          initial={{ opacity: 0, y: -16 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} 
          className="z-10 flex items-center gap-3"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF4500] opacity-60"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#FF4500]"></span>
          </span>
          <span className="text-[11px] text-slate-400 font-bold tracking-[0.25em] uppercase">Premium D2C Experience</span>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: -30 }} 
          animate={{ opacity: 1, x: 0 }} 
          transition={{ duration: 1, delay: 0.2, ease: [0.22, 1, 0.36, 1] }} 
          className="z-10 relative"
        >
          <h1 className="text-6xl xl:text-7xl font-black tracking-[-0.03em] leading-[0.98] mb-8">
            Elevate <br />
            <span className="bg-gradient-to-r from-white via-white to-slate-400 bg-clip-text text-transparent">your lifestyle.</span>
          </h1>
          <motion.div 
            initial={{ width: 0 }} 
            animate={{ width: 72 }} 
            transition={{ duration: 0.8, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="h-1 bg-gradient-to-r from-[#FF4500] to-orange-300 rounded-full mb-8 shadow-[0_0_24px_rgba(255,69,0,0.6)]"
          />
          <p className="text-slate-400 max-w-sm text-lg font-medium leading-relaxed">
            Join 50,000+ shoppers discovering exclusive deals and premium essentials daily.
          </p>

          <motion.div 
            initial={{ opacity: 0, y: 12 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.8, delay: 1 }}
            className="flex items-center gap-5 mt-10 text-[11px] font-bold tracking-wider uppercase text-slate-500"
          >
            <span className="flex items-center gap-2"><FiShield className="text-[#FF4500]" size={14} /> Secure</span>
            <span className="w-1 h-1 rounded-full bg-slate-700" />
            <span className="flex items-center gap-2"><FiLock className="text-[#FF4500]" size={14} /> Encrypted</span>
            <span className="w-1 h-1 rounded-full bg-slate-700" />
            <span className="flex items-center gap-2"><FiCheckCircle className="text-[#FF4500]" size={14} /> 50k+ Shoppers</span>
          </motion.div>
        </motion.div>

        <div className="z-10 mt-auto">
          <Link to="/" className="flex items-center gap-3 w-max group outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded-xl p-1.5 -ml-1.5 transition-colors">
            <span className="text-3xl font-black tracking-tight">J<span className="text-[#FF4500] group-hover:text-white transition-colors duration-300">S</span></span>
            <span className="text-[11px] font-bold tracking-[0.2em] text-slate-500 uppercase group-hover:text-slate-300 transition-colors duration-300 flex items-center gap-1.5">
              <FiArrowLeft size={12} className="group-hover:-translate-x-0.5 transition-transform" /> Return to Store
            </span>
          </Link>
        </div>
      </div>

      {/* ================= RIGHT PANEL — AUTH ================= */}
      <div className="w-full lg:w-[55%] flex flex-col items-center justify-center px-5 py-10 sm:p-8 md:p-12 relative z-20 overflow-hidden">
        <motion.div 
          animate={{ x: [0, 40, 0], y: [0, -20, 0], opacity: [0.35, 0.5, 0.35] }} 
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }} 
          className="absolute -top-32 -right-24 w-[480px] h-[480px] bg-[#FF4500]/25 rounded-full filter blur-[140px] pointer-events-none"
        />
        <motion.div 
          animate={{ x: [0, -30, 0], y: [0, 30, 0], opacity: [0.3, 0.45, 0.3] }} 
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 2 }} 
          className="absolute -bottom-40 -left-24 w-[520px] h-[520px] bg-indigo-500/25 rounded-full filter blur-[150px] pointer-events-none"
        />
        <div 
          className="absolute inset-0 opacity-[0.35] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(rgba(15,23,42,0.08) 1px, transparent 1px)', backgroundSize: '24px 24px' }}
        />

        {/* Offline HUD Banner */}
        <AnimatePresence>
          {!isOnline && (
            <motion.div 
              initial={{ opacity: 0, y: -24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -24, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="absolute top-5 left-5 right-5 sm:left-auto sm:right-8 sm:w-max bg-amber-500 text-white font-bold text-[11px] tracking-wider py-2.5 px-4 rounded-full flex items-center justify-center gap-2 shadow-lg shadow-amber-500/30 z-30 select-none"
            >
              <FiWifi className="animate-pulse" size={15} /> NO NETWORK CONNECTION DETECTED
            </motion.div>
          )}
        </AnimatePresence>

        {/* GLASS CARD */}
        <motion.div 
          variants={containerVariants} 
          initial="hidden" 
          animate="show" 
          layout
          transition={{ layout: { type: 'spring', stiffness: 300, damping: 32 } }}
          className="w-full max-w-[440px] relative rounded-[28px] bg-white/70 backdrop-blur-2xl border border-white/80 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_24px_80px_-20px_rgba(15,23,42,0.18),0_8px_24px_-12px_rgba(15,23,42,0.12)] px-6 py-8 sm:px-10 sm:py-10"
        >
          <div className="absolute top-0 left-10 right-10 h-px bg-gradient-to-r from-transparent via-[#FF4500]/50 to-transparent pointer-events-none" />

          {/* Mobile Logo */}
          <motion.div variants={itemVariants} className="lg:hidden flex flex-col items-center mb-8 select-none">
            <Link to="/" className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center shadow-xl shadow-slate-900/25 hover:scale-105 active:scale-95 transition-transform">
              <span className="text-2xl font-black text-white tracking-tight">J<span className="text-[#FF4500]">S</span></span>
            </Link>
          </motion.div>

          {/* Heading */}
          <motion.div variants={itemVariants} className="mb-8 text-center lg:text-left">
            <AnimatePresence mode="wait">
              <motion.div
                key={authMode}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              >
                <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 rounded-full bg-slate-900/[0.04] border border-slate-900/[0.06] text-[10px] font-bold tracking-[0.2em] uppercase text-slate-500">
                  {authMode === 'WHATSAPP_OTP' ? (
                    <><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Step 2 · WhatsApp</>
                  ) : authMode === 'PASSWORD' ? (
                    <><span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Step 2 · Password</>
                  ) : (
                    <><span className="w-1.5 h-1.5 rounded-full bg-[#FF4500]" /> Step 1 · Identify</>
                  )}
                </div>
                <h2 className="text-3xl sm:text-[2.4rem] font-black text-slate-900 tracking-[-0.03em] leading-tight">
                  {authMode === 'WHATSAPP_OTP' ? 'Verify your code' : authMode === 'PASSWORD' ? 'Enter password' : 'Welcome back'}
                  <span className="text-[#FF4500] select-none ml-1.5">✦</span>
                </h2>
                <p className="text-slate-500 mt-2.5 font-medium text-sm sm:text-[15px] leading-relaxed">
                  {authMode === 'WHATSAPP_OTP' 
                    ? <>Enter the 6-digit code sent to <span className="font-bold text-slate-700">+91 {identifier}</span></>
                    : authMode === 'PASSWORD'
                      ? 'Almost there. Confirm it’s really you.'
                      : 'Enter your email or phone number to sign in securely.'}
                </p>
              </motion.div>
            </AnimatePresence>
          </motion.div>

          {/* 🔥 ANIMATED FORMS CONTAINER 🔥 */}
          <motion.div layout className="relative">
            <AnimatePresence mode="wait">
              
              {/* ================= FLOW 1: ENTER EMAIL OR PHONE ================= */}
              {authMode === 'IDENTIFIER' && (
                <motion.form 
                  key="identifier" 
                  variants={formVariants} initial="hidden" animate="visible" exit="exit"
                  onSubmit={handleContinue} className="space-y-5" noValidate
                >
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition-colors duration-300 z-10">
                      <FiMail size={18} />
                    </div>
                    <input 
                      id="identifier-input"
                      ref={inputRef}
                      type="text" 
                      value={identifier} 
                      onChange={(e) => setIdentifier(e.target.value)} 
                      disabled={isLoading} 
                      autoComplete="username"
                      className="peer w-full pl-[52px] pr-5 pt-6 pb-2.5 h-[64px] bg-white/80 border border-slate-200/90 rounded-2xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 focus:shadow-[0_8px_30px_-12px_rgba(79,70,229,0.35)] outline-none transition-all duration-300 font-semibold text-slate-900 placeholder-transparent shadow-sm disabled:opacity-60" 
                      placeholder="Email or 10-digit Phone Number" 
                      required 
                    />
                    <label 
                      htmlFor="identifier-input" 
                      className="absolute left-[52px] top-1/2 -translate-y-1/2 text-slate-400 font-medium text-[15px] pointer-events-none transition-all duration-300 ease-out peer-focus:top-3.5 peer-focus:translate-y-0 peer-focus:text-[11px] peer-focus:font-bold peer-focus:tracking-wider peer-focus:uppercase peer-focus:text-indigo-600 peer-[:not(:placeholder-shown)]:top-3.5 peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:font-bold peer-[:not(:placeholder-shown)]:tracking-wider peer-[:not(:placeholder-shown)]:uppercase"
                    >
                      Email or Phone Number
                    </label>
                  </div>

                  <motion.button 
                    type="submit" 
                    disabled={!identifier.trim() || isLoading} 
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className="group w-full h-[58px] bg-slate-900 text-white font-bold rounded-2xl outline-none hover:bg-indigo-600 focus-visible:ring-4 focus-visible:ring-indigo-500/30 transition-colors duration-300 shadow-[0_12px_30px_-10px_rgba(15,23,42,0.5)] hover:shadow-[0_16px_40px_-10px_rgba(79,70,229,0.55)] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-900 disabled:hover:shadow-[0_12px_30px_-10px_rgba(15,23,42,0.5)] flex justify-center items-center relative overflow-hidden"
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      {isLoading ? (
                        <motion.div key="loading" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="flex items-center gap-3">
                          <div className="w-5 h-5 border-2 border-white/25 border-t-white rounded-full animate-spin"></div>
                          <span className="text-sm tracking-wide">Checking...</span>
                        </motion.div>
                      ) : (
                        <motion.div key="idle" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="flex items-center gap-2">
                          <span className="tracking-wide">Continue</span>
                          <FiArrowRight size={18} className="group-hover:translate-x-1 transition-transform duration-300" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.button>
                </motion.form>
              )}

              {/* ================= FLOW 2A: PASSWORD ENTRY ================= */}
              {authMode === 'PASSWORD' && (
                <motion.form 
                  key="password" 
                  variants={formVariants} initial="hidden" animate="visible" exit="exit"
                  onSubmit={handlePasswordLogin} className="space-y-5" noValidate
                >
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                    className="flex items-center justify-between bg-white/80 border border-slate-200/80 pl-2 pr-3 py-2 rounded-full shadow-sm"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                        <FiMail size={13} />
                      </span>
                      <span className="text-xs font-bold text-slate-700 truncate max-w-[200px]">{identifier}</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => { setAuthMode('IDENTIFIER'); setPassword(''); }}
                      className="text-[11px] font-bold text-[#FF4500] hover:text-orange-600 flex items-center gap-1 transition-colors px-2 py-1 rounded-full hover:bg-orange-50"
                    >
                      <FiArrowLeft size={11} /> Change
                    </button>
                  </motion.div>

                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition-colors duration-300 z-10">
                      <FiLock size={18} />
                    </div>
                    <input 
                      id="password-input"
                      type={showPassword ? "text" : "password"} 
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)} 
                      onKeyDown={checkCapsLock}
                      onKeyUp={checkCapsLock}
                      disabled={isLoading} 
                      autoComplete="current-password"
                      className="peer w-full pl-[52px] pr-28 pt-6 pb-2.5 h-[64px] bg-white/80 border border-slate-200/90 rounded-2xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 focus:shadow-[0_8px_30px_-12px_rgba(79,70,229,0.35)] outline-none transition-all duration-300 font-semibold text-slate-900 placeholder-transparent shadow-sm disabled:opacity-60" 
                      placeholder="Enter your password" 
                      required 
                      autoFocus
                    />
                    <label 
                      htmlFor="password-input" 
                      className="absolute left-[52px] top-1/2 -translate-y-1/2 text-slate-400 font-medium text-[15px] pointer-events-none transition-all duration-300 ease-out peer-focus:top-3.5 peer-focus:translate-y-0 peer-focus:text-[11px] peer-focus:font-bold peer-focus:tracking-wider peer-focus:uppercase peer-focus:text-indigo-600 peer-[:not(:placeholder-shown)]:top-3.5 peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:font-bold peer-[:not(:placeholder-shown)]:tracking-wider peer-[:not(:placeholder-shown)]:uppercase"
                    >
                      Password
                    </label>
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-1.5 z-10">
                      <AnimatePresence>
                        {isCapsLockOn && (
                          <motion.span 
                            initial={{ opacity: 0, scale: 0.8, x: 6 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: 0.8, x: 6 }}
                            className="text-[10px] bg-amber-500/10 text-amber-600 px-2 py-1 rounded-full font-black border border-amber-500/20 flex items-center gap-1"
                          >
                            <FiInfo size={10}/> CAPS
                          </motion.span>
                        )}
                      </AnimatePresence>
                      <button 
                        type="button" 
                        onClick={() => setShowPassword(!showPassword)} 
                        disabled={isLoading}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 active:scale-90 transition-all duration-200"
                      >
                        {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between px-1">
                    <label className="flex items-center group cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={rememberMe} 
                        onChange={(e) => setRememberMe(e.target.checked)}
                        disabled={isLoading}
                        className="sr-only peer"
                      />
                      <div className="w-[18px] h-[18px] bg-white rounded-md border border-slate-300 peer-checked:bg-slate-900 peer-checked:border-slate-900 peer-focus-visible:ring-4 peer-focus-visible:ring-indigo-500/20 flex items-center justify-center transition-all duration-200 group-hover:border-slate-400 shadow-sm">
                        <AnimatePresence>
                          {rememberMe && (
                            <motion.span initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 600, damping: 25 }}>
                              <FiCheck className="text-white" size={12} strokeWidth={3} />
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </div>
                      <span className="text-xs font-bold text-slate-500 ml-2.5 group-hover:text-slate-700 transition-colors">Remember me</span>
                    </label>

                    <Link to="/forgot-password" className="text-xs font-bold text-[#FF4500] hover:text-orange-600 transition-colors flex items-center gap-1.5 group">
                      <FiShield size={13} className="group-hover:rotate-12 transition-transform" /> Forgot password?
                    </Link>
                  </div>

                  <motion.button 
                    type="submit" 
                    disabled={!password || isLoading} 
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className={`group w-full h-[58px] text-white font-bold rounded-2xl outline-none focus-visible:ring-4 transition-colors duration-500 flex justify-center items-center relative overflow-hidden disabled:cursor-not-allowed ${
                      isSuccess 
                        ? 'bg-emerald-500 shadow-[0_16px_40px_-10px_rgba(16,185,129,0.6)] focus-visible:ring-emerald-500/30' 
                        : 'bg-slate-900 hover:bg-indigo-600 shadow-[0_12px_30px_-10px_rgba(15,23,42,0.5)] hover:shadow-[0_16px_40px_-10px_rgba(79,70,229,0.55)] focus-visible:ring-indigo-500/30 disabled:opacity-40 disabled:hover:bg-slate-900'
                    }`}
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      {isSuccess ? (
                        <motion.div key="success" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }} transition={{ type: 'spring', stiffness: 500, damping: 22 }} className="flex items-center gap-2.5">
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45, ease: 'easeOut', delay: 0.1 }} />
                          </svg>
                          <span className="tracking-wide">Signed in</span>
                        </motion.div>
                      ) : isLoading ? (
                        <motion.div key="loading" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="flex items-center gap-3">
                          <div className="w-5 h-5 border-2 border-white/25 border-t-white rounded-full animate-spin"></div>
                          <span className="text-sm tracking-wide">Authenticating...</span>
                        </motion.div>
                      ) : (
                        <motion.div key="idle" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="flex items-center gap-2">
                          <span className="tracking-wide">Sign in securely</span>
                          <FiArrowRight size={18} className="group-hover:translate-x-1 transition-transform duration-300" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.button>
                </motion.form>
              )}

              {/* ================= FLOW 2B: WHATSAPP OTP ENTRY ================= */}
              {authMode === 'WHATSAPP_OTP' && (
                <motion.form 
                  key="otp" 
                  variants={formVariants} initial="hidden" animate="visible" exit="exit"
                  onSubmit={handleVerifyWhatsAppOtp} className="space-y-5" noValidate
                >
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                    className="flex items-center justify-between bg-emerald-50/80 border border-emerald-200/70 pl-2 pr-3 py-2 rounded-full shadow-sm"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 shadow-[0_0_16px_rgba(16,185,129,0.5)]">
                        <FiCheck size={13} strokeWidth={3} />
                      </span>
                      <span className="text-xs font-bold text-emerald-800">+91 {identifier}</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => { setAuthMode('IDENTIFIER'); setOtp(''); }}
                      className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 transition-colors px-2 py-1 rounded-full hover:bg-emerald-100"
                    >
                      <FiArrowLeft size={11} /> Change
                    </button>
                  </motion.div>

                  <div className="relative group">
                    <label htmlFor="otp-input" className="sr-only">WhatsApp OTP Code</label>
                    <div className="absolute inset-0 grid grid-cols-6 gap-2 sm:gap-2.5 pointer-events-none">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div 
                          key={i} 
                          className={`rounded-2xl border transition-all duration-300 flex items-center justify-center text-2xl font-black text-slate-900 bg-white/80 shadow-sm ${
                            otp.length === i && !isLoading
                              ? 'border-emerald-500 ring-4 ring-emerald-500/10 shadow-[0_8px_24px_-10px_rgba(16,185,129,0.45)]' 
                              : otp[i] ? 'border-emerald-300 bg-emerald-50/60' : 'border-slate-200/90'
                          }`}
                        >
                          <AnimatePresence mode="popLayout">
                            {otp[i] ? (
                              <motion.span key={otp[i] + i} initial={{ scale: 0.4, opacity: 0, y: 6 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.4, opacity: 0 }} transition={{ type: 'spring', stiffness: 600, damping: 24 }}>
                                {otp[i]}
                              </motion.span>
                            ) : otp.length === i && !isLoading ? (
                              <motion.span key="caret" animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity }} className="w-0.5 h-6 bg-emerald-500 rounded-full" />
                            ) : null}
                          </AnimatePresence>
                        </div>
                      ))}
                    </div>
                    <input 
                      id="otp-input"
                      type="text" 
                      inputMode="numeric"
                      maxLength="6"
                      value={otp} 
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} 
                      disabled={isLoading} 
                      className="relative w-full h-[64px] bg-transparent border-0 outline-none text-transparent caret-transparent selection:bg-transparent tracking-[2.4em] pl-6 z-10 disabled:cursor-not-allowed" 
                      placeholder="" 
                      required 
                      autoFocus
                    />
                  </div>

                  <div className="text-center">
                    <button 
                      type="button"
                      onClick={() => handleSendWhatsAppOtp(identifier.trim().replace(/\D/g, ''))}
                      disabled={isLoading || resendTimer > 0}
                      className={`text-xs font-bold transition-colors inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${resendTimer > 0 ? 'text-slate-400 cursor-not-allowed' : 'text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50'}`}
                    >
                      {resendTimer > 0 ? (
                        <>
                          <span className="relative w-4 h-4">
                            <svg className="w-4 h-4 -rotate-90" viewBox="0 0 16 16">
                              <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-20" />
                              <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="40.8" strokeDashoffset={40.8 - (40.8 * resendTimer) / 30} className="transition-all duration-1000 ease-linear" />
                            </svg>
                          </span>
                          Resend OTP in {resendTimer}s
                        </>
                      ) : 'Resend WhatsApp OTP'}
                    </button>
                  </div>

                  <motion.button 
                    type="submit" 
                    disabled={otp.length !== 6 || isLoading} 
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className={`group w-full h-[58px] text-white font-bold rounded-2xl outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30 transition-colors duration-500 flex justify-center items-center relative overflow-hidden disabled:cursor-not-allowed ${
                      isSuccess 
                        ? 'bg-emerald-500 shadow-[0_16px_40px_-10px_rgba(16,185,129,0.6)]' 
                        : 'bg-emerald-600 hover:bg-emerald-700 shadow-[0_12px_30px_-10px_rgba(5,150,105,0.5)] hover:shadow-[0_16px_40px_-10px_rgba(5,150,105,0.6)] disabled:opacity-40 disabled:hover:bg-emerald-600'
                    }`}
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      {isSuccess ? (
                        <motion.div key="success" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }} transition={{ type: 'spring', stiffness: 500, damping: 22 }} className="flex items-center gap-2.5">
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45, ease: 'easeOut', delay: 0.1 }} />
                          </svg>
                          <span className="tracking-wide">Verified</span>
                        </motion.div>
                      ) : isLoading ? (
                        <motion.div key="loading" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="flex items-center gap-3">
                          <div className="w-5 h-5 border-2 border-white/25 border-t-white rounded-full animate-spin"></div>
                          <span className="text-sm tracking-wide">Verifying code...</span>
                        </motion.div>
                      ) : (
                        <motion.div key="idle" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="flex items-center gap-2">
                          <span className="tracking-wide">Verify & sign in</span>
                          <FiCheckCircle size={18} className="group-hover:scale-110 transition-transform duration-300" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.button>
                </motion.form>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Divider */}
          <motion.div variants={itemVariants} className="relative flex items-center my-8 select-none">
            <div className="flex-grow h-px bg-gradient-to-r from-transparent via-slate-300/70 to-slate-300/70"></div>
            <span className="flex-shrink-0 mx-4 text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">Or continue with</span>
            <div className="flex-grow h-px bg-gradient-to-l from-transparent via-slate-300/70 to-slate-300/70"></div>
          </motion.div>

          {/* Federated Gateways */}
          <motion.div variants={itemVariants} className="grid grid-cols-3 gap-3 mb-8">
            <motion.button 
              type="button"
              onClick={() => handleSocialLogin(googleProvider, 'Google')} 
              disabled={isLoading} 
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.96 }}
              className="flex justify-center items-center gap-2.5 h-[52px] border border-slate-200/90 rounded-2xl bg-white/90 hover:bg-white hover:border-slate-300 hover:shadow-[0_10px_30px_-12px_rgba(15,23,42,0.25)] transition-all duration-300 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20"
            >
              <FcGoogle size={20} />
              <span className="font-bold text-slate-700 text-xs hidden sm:inline">Google</span>
            </motion.button>
            <button type="button" disabled title="Coming soon" className="flex justify-center items-center h-[52px] border border-slate-200/60 rounded-2xl bg-white/40 opacity-40 cursor-not-allowed grayscale">
              <FaFacebook size={20} color="#1877F2" />
            </button>
            <button type="button" disabled title="Coming soon" className="flex justify-center items-center h-[52px] border border-slate-200/60 rounded-2xl bg-white/40 opacity-40 cursor-not-allowed grayscale">
              <IoLogoApple size={20} color="#000000" />
            </button>
          </motion.div>

          {/* Registration Link */}
          <motion.div variants={itemVariants} className="text-center">
            <p className="text-sm text-slate-500 font-medium">
              Don't have an account? 
              <Link to="/register" state={{ from: from }} className="text-slate-900 font-black hover:text-[#FF4500] transition-colors ml-1.5 relative after:absolute after:left-0 after:-bottom-0.5 after:h-px after:w-full after:bg-[#FF4500] after:scale-x-0 after:origin-left hover:after:scale-x-100 after:transition-transform after:duration-300">
                Sign up for free
              </Link>
            </p>
          </motion.div>

          <motion.div variants={itemVariants} className="mt-7 flex items-center justify-center gap-2 text-[10px] font-bold tracking-[0.18em] uppercase text-slate-400 select-none">
            <FiLock size={11} /> 256-bit encrypted session
          </motion.div>
        </motion.div>

        {/* Global Toast HUD */}
        <div className="absolute bottom-6 left-0 right-0 pointer-events-none flex justify-center z-50 px-4">
          <AnimatePresence>
            {status.msg && (
              <motion.div 
                variants={toastVariants}
                initial="hidden"
                animate="show"
                exit="exit"
                role="alert"
                aria-live="assertive"
                className={`pointer-events-auto flex items-center justify-between gap-3 w-full max-w-sm font-bold text-xs sm:text-sm pl-4 pr-3 py-3.5 rounded-2xl shadow-[0_20px_50px_-15px_rgba(15,23,42,0.35)] border backdrop-blur-2xl relative overflow-hidden ${
                  status.type === 'error' 
                    ? 'bg-white/90 border-red-200/80 text-red-700' 
                    : status.type === 'loading' 
                      ? 'bg-slate-950/95 border-slate-800 text-white' 
                      : 'bg-white/90 border-emerald-200/80 text-emerald-700'
                }`}
              >
                <span className={`absolute left-0 top-0 h-full w-1 ${
                  status.type === 'error' ? 'bg-red-500' : status.type === 'loading' ? 'bg-indigo-400' : 'bg-emerald-500'
                }`} />
                {status.type === 'error' && (
                  <motion.span 
                    initial={{ scaleX: 1 }} 
                    animate={{ scaleX: 0 }} 
                    transition={{ duration: 4, ease: 'linear' }}
                    className="absolute left-0 bottom-0 h-0.5 w-full bg-red-400/70 origin-left"
                  />
                )}
                <div className="flex items-center gap-2.5 min-w-0 pl-1.5">
                  {status.type === 'error' && (
                    <motion.div initial={{ rotate: -20, scale: 0.6 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 18 }}>
                      <FiAlertCircle size={18} className="flex-shrink-0 text-red-500" />
                    </motion.div>
                  )}
                  {status.type === 'success' && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 18 }}>
                      <FiCheckCircle size={18} className="flex-shrink-0 text-emerald-600" />
                    </motion.div>
                  )}
                  {status.type === 'loading' && (
                    <span className="relative flex-shrink-0 w-[18px] h-[18px]">
                      <span className="absolute inset-0 rounded-full border-2 border-indigo-400/30 border-t-indigo-400 animate-spin" />
                    </span>
                  )}
                  <span className="leading-snug truncate pr-2">{status.msg}</span>
                </div>
                {status.type !== 'loading' && (
                  <button 
                    type="button" 
                    onClick={() => setStatus({ type: '', msg: '' })} 
                    aria-label="Dismiss"
                    className="w-8 h-8 flex-shrink-0 rounded-xl flex items-center justify-center opacity-60 hover:opacity-100 hover:bg-slate-900/5 active:scale-90 transition-all"
                  >
                    <FiX size={14} />
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
};

export default Login;