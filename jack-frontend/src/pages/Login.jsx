import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'; 
import { Link, useNavigate, useLocation } from 'react-router-dom'; // 🔥 FIX: useLocation add kiya
import { motion, AnimatePresence } from 'framer-motion'; 
import { FcGoogle } from 'react-icons/fc';
import { FaFacebook } from 'react-icons/fa';
import { IoLogoApple } from 'react-icons/io5';
import { 
  FiMail, FiLock, FiEye, FiEyeOff, FiArrowRight, 
  FiShield, FiX, FiCheck, FiCheckCircle, FiAlertCircle, FiWifi, FiInfo
} from 'react-icons/fi';
import { auth, googleProvider } from '../firebase'; 
import { signInWithPopup, FacebookAuthProvider, OAuthProvider } from 'firebase/auth';

import { useUser } from '../context/UserContext';

// --- Static Framer Motion Variants (Defined outside to prevent re-creation) ---
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

// Robust, secure production email syntax evaluation engine
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const Login = ({ setIsLoggedIn }) => {
  const [email, setEmail] = useState(() => {
    try {
      return localStorage.getItem('jack_remembered_email') || '';
    } catch {
      return '';
    }
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [rememberMe, setRememberMe] = useState(() => {
    try {
      return !!localStorage.getItem('jack_remembered_email');
    } catch {
      return false;
    }
  });
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
  
  const navigate = useNavigate();
  const location = useLocation(); // 🔥 FIX: Location tracker initialize kiya
  
  // 🔥 MAGIC LOGIC: Pata lagao ki user kahan se aaya hai (default: Home '/')
  const from = location.state?.from || '/'; 

  const emailInputRef = useRef(null);
  const isMounted = useRef(true);

  const fbProvider = new FacebookAuthProvider();
  const appleProvider = new OAuthProvider('apple.com');

  const { loginUser, socialLoginUser } = useUser();

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

  // Keyboard layout state evaluation hook
  const checkCapsLock = useCallback((e) => {
    if (typeof e.getModifierState === 'function') {
      setIsCapsLockOn(e.getModifierState('CapsLock'));
    }
  }, []);

  // Auto-focus email on mount & handle component unmount tracking
  useEffect(() => {
    isMounted.current = true;
    if (emailInputRef.current && !email) {
      emailInputRef.current.focus();
    }
    return () => {
      isMounted.current = false;
    };
  }, [email]);

  // 3-SECOND AUTO-HIDE ERROR LOGIC
  useEffect(() => {
    let timer;
    if (status.msg && status.type === 'error') {
      timer = setTimeout(() => {
        if (isMounted.current) setStatus({ type: '', msg: '' }); 
      }, 4000);
    }
    return () => clearTimeout(timer); 
  }, [status.msg, status.type]); 

  const handleLogin = useCallback(async (e) => {
    e.preventDefault();
    if (!isOnline) {
      setStatus({ type: 'error', msg: 'Connection failed. You are currently offline.' });
      return;
    }

    const trimmedEmail = email.trim().replace(/\s+/g, '');
    if (!trimmedEmail || !password) return;

    setStatus({ type: 'loading', msg: 'Authenticating securely...' });
    
    try {
      const res = await loginUser(trimmedEmail, password);

      if (!isMounted.current) return; // Prevent state update if unmounted

      // 🔥 FOOLPROOF LOCK CHECK
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
            localStorage.setItem('jack_remembered_email', trimmedEmail);
          } else {
            localStorage.removeItem('jack_remembered_email');
          }
        } catch (storageError) {
          console.warn('[Storage Error] Failed to persist configuration matrix.', storageError);
        }

        setStatus({ type: 'success', msg: 'Login successful! Redirecting...' });
        if (setIsLoggedIn) setIsLoggedIn(true);
        
        // 🔥 FIX: Redirect back to checkout (or home) using 'from' variable
        setTimeout(() => { 
          if (isMounted.current) navigate(from, { replace: true }); 
        }, 1000);
      } else {
        // 🔥 FIX: Read backend structured error from 'res' (if caught inside context)
        setStatus({ type: 'error', msg: res?.error || res?.message || 'Invalid email or password.' });
      }
    } catch (error) {
      if (isMounted.current) {
        // 🔥 FIX: Dynamically read Axios/Fetch errors directly from the backend response
        const backendError = error.response?.data?.error || error.response?.data?.message || error.message || 'Network error. Please check your connection.';
        setStatus({ type: 'error', msg: backendError });
      }
    }
  }, [email, password, loginUser, navigate, setIsLoggedIn, rememberMe, isOnline, from]);

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

      // 🔥 FOOLPROOF SOCIAL LOCK CHECK
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
        
        // 🔥 FIX: Social login also redirects back to intended page
        setTimeout(() => { 
          if (isMounted.current) navigate(from, { replace: true }); 
        }, 1000);
      } else {
        setStatus({ type: 'error', msg: dbRes?.error || dbRes?.message || `Account sync failed. Please try again.` });
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

  const isEmailValid = useMemo(() => EMAIL_REGEX.test(email.trim()), [email]);
  const isFormValid = useMemo(() => isEmailValid && password.length >= 1, [isEmailValid, password]);
  const isLoading = status.type === 'loading';

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans relative overflow-hidden selection:bg-indigo-500/30">
      
      {/* LEFT PANEL */}
      <div className="hidden lg:flex lg:w-[45%] bg-[#0B0F19] text-white flex-col justify-between p-12 relative overflow-hidden shadow-2xl z-10 select-none">
        {/* Animated Background Elements */}
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
        
        {/* Offline Diagnostic Matrix HUD Banner */}
        <AnimatePresence>
          {!isOnline && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-4 left-4 right-4 bg-amber-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-md z-30 select-none"
            >
              <FiWifi className="animate-pulse" size={16} /> NO NETWORK CONNECTION DETECTED. INTERACTIVE CAPABILITIES DEGRADED.
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div variants={containerVariants} initial="hidden" animate="show" className="w-full max-w-md relative py-6">
          
          {/* Mobile Logo */}
          <motion.div variants={itemVariants} className="lg:hidden flex flex-col items-center mb-8 select-none">
            <Link to="/" className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mb-3 shadow-xl shadow-slate-900/20 hover:scale-105 transition-transform outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2">
              <span className="text-3xl font-black text-white tracking-tight">J<span className="text-[#FF4500]">S</span></span>
            </Link>
          </motion.div>

          <motion.div variants={itemVariants} className="mb-8 text-center lg:text-left">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight flex items-center justify-center lg:justify-start gap-3">
              Welcome Back <span className="text-[#FF4500] select-none">✦</span>
            </h2>
            <p className="text-slate-500 mt-2.5 font-medium text-sm sm:text-base">Please enter your details to sign in securely.</p>
          </motion.div>

          <form onSubmit={handleLogin} className="space-y-4" noValidate>
            {/* Email Input Container */}
            <motion.div variants={itemVariants} className="relative group">
              <label htmlFor="email-input" className="sr-only">Email Address</label>
              <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition-colors duration-300">
                <FiMail size={18} aria-hidden="true" />
              </div>
              <input 
                id="email-input"
                ref={emailInputRef}
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                disabled={isLoading} 
                autoComplete="email"
                aria-invalid={email.length > 0 && !isEmailValid}
                aria-describedby={email.length > 0 && !isEmailValid ? "email-error-hint" : undefined}
                className={`w-full pl-12 pr-11 py-4 bg-slate-50/70 border rounded-2xl focus:bg-white outline-none transition-all duration-300 font-semibold text-slate-800 disabled:opacity-50 shadow-sm placeholder:text-slate-400/90 placeholder:font-medium focus:ring-4 focus:ring-indigo-600/10 ${
                  email.length > 0 && !isEmailValid 
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500/15' 
                    : email.length > 0 && isEmailValid 
                      ? 'border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500/15'
                      : 'border-slate-200 hover:border-slate-300 focus:border-indigo-600'
                }`} 
                placeholder="Email Address" 
                required 
              />
              {/* Reactive UI Validation Icons */}
              {email.length > 0 && (
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                  {isEmailValid ? (
                    <FiCheckCircle className="text-emerald-500" size={16} />
                  ) : (
                    <FiAlertCircle className="text-red-400" size={16} />
                  )}
                </div>
              )}
            </motion.div>
            {email.length > 0 && !isEmailValid && (
              <p id="email-error-hint" className="text-[11px] font-bold text-red-500 tracking-wide mt-1 px-1 flex items-center gap-1">
                <FiAlertCircle size={12}/> Please enter a structurally valid email address structure.
              </p>
            )}

            {/* Password Input Container */}
            <motion.div variants={itemVariants} className="relative group">
              <label htmlFor="password-input" className="sr-only">Password</label>
              <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition-colors duration-300">
                <FiLock size={18} aria-hidden="true" />
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
                className="w-full pl-12 pr-24 bg-slate-50/70 border border-slate-200 rounded-2xl focus:bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10 outline-none transition-all duration-300 font-semibold text-slate-800 disabled:opacity-50 shadow-sm hover:border-slate-300 placeholder:text-slate-400/90 placeholder:font-medium" 
                placeholder="Password" 
                required 
              />
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center gap-2">
                {isCapsLockOn && (
                  <span className="text-[10px] bg-amber-500/10 text-amber-600 px-1.5 py-0.5 rounded font-black border border-amber-500/20 mr-1 select-none flex items-center gap-1">
                    <FiInfo size={10}/> CAPS
                  </span>
                )}
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)} 
                  disabled={isLoading}
                  className="p-1 rounded-md text-slate-400 hover:text-indigo-600 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <FiEyeOff size={18} aria-hidden="true" /> : <FiEye size={18} aria-hidden="true" />}
                </button>
              </div>
            </motion.div>

            {/* Remember Me & Forgot Password Layout Matrix */}
            <motion.div variants={itemVariants} className="flex items-center justify-between pt-1 px-1">
              <label className="flex items-center group cursor-pointer select-none">
                <div className="relative flex items-center justify-center">
                  <input 
                    type="checkbox" 
                    checked={rememberMe} 
                    onChange={(e) => setRememberMe(e.target.checked)}
                    disabled={isLoading}
                    className="sr-only peer"
                  />
                  <div className="w-4.5 h-4.5 bg-slate-50 rounded-md border border-slate-200 focus-within:ring-4 focus-within:ring-indigo-600/10 peer-checked:bg-slate-900 peer-checked:border-slate-900 flex items-center justify-center transition-all group-hover:border-slate-300">
                    {rememberMe && <FiCheck className="text-white" size={12} strokeWidth={3} />}
                  </div>
                </div>
                <span className="text-xs font-bold text-slate-500 ml-2 group-hover:text-slate-700 transition-colors">Remember Me</span>
              </label>

              <Link 
                to="/forgot-password" 
                className="text-xs font-bold text-[#FF4500] hover:text-orange-600 transition-colors flex items-center gap-1 outline-none focus-visible:ring-2 focus-visible:ring-[#FF4500] rounded p-0.5"
              >
                <FiShield size={13} aria-hidden="true" /> Forgot password?
              </Link>
            </motion.div>

            {/* Submit Conversion Trigger */}
            <motion.div variants={itemVariants} className="pt-2">
              <button 
                type="submit" 
                disabled={!isFormValid || isLoading} 
                className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl hover:bg-indigo-600 focus:bg-indigo-600 outline-none focus-visible:ring-4 focus-visible:ring-indigo-600/30 transition-all duration-300 shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:shadow-indigo-600/20 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-900 disabled:active:scale-100 flex justify-center items-center h-[56px] relative overflow-hidden group"
                aria-disabled={!isFormValid || isLoading}
              >
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent group-hover:animate-[shimmer_1.8s_infinite]"></div>
                {isLoading ? (
                  <div className="flex items-center gap-3" role="status">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span className="tracking-wide text-sm font-black">AUTHENTICATING SECURELY...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="tracking-wide">Sign In Securely</span>
                    <FiArrowRight size={18} className="group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                  </div>
                )}
              </button>
            </motion.div>
          </form>

          {/* Divider */}
          <motion.div variants={itemVariants} className="relative flex items-center my-7 select-none">
            <div className="flex-grow border-t border-slate-100"></div>
            <span className="flex-shrink-0 mx-4 text-slate-400 text-[10px] font-black uppercase tracking-widest">Or continue with</span>
            <div className="flex-grow border-t border-slate-100"></div>
          </motion.div>

          {/* Federated Security Matrix Gateways */}
          <motion.div variants={itemVariants} className="grid grid-cols-3 gap-3 mb-8">
            <button 
              type="button"
              onClick={() => handleSocialLogin(googleProvider, 'Google')} 
              disabled={isLoading} 
              aria-label="Sign in via identity contract mapping Google"
              className="flex justify-center items-center gap-2.5 py-3.5 border border-slate-200 rounded-2xl hover:bg-slate-50 focus:bg-slate-50 outline-none focus-visible:ring-4 focus-visible:ring-slate-200 transition-all shadow-sm active:scale-[0.96] disabled:opacity-50 disabled:cursor-not-allowed bg-white"
            >
              <FcGoogle size={20} aria-hidden="true" />
              <span className="font-bold text-slate-700 text-xs hidden sm:inline">Google</span>
            </button>
            <button 
              type="button"
              disabled 
              aria-label="Sign in via identity contract mapping Facebook (Disabled)"
              className="flex justify-center items-center py-3.5 border border-slate-100 rounded-2xl bg-slate-50/40 opacity-40 cursor-not-allowed grayscale"
            >
              <FaFacebook size={20} color="#1877F2" aria-hidden="true" />
            </button>
            <button 
              type="button"
              disabled 
              aria-label="Sign in via identity contract mapping Apple (Disabled)"
              className="flex justify-center items-center py-3.5 border border-slate-100 rounded-2xl bg-slate-50/40 opacity-40 cursor-not-allowed grayscale"
            >
              <IoLogoApple size={20} color="#000000" aria-hidden="true" />
            </button>
          </motion.div>

          {/* Registration Link 🔥 FIX: Yahan par state pass kiya for Signup redirection */}
          <motion.div variants={itemVariants} className="text-center">
            <p className="text-sm text-slate-400 font-medium">
              Don't have an account? 
              <Link 
                to="/register" 
                state={{ from: from }} 
                className="text-slate-900 font-black hover:text-[#FF4500] focus-visible:text-[#FF4500] transition-colors ml-1 border-b-2 border-transparent hover:border-[#FF4500] outline-none focus-visible:ring-2 focus-visible:ring-[#FF4500] rounded px-0.5"
              >
                Sign up for free
              </Link>
            </p>
          </motion.div>

        </motion.div>

        {/* Global HUD Diagnostics Telemetry & Feedback Layer */}
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
                className={`pointer-events-auto flex items-center justify-between gap-3 w-full max-w-sm font-bold text-xs sm:text-sm px-4.5 py-3.5 rounded-2xl shadow-xl border backdrop-blur-xl relative overflow-hidden group/toast ${
                  status.type === 'error' 
                    ? 'bg-red-50/95 border-red-200/80 text-red-700 shadow-red-500/5' 
                    : status.type === 'loading' 
                      ? 'bg-slate-950/95 border-slate-800 text-white shadow-slate-950/10' 
                      : 'bg-emerald-50/95 border-emerald-200/80 text-emerald-700 shadow-emerald-500/5'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {status.type === 'error' && <FiAlertCircle size={18} className="flex-shrink-0 text-red-500" aria-hidden="true" />}
                  {status.type === 'success' && <FiCheckCircle size={18} className="flex-shrink-0 text-emerald-600" aria-hidden="true" />}
                  {status.type === 'loading' && <FiShield size={18} className="flex-shrink-0 text-indigo-400 animate-pulse" aria-hidden="true" />}
                  <span className="leading-snug truncate pr-2">{status.msg}</span>
                </div>
                
                {status.type !== 'loading' && (
                  <button 
                    type="button"
                    onClick={() => setStatus({ type: '', msg: '' })}
                    className="p-1 rounded-lg hover:bg-black/5 focus:bg-black/10 text-current opacity-60 hover:opacity-100 transition-all outline-none flex-shrink-0 focus-visible:ring-2 focus-visible:ring-current"
                    aria-label="Dismiss feedback notification"
                  >
                    <FiX size={14} aria-hidden="true" />
                  </button>
                )}
                {/* Visual duration telemetry countdown animation tracker */}
                {status.type === 'error' && (
                  <div className="absolute bottom-0 left-0 h-0.5 bg-red-500/40 w-full origin-left animate-[shimmer_4s_linear]" />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>

      {/* Internal Shimmer Infrastructure */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

export default Login;