// src/pages/Login.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'; 
import { Link, useNavigate, useLocation } from 'react-router-dom'; 
import { motion, AnimatePresence } from 'framer-motion'; 
import { FcGoogle } from 'react-icons/fc';
import { FaFacebook } from 'react-icons/fa';
import { IoLogoApple } from 'react-icons/io5';
import { 
  FiMail, FiLock, FiEye, FiEyeOff, FiArrowRight, 
  FiShield, FiX, FiCheck, FiCheckCircle, FiAlertCircle, FiWifi, FiInfo, FiSmartphone, FiArrowLeft
} from 'react-icons/fi';
import { auth, googleProvider } from '../firebase'; 
import { signInWithPopup, FacebookAuthProvider, OAuthProvider } from 'firebase/auth';

import { useUser } from '../context/UserContext';
import axiosInstance from '../api/axiosInstance'; // 🔥 Integrated for WhatsApp OTP backend calls

// --- Static Framer Motion Variants ---
const containerVariants = { 
  hidden: { opacity: 0 }, 
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } } 
};
const itemVariants = { 
  hidden: { opacity: 0, y: 15 }, 
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 400, damping: 30 } } 
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
  // 🔥 UNIFIED INPUT STATE (Can be Email or 10-digit Phone)
  const [identifier, setIdentifier] = useState(() => {
    try {
      return localStorage.getItem('jack_remembered_identifier') || '';
    } catch {
      return '';
    }
  });

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // 🔥 AUTH FLOW STATE MACHINE ('IDENTIFIER' -> 'PASSWORD' or 'WHATSAPP_OTP')
  const [authMode, setAuthMode] = useState('IDENTIFIER'); // 'IDENTIFIER' | 'PASSWORD' | 'WHATSAPP_OTP'
  const [otp, setOtp] = useState('');

  const [status, setStatus] = useState({ type: '', msg: '' });
  const [rememberMe, setRememberMe] = useState(() => {
    try {
      return !!localStorage.getItem('jack_remembered_identifier');
    } catch {
      return false;
    }
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

  const checkCapsLock = useCallback((e) => {
    if (typeof e.getModifierState === 'function') {
      setIsCapsLockOn(e.getModifierState('CapsLock'));
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    if (inputRef.current && !identifier) {
      inputRef.current.focus();
    }
    return () => {
      isMounted.current = false;
    };
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

  // Detect whether user entered an email or phone number
  const isEmailInput = useMemo(() => EMAIL_REGEX.test(identifier.trim()), [identifier]);
  const isPhoneInput = useMemo(() => PHONE_REGEX.test(identifier.trim().replace(/\D/g, '')), [identifier]);

  // Step 1: Continue button handler (Decides whether to ask for Password or trigger WhatsApp OTP)
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
      // Trigger WhatsApp OTP request
      handleSendWhatsAppOtp(cleanInput.replace(/\D/g, ''));
    } else {
      setStatus({ type: 'error', msg: 'Please enter a valid email address or 10-digit mobile number.' });
    }
  };

  // Step 2A: Email & Password Login Handler (Preserved same backend logic)
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

      if (res?.success || res?.token) {
        try {
          if (rememberMe) {
            localStorage.setItem('jack_remembered_identifier', trimmedEmail);
          } else {
            localStorage.removeItem('jack_remembered_identifier');
          }
        } catch (storageError) {
          console.warn('[Storage Error] Failed to persist configuration matrix.', storageError);
        }

        setStatus({ type: 'success', msg: 'Login successful! Redirecting...' });
        if (setIsLoggedIn) setIsLoggedIn(true);
        
        setTimeout(() => { 
          if (isMounted.current) navigate(from, { replace: true }); 
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

  // Step 2B: Send WhatsApp OTP
  const handleSendWhatsAppOtp = async (cleanPhone) => {
    setStatus({ type: 'loading', msg: 'Sending WhatsApp verification code...' });
    try {
      await axiosInstance.post('/whatsapp/send-otp', { phone: `+91${cleanPhone}` });
      if (!isMounted.current) return;
      setAuthMode('WHATSAPP_OTP');
      setStatus({ type: 'success', msg: 'OTP sent to your WhatsApp!' });
    } catch (err) {
      if (isMounted.current) {
        setStatus({ type: 'error', msg: err.response?.data?.message || err.message || 'Failed to send WhatsApp OTP.' });
      }
    }
  };

  // Step 2C: Verify WhatsApp OTP & Login
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
        if (res.data?.token) {
          localStorage.setItem('token', res.data.token);
        }
        setStatus({ type: 'success', msg: 'Phone verified successfully! Redirecting...' });
        if (setIsLoggedIn) setIsLoggedIn(true);

        setTimeout(() => {
          if (isMounted.current) navigate(from, { replace: true });
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
        setTimeout(() => {
          if (isMounted.current) navigate(`/unlock-account?email=${encodeURIComponent(result?.user?.email)}`);
        }, 1500);
        return;
      }
      
      if (dbRes?.success || dbRes?.token) {
        setStatus({ type: 'success', msg: `Welcome back, ${result?.user?.displayName?.split(' ')[0] || 'User'}!` });
        if (setIsLoggedIn) setIsLoggedIn(true);
        
        setTimeout(() => { 
          if (isMounted.current) navigate(from, { replace: true }); 
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

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans relative overflow-hidden selection:bg-indigo-500/30">
      
      {/* LEFT PANEL */}
      <div className="hidden lg:flex lg:w-[45%] bg-[#0B0F19] text-white flex-col justify-between p-12 relative overflow-hidden shadow-2xl z-10 select-none">
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.15, 0.25, 0.15] }} 
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} 
          className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-[#FF4500] rounded-full mix-blend-screen filter blur-[150px] pointer-events-none"
        />
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }} 
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }} 
          className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-indigo-600 rounded-full mix-blend-screen filter blur-[150px] pointer-events-none"
        />

        <motion.div 
          initial={{ opacity: 0, y: -20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.8 }} 
          className="text-sm text-slate-400 font-bold tracking-widest uppercase z-10 mt-6 flex items-center gap-3"
        >
          <span className="w-2 h-2 rounded-full bg-[#FF4500] animate-pulse"></span> Premium D2C Experience
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: -30 }} 
          animate={{ opacity: 1, x: 0 }} 
          transition={{ duration: 1, delay: 0.2 }} 
          className="z-10 mt-10 relative"
        >
          <h1 className="text-6xl font-black tracking-tight leading-[1.1] mb-6">Elevate <br /> your lifestyle.</h1>
          <div className="w-16 h-1.5 bg-gradient-to-r from-[#FF4500] to-orange-400 rounded-full mb-6"></div>
          <p className="text-slate-400 max-w-sm text-lg font-medium leading-relaxed">Join 50,000+ shoppers discovering exclusive deals and premium essentials daily.</p>
        </motion.div>

        <div className="z-10 mt-auto">
          <Link to="/" className="flex items-center space-x-2 w-max group outline-none focus-visible:ring-2 focus-visible:ring-white/50 rounded-lg p-1 -ml-1">
            <span className="text-3xl font-black tracking-tight">J<span className="text-[#FF4500] group-hover:text-white transition-colors duration-300">S</span></span>
            <span className="text-sm font-bold tracking-widest text-slate-500 uppercase group-hover:text-slate-300 transition-colors duration-300">Return to Store</span>
          </Link>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="w-full lg:w-[55%] flex flex-col items-center justify-center p-4 sm:p-6 md:p-12 bg-white/80 backdrop-blur-xl relative z-20">
        
        {/* Offline HUD Banner */}
        <AnimatePresence>
          {!isOnline && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-4 left-4 right-4 bg-amber-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-md z-30 select-none"
            >
              <FiWifi className="animate-pulse" size={16} /> NO NETWORK CONNECTION DETECTED.
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div variants={containerVariants} initial="hidden" animate="show" className="w-full max-w-md relative py-6">
          
          {/* Mobile Logo */}
          <motion.div variants={itemVariants} className="lg:hidden flex flex-col items-center mb-8 select-none">
            <Link to="/" className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mb-3 shadow-xl shadow-slate-900/20 hover:scale-105 transition-transform">
              <span className="text-3xl font-black text-white tracking-tight">J<span className="text-[#FF4500]">S</span></span>
            </Link>
          </motion.div>

          <motion.div variants={itemVariants} className="mb-8 text-center lg:text-left">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight flex items-center justify-center lg:justify-start gap-3">
              {authMode === 'WHATSAPP_OTP' ? 'Verify WhatsApp OTP' : 'Welcome Back'} <span className="text-[#FF4500] select-none">✦</span>
            </h2>
            <p className="text-slate-500 mt-2.5 font-medium text-sm sm:text-base">
              {authMode === 'WHATSAPP_OTP' 
                ? `Enter the 6-digit code sent to +91 ${identifier}` 
                : 'Enter your email or phone number to sign in securely.'}
            </p>
          </motion.div>

          {/* ================= FLOW 1: ENTER EMAIL OR PHONE ================= */}
          {authMode === 'IDENTIFIER' && (
            <form onSubmit={handleContinue} className="space-y-4" noValidate>
              <motion.div variants={itemVariants} className="relative group">
                <label htmlFor="identifier-input" className="sr-only">Email or Phone Number</label>
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition-colors">
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
                  className="w-full pl-12 pr-11 py-4 bg-slate-50/70 border border-slate-200 rounded-2xl focus:bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10 outline-none transition-all font-semibold text-slate-800 placeholder:text-slate-400/90 placeholder:font-medium shadow-sm" 
                  placeholder="Email or 10-digit Phone Number" 
                  required 
                />
              </motion.div>

              <motion.div variants={itemVariants} className="pt-2">
                <button 
                  type="submit" 
                  disabled={!identifier.trim() || isLoading} 
                  className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl hover:bg-indigo-600 focus:bg-indigo-600 outline-none transition-all shadow-sm active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex justify-center items-center h-[56px]"
                >
                  <div className="flex items-center gap-2">
                    <span className="tracking-wide">Continue</span>
                    <FiArrowRight size={18} />
                  </div>
                </button>
              </motion.div>
            </form>
          )}

          {/* ================= FLOW 2A: PASSWORD ENTRY (IF EMAIL) ================= */}
          {authMode === 'PASSWORD' && (
            <form onSubmit={handlePasswordLogin} className="space-y-4" noValidate>
              {/* Back button to change email */}
              <div className="flex items-center justify-between bg-slate-100 px-4 py-2.5 rounded-xl mb-2">
                <span className="text-xs font-bold text-slate-600 truncate max-w-[240px]">{identifier}</span>
                <button 
                  type="button" 
                  onClick={() => { setAuthMode('IDENTIFIER'); setPassword(''); }}
                  className="text-xs font-bold text-[#FF4500] hover:underline flex items-center gap-1"
                >
                  <FiArrowLeft size={12} /> Change
                </button>
              </div>

              <motion.div variants={itemVariants} className="relative group">
                <label htmlFor="password-input" className="sr-only">Password</label>
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-600">
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
                  className="w-full pl-12 pr-24 bg-slate-50/70 border border-slate-200 rounded-2xl focus:bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10 outline-none transition-all font-semibold text-slate-800 placeholder:text-slate-400/90 placeholder:font-medium shadow-sm" 
                  placeholder="Enter your password" 
                  required 
                  autoFocus
                />
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center gap-2">
                  {isCapsLockOn && (
                    <span className="text-[10px] bg-amber-500/10 text-amber-600 px-1.5 py-0.5 rounded font-black border border-amber-500/20 mr-1 flex items-center gap-1">
                      <FiInfo size={10}/> CAPS
                    </span>
                  )}
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)} 
                    disabled={isLoading}
                    className="p-1 rounded-md text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                  </button>
                </div>
              </motion.div>

              <div className="flex items-center justify-between pt-1 px-1">
                <label className="flex items-center group cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={rememberMe} 
                    onChange={(e) => setRememberMe(e.target.checked)}
                    disabled={isLoading}
                    className="sr-only peer"
                  />
                  <div className="w-4.5 h-4.5 bg-slate-50 rounded-md border border-slate-200 peer-checked:bg-slate-900 peer-checked:border-slate-900 flex items-center justify-center transition-all">
                    {rememberMe && <FiCheck className="text-white" size={12} strokeWidth={3} />}
                  </div>
                  <span className="text-xs font-bold text-slate-500 ml-2">Remember Me</span>
                </label>

                <Link to="/forgot-password" className="text-xs font-bold text-[#FF4500] hover:text-orange-600 transition-colors flex items-center gap-1">
                  <FiShield size={13} /> Forgot password?
                </Link>
              </div>

              <motion.div variants={itemVariants} className="pt-2">
                <button 
                  type="submit" 
                  disabled={!password || isLoading} 
                  className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl hover:bg-indigo-600 focus:bg-indigo-600 outline-none transition-all shadow-sm active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex justify-center items-center h-[56px]"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span className="tracking-wide text-sm font-black">AUTHENTICATING...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="tracking-wide">Sign In Securely</span>
                      <FiArrowRight size={18} />
                    </div>
                  )}
                </button>
              </motion.div>
            </form>
          )}

          {/* ================= FLOW 2B: WHATSAPP OTP ENTRY (IF PHONE) ================= */}
          {authMode === 'WHATSAPP_OTP' && (
            <form onSubmit={handleVerifyWhatsAppOtp} className="space-y-4" noValidate>
              <div className="flex items-center justify-between bg-emerald-50 px-4 py-2.5 rounded-xl mb-2 border border-emerald-100">
                <span className="text-xs font-bold text-emerald-800">+91 {identifier}</span>
                <button 
                  type="button" 
                  onClick={() => { setAuthMode('IDENTIFIER'); setOtp(''); }}
                  className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1"
                >
                  <FiArrowLeft size={12} /> Change Number
                </button>
              </div>

              <motion.div variants={itemVariants} className="relative group">
                <label htmlFor="otp-input" className="sr-only">WhatsApp OTP Code</label>
                <input 
                  id="otp-input"
                  type="text" 
                  maxLength="6"
                  value={otp} 
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} 
                  disabled={isLoading} 
                  className="w-full py-4 bg-slate-50/70 border border-slate-200 rounded-2xl focus:bg-white focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10 outline-none transition-all text-center tracking-[0.5em] text-xl font-black text-slate-900 shadow-sm placeholder:tracking-normal placeholder:font-medium placeholder:text-slate-400" 
                  placeholder="• • • • • •" 
                  required 
                  autoFocus
                />
              </motion.div>

              <div className="text-center">
                <button 
                  type="button"
                  onClick={() => handleSendWhatsAppOtp(identifier.trim().replace(/\D/g, ''))}
                  disabled={isLoading}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  Resend WhatsApp OTP
                </button>
              </div>

              <motion.div variants={itemVariants} className="pt-2">
                <button 
                  type="submit" 
                  disabled={otp.length !== 6 || isLoading} 
                  className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl hover:bg-emerald-700 focus:bg-emerald-700 outline-none transition-all shadow-sm active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex justify-center items-center h-[56px]"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span className="tracking-wide text-sm font-black">VERIFYING CODE...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="tracking-wide">Verify & Sign In</span>
                      <FiCheckCircle size={18} />
                    </div>
                  )}
                </button>
              </motion.div>
            </form>
          )}

          {/* Divider */}
          <motion.div variants={itemVariants} className="relative flex items-center my-7 select-none">
            <div className="flex-grow border-t border-slate-100"></div>
            <span className="flex-shrink-0 mx-4 text-slate-400 text-[10px] font-black uppercase tracking-widest">Or continue with</span>
            <div className="flex-grow border-t border-slate-100"></div>
          </motion.div>

          {/* Federated Gateways */}
          <motion.div variants={itemVariants} className="grid grid-cols-3 gap-3 mb-8">
            <button 
              type="button"
              onClick={() => handleSocialLogin(googleProvider, 'Google')} 
              disabled={isLoading} 
              className="flex justify-center items-center gap-2.5 py-3.5 border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all shadow-sm active:scale-[0.96] bg-white"
            >
              <FcGoogle size={20} />
              <span className="font-bold text-slate-700 text-xs hidden sm:inline">Google</span>
            </button>
            <button type="button" disabled className="flex justify-center items-center py-3.5 border border-slate-100 rounded-2xl bg-slate-50/40 opacity-40 cursor-not-allowed grayscale">
              <FaFacebook size={20} color="#1877F2" />
            </button>
            <button type="button" disabled className="flex justify-center items-center py-3.5 border border-slate-100 rounded-2xl bg-slate-50/40 opacity-40 cursor-not-allowed grayscale">
              <IoLogoApple size={20} color="#000000" />
            </button>
          </motion.div>

          {/* Registration Link */}
          <motion.div variants={itemVariants} className="text-center">
            <p className="text-sm text-slate-400 font-medium">
              Don't have an account? 
              <Link to="/register" state={{ from: from }} className="text-slate-900 font-black hover:text-[#FF4500] transition-colors ml-1">
                Sign up for free
              </Link>
            </p>
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
                className={`pointer-events-auto flex items-center justify-between gap-3 w-full max-w-sm font-bold text-xs sm:text-sm px-4.5 py-3.5 rounded-2xl shadow-xl border backdrop-blur-xl relative overflow-hidden ${
                  status.type === 'error' 
                    ? 'bg-red-50/95 border-red-200 text-red-700' 
                    : status.type === 'loading' 
                      ? 'bg-slate-950/95 border-slate-800 text-white' 
                      : 'bg-emerald-50/95 border-emerald-200 text-emerald-700'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {status.type === 'error' && <FiAlertCircle size={18} className="flex-shrink-0 text-red-500" />}
                  {status.type === 'success' && <FiCheckCircle size={18} className="flex-shrink-0 text-emerald-600" />}
                  {status.type === 'loading' && <FiShield size={18} className="flex-shrink-0 text-indigo-400 animate-pulse" />}
                  <span className="leading-snug truncate pr-2">{status.msg}</span>
                </div>
                {status.type !== 'loading' && (
                  <button type="button" onClick={() => setStatus({ type: '', msg: '' })} className="p-1 rounded-lg opacity-60 hover:opacity-100">
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