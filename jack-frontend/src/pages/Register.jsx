import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom'; // 🔥 FIX: useLocation add kiya
import { motion, AnimatePresence } from 'framer-motion';
import { FiUser, FiMail, FiLock, FiEye, FiEyeOff, FiCheck, FiArrowRight, FiPhone } from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';
import { auth, googleProvider } from '../firebase'; 
import { signInWithPopup } from 'firebase/auth';
import { API_URL } from '../config';

import { useUser } from '../context/UserContext';

const MailIcon = React.memo(() => (
  <motion.div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex justify-center items-center mx-auto mb-6 shadow-inner" initial={{ scale: 0 }} animate={{ scale: 1, rotate: [0, -10, 10, 0] }} transition={{ duration: 0.6, type: 'spring' }}>
    <FiMail size={32} aria-hidden="true" />
  </motion.div>
));

const SuccessIcon = React.memo(() => (
  <motion.div className="w-24 h-24 bg-green-50 text-green-500 rounded-full flex justify-center items-center mx-auto mb-6 shadow-inner relative" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 10 }}>
    <div className="absolute inset-0 rounded-full border-4 border-green-200 animate-ping opacity-50"></div>
    <FiCheck size={40} aria-hidden="true" />
  </motion.div>
));

const Register = ({ setIsLoggedIn }) => {
  const [step, setStep] = useState(1); 
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState(''); 
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  
  const [cooldown, setCooldown] = useState(0);
  const [otpAttempts, setOtpAttempts] = useState(0);

  const [status, setStatus] = useState({ type: '', msg: '' });
  const navigate = useNavigate();
  const location = useLocation(); // 🔥 FIX: Location track kiya
  
  // 🔥 MAGIC LOGIC: Check karo agar checkout (ya kisi aur page) se aaya hai
  const from = location.state?.from || '/';

  const isMounted = useRef(true);
  const isRequesting = useRef(false); 
  
  const { loginUser, socialLoginUser } = useUser();

  // Component unmount cleanup
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Persistent Cooldown Setup
  useEffect(() => {
    const savedEndTime = sessionStorage.getItem('otpCooldownEnd');
    if (savedEndTime) {
      const remaining = Math.floor((parseInt(savedEndTime, 10) - Date.now()) / 1000);
      if (remaining > 0) {
        setCooldown(remaining);
      } else {
        sessionStorage.removeItem('otpCooldownEnd');
      }
    }
  }, []);

  // Cooldown Timer Engine
  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      sessionStorage.setItem('otpCooldownEnd', (Date.now() + cooldown * 1000).toString());
      timer = setInterval(() => {
        if (isMounted.current) setCooldown((prev) => prev - 1);
      }, 1000);
    } else {
      sessionStorage.removeItem('otpCooldownEnd');
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  // Toast status cleanup
  useEffect(() => {
    let timer;
    if (status.msg && status.type === 'error') {
      timer = setTimeout(() => {
        if (isMounted.current) setStatus({ type: '', msg: '' });
      }, 5000);
    }
    return () => clearTimeout(timer); 
  }, [status.msg, status.type]); 

  // Network Fetch Wrapper (Retry, Timeout, Error Mapping)
  const safeFetch = async (url, options, maxRetries = 3) => {
    const timeoutMs = 15000; 
    for (let i = 0; i < maxRetries; i++) {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        
        const isJson = res.headers.get('content-type')?.includes('application/json');
        const data = isJson ? await res.json().catch(() => ({})) : {};
        
        if (!res.ok) {
           // Retry strictly on 5xx Errors
           if (res.status >= 500 && res.status <= 599 && i < maxRetries - 1) {
              await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
              continue;
           }
           
           let msg = data.message || data.error;
           if (!msg) {
               const statusMap = {
                   400: "Invalid request data. Please check your inputs.",
                   401: "Unauthorized access.",
                   403: "Access forbidden.",
                   404: "Endpoint not found.",
                   409: "Conflict. User might already exist.",
                   422: "Unprocessable Entity. Validation failed.",
                   429: "Too many requests. Please slow down.",
                   500: "Internal Server Error.",
                   502: "Bad Gateway.",
                   503: "Service temporarily unavailable.",
                   504: "Gateway Timeout."
               };
               msg = statusMap[res.status] || `An unexpected error occurred (Code: ${res.status})`;
           }
           return { ok: false, status: res.status, data, message: msg };
        }
        
        return { ok: true, status: res.status, data };
      } catch (err) {
        clearTimeout(id);
        if (err.name === 'AbortError') {
           if (i < maxRetries - 1) {
              await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
              continue;
           }
           return { ok: false, status: 408, message: 'Request timed out. Please check your connection.' };
        }
        // Network connection error
        if (i < maxRetries - 1) {
           await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
           continue;
        }
      }
    }
    return { ok: false, status: 0, message: 'Network error. Please check your internet connection.' };
  };

  const resetForm = useCallback(() => {
    setName('');
    setEmail('');
    setMobile('');
    setPassword('');
    setConfirmPassword('');
    setOtp('');
    setOtpAttempts(0);
    sessionStorage.removeItem('otpCooldownEnd');
  }, []);

  const handleEmailChange = useCallback((e) => setEmail(e.target.value.toLowerCase().trim()), []);

  const handleMobileChange = useCallback((e) => {
    let val = e.target.value.replace(/\D/g, ''); // Extract only numbers
    if (val.length > 10 && val.startsWith('91')) val = val.slice(2); // Sanitize Indian country code
    setMobile(val.slice(0, 10)); // Force 10 digits
  }, []);

  const validatePassword = useCallback((pass) => {
    if (pass.length < 8) return "Password must be at least 8 characters.";
    if (!/[A-Z]/.test(pass)) return "Password must contain an uppercase letter.";
    if (!/[a-z]/.test(pass)) return "Password must contain a lowercase letter.";
    if (!/[0-9]/.test(pass)) return "Password must contain a number.";
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pass)) return "Password must contain a special character.";
    return "";
  }, []);

  const getPasswordStrength = useCallback(() => {
    if (!password) return { score: 0, text: '' };
    let score = 0;
    if (password.length > 7) score += 1;
    if (/[A-Z]/.test(password) || /[a-z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    
    if (score <= 1) return { score: 1, text: 'Weak' };
    if (score === 2) return { score: 2, text: 'Fair' };
    if (score === 3) return { score: 3, text: 'Good' };
    return { score: 4, text: 'Strong' };
  }, [password]);

  const passStrength = useMemo(() => getPasswordStrength(), [getPasswordStrength]);
  const isValidEmail = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), [email]);

  const handleSendOtp = useCallback(async (e) => {
    if (e) e.preventDefault();
    if (isRequesting.current) return;
    if (!navigator.onLine) return setStatus({ type: 'error', msg: 'No internet connection available.' });
    
    const passError = validatePassword(password);
    if (passError) return setStatus({ type: 'error', msg: passError });
    if (password !== confirmPassword) return setStatus({ type: 'error', msg: 'Passwords do not match!' });
    if (!isValidEmail) return setStatus({ type: 'error', msg: 'Enter a valid email address.' });
    if (mobile.length !== 10) return setStatus({ type: 'error', msg: 'Enter a valid 10-digit mobile number.' });
    
    // Smart Cooldown Logic
    let nextCooldown = 30; 
    if (otpAttempts === 1) nextCooldown = 60; 
    else if (otpAttempts === 2) nextCooldown = 300; 
    else if (otpAttempts >= 3) nextCooldown = 600; 

    isRequesting.current = true;
    setStatus({ type: 'loading', msg: 'Securing connection...' });

    try {
      const res = await safeFetch(`${API_URL}/public/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      if (!isMounted.current) return;

      if (res.ok) {
        setStatus({ type: 'success', msg: 'OTP Sent successfully!' });
        setStep(2); 
        setCooldown(nextCooldown);
        setOtpAttempts(prev => prev + 1);
      } else {
        setStatus({ type: 'error', msg: res.message });
      }
    } catch (error) {
      if (isMounted.current) setStatus({ type: 'error', msg: 'Unexpected execution error.' });
    } finally {
      if (isMounted.current) isRequesting.current = false;
    }
  }, [email, password, confirmPassword, mobile, isValidEmail, otpAttempts, validatePassword]);

  const handleVerifyAndRegister = useCallback(async (e) => {
    if (e) e.preventDefault();
    if (isRequesting.current) return;
    if (!navigator.onLine) return setStatus({ type: 'error', msg: 'No internet connection available.' });
    if(otp.length < 6) return setStatus({ type: 'error', msg: 'Enter the 6-digit code' });
    
    isRequesting.current = true;
    setStatus({ type: 'loading', msg: 'Verifying identity...' });

    try {
      const verifyRes = await safeFetch(`${API_URL}/public/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });
      
      if (!isMounted.current) return;

      if (!verifyRes.ok) {
        setStatus({ type: 'error', msg: verifyRes.message || 'Invalid or expired code.' });
        isRequesting.current = false;
        return;
      }

      setStatus({ type: 'loading', msg: 'Setting up your profile...' });

      const regRes = await safeFetch(`${API_URL}/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email, mobile, password })
      });
      
      if (!isMounted.current) return;

      if (regRes.ok) {
        await loginUser(email, password);
        if (setIsLoggedIn) setIsLoggedIn(true);
        
        setStep(3); 
        resetForm();
        
        // 🔥 FIX: Redirect properly based on 'from' state
        setTimeout(() => { if (isMounted.current) navigate(from, { replace: true }); }, 2500); 
      } else {
        setStatus({ type: 'error', msg: regRes.message || 'Registration failed' });
      }
    } catch (error) {
      if (isMounted.current) setStatus({ type: 'error', msg: 'Connection Error.' });
    } finally {
      if (isMounted.current) isRequesting.current = false;
    }
  }, [email, name, otp, mobile, password, loginUser, setIsLoggedIn, navigate, resetForm, from]);

  const handleSocialRegister = useCallback(async (provider, providerName) => {
    if (isRequesting.current) return;
    if (!navigator.onLine) return setStatus({ type: 'error', msg: 'No internet connection available.' });

    isRequesting.current = true;
    setStatus({ type: 'loading', msg: `Connecting to ${providerName}...` });
    
    try {
      const result = await signInWithPopup(auth, provider);
      const dbRes = await socialLoginUser(result.user.displayName, result.user.email, result.user.uid);
      
      if (!isMounted.current) return;

      if (dbRes.success) {
        if (setIsLoggedIn) setIsLoggedIn(true);
        if (dbRes.isNewUser) {
          setStep(3); 
          resetForm();
          // 🔥 FIX: Redirect properly for new social users
          setTimeout(() => { if (isMounted.current) navigate(from, { replace: true }); }, 2500);
        } else {
          setStatus({ type: 'success', msg: `Welcome back, ${result.user.displayName.split(' ')[0]}!` });
          resetForm();
          // 🔥 FIX: Redirect properly for returning social users
          setTimeout(() => { if (isMounted.current) navigate(from, { replace: true }); }, 1500);
        }
      } else {
        setStatus({ type: 'error', msg: `Database sync failed!` });
      }
    } catch (error) {
      if (!isMounted.current) return;
      if(error.code !== 'auth/popup-closed-by-user') {
        setStatus({ type: 'error', msg: `Connection to ${providerName} failed.` });
      } else {
        setStatus({ type: '', msg: '' });
      }
    } finally {
      if (isMounted.current) isRequesting.current = false;
    }
  }, [socialLoginUser, setIsLoggedIn, navigate, resetForm, from]);

  const handleOtpPaste = useCallback((e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData) setOtp(pastedData);
  }, []);

  const isFormValid = useMemo(() => {
    return name.trim().length > 0 && 
           isValidEmail && 
           mobile.length === 10 && 
           validatePassword(password) === "" && 
           password === confirmPassword;
  }, [name, isValidEmail, mobile, password, confirmPassword, validatePassword]);

  const isLoading = status.type === 'loading';

  return (
    <div className="flex min-h-screen bg-white font-sans relative overflow-hidden">
      
      {/* ================= LEFT PANEL ================= */}
      <div className="hidden lg:flex lg:w-[45%] bg-[#0B0F19] text-white flex-col justify-between p-12 relative overflow-hidden shadow-2xl z-10" role="complementary">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600 rounded-full mix-blend-screen filter blur-[150px] opacity-20 pointer-events-none"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-[#FF4500] rounded-full mix-blend-screen filter blur-[120px] opacity-20 pointer-events-none"></div>

        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="text-sm text-slate-400 font-bold tracking-widest uppercase z-10 mt-6 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-500" aria-hidden="true"></span> Exclusive Membership
        </motion.div>

        <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 1, delay: 0.2 }} className="z-10 mt-10 relative">
          <h1 className="text-6xl font-black tracking-tight leading-[1.1]">Join the <br /> Elite Club.</h1>
          <p className="text-slate-400 mt-6 max-w-sm text-lg font-medium leading-relaxed">Create an account to unlock VIP pricing, early sale access, and a seamless checkout experience.</p>
        </motion.div>

        <div className="z-10 mt-auto">
          <Link to="/" className="flex items-center space-x-2 w-max group focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[#0B0F19] rounded-lg p-1" aria-label="Return to Store">
            <span className="text-3xl font-black tracking-tight" aria-hidden="true">J<span className="text-[#FF4500] group-hover:text-white transition-colors">S</span></span>
            <span className="text-sm font-bold tracking-widest text-slate-500 uppercase">Return to Store</span>
          </Link>
        </div>
      </div>

      {/* ================= RIGHT PANEL ================= */}
      <div className="w-full lg:w-[55%] flex flex-col items-center justify-center p-6 sm:p-12 bg-white relative z-20" role="main">
        <div className="w-full max-w-md relative">
          
          <div className="lg:hidden flex flex-col items-center mb-8" aria-hidden="true">
            <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mb-3 shadow-lg">
              <span className="text-3xl font-black text-white tracking-tight">J<span className="text-[#FF4500]">S</span></span>
            </div>
          </div>

          <AnimatePresence mode="wait">
            
            {/* ---------------- STEP 1: FORM ---------------- */}
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} transition={{ duration: 0.3 }}>
                <div className="mb-10 text-center lg:text-left">
                  <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Create Account</h2>
                  <p className="text-slate-500 mt-2 font-medium">Please enter your details to get started.</p>
                </div>

                <form onSubmit={handleSendOtp} className="space-y-4" noValidate>
                  <div className="relative">
                    <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} disabled={isLoading} className="w-full pl-12 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600 focus:ring-opacity-50 outline-none transition-all font-medium text-slate-800 disabled:opacity-50" placeholder="Full Name" aria-label="Full Name" autoComplete="name" required />
                  </div>
                  
                  <div className="relative">
                    <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                    <input type="email" value={email} onChange={handleEmailChange} disabled={isLoading} className="w-full pl-12 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600 focus:ring-opacity-50 outline-none transition-all font-medium text-slate-800 disabled:opacity-50" placeholder="Email Address" aria-label="Email Address" autoComplete="email" required />
                  </div>

                  <div className="relative">
                    <FiPhone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                    <input type="tel" value={mobile} onChange={handleMobileChange} maxLength="10" disabled={isLoading} className="w-full pl-12 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600 focus:ring-opacity-50 outline-none transition-all font-medium text-slate-800 disabled:opacity-50" placeholder="Mobile Number" aria-label="Mobile Number" autoComplete="tel" required />
                  </div>
                  
                  <div className="relative">
                    <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} disabled={isLoading} className="w-full pl-12 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600 focus:ring-opacity-50 outline-none transition-all font-medium text-slate-800 disabled:opacity-50" placeholder="Create Password" aria-label="Create Password" autoComplete="new-password" required />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 focus:outline-none focus:text-indigo-600 transition-colors p-1 rounded-md">
                      {showPassword ? <FiEyeOff size={18} aria-hidden="true" /> : <FiEye size={18} aria-hidden="true" />}
                    </button>
                  </div>

                  {/* High Quality Password Strength Indicator */}
                  {password.length > 0 && (
                    <div className="flex flex-col gap-1 mt-1 px-2" aria-live="polite">
                      <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest text-slate-500">
                         <span>Password Strength</span>
                         <span className={`${
                           passStrength.score === 1 ? 'text-red-500' :
                           passStrength.score === 2 ? 'text-yellow-500' :
                           passStrength.score === 3 ? 'text-blue-500' :
                           'text-green-500'
                         }`}>{passStrength.text}</span>
                      </div>
                      <div className="flex gap-1.5 mt-1" aria-label={`Password strength: ${passStrength.text}`}>
                        <div className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${passStrength.score >= 1 ? 'bg-red-400' : 'bg-slate-200'}`}></div>
                        <div className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${passStrength.score >= 2 ? 'bg-yellow-400' : 'bg-slate-200'}`}></div>
                        <div className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${passStrength.score >= 3 ? 'bg-blue-400' : 'bg-slate-200'}`}></div>
                        <div className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${passStrength.score >= 4 ? 'bg-green-500' : 'bg-slate-200'}`}></div>
                      </div>
                    </div>
                  )}

                  <div className="relative pt-2">
                    <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 mt-1" aria-hidden="true" />
                    <input type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={isLoading} className="w-full pl-12 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600 focus:ring-opacity-50 outline-none transition-all font-medium text-slate-800 disabled:opacity-50" placeholder="Confirm Password" aria-label="Confirm Password" autoComplete="new-password" required />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 focus:outline-none focus:text-indigo-600 transition-colors p-1 rounded-md mt-1">
                      {showConfirmPassword ? <FiEyeOff size={18} aria-hidden="true" /> : <FiEye size={18} aria-hidden="true" />}
                    </button>
                  </div>

                  <button 
                    type="submit" 
                    disabled={!isFormValid || isLoading}
                    className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl hover:bg-indigo-600 focus:ring-4 focus:ring-indigo-600/50 transition-all shadow-lg hover:shadow-indigo-600/30 mt-6 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center h-[56px] outline-none"
                    aria-live="polite"
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true"></div>
                        <span>SECURING CONNECTION...</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span>Continue</span>
                        <FiArrowRight size={18} aria-hidden="true" />
                      </div>
                    )}
                  </button>
                </form>

                <div className="relative flex items-center my-8" aria-hidden="true">
                  <div className="flex-grow border-t border-slate-200"></div>
                  <span className="flex-shrink-0 mx-4 text-slate-400 text-xs font-bold uppercase tracking-widest">Or register with</span>
                  <div className="flex-grow border-t border-slate-200"></div>
                </div>

                <div className="flex justify-center mb-8">
                  <button 
                    onClick={() => handleSocialRegister(googleProvider, 'Google')} 
                    disabled={isLoading}
                    className="w-full flex justify-center items-center gap-3 py-4 border-2 border-slate-200 rounded-xl hover:bg-slate-50 focus:bg-slate-50 focus:border-slate-400 hover:border-slate-300 transition-all shadow-sm active:scale-95 disabled:opacity-50 outline-none"
                    aria-label="Sign up with Google"
                  >
                    <FcGoogle size={24} aria-hidden="true" />
                    <span className="font-bold text-slate-700">Sign up with Google</span>
                  </button>
                </div>

                {/* 🔥 FIX: State pass kiya wapas 'from' variable ke sath */}
                <div className="text-center">
                  <p className="text-sm text-slate-500 font-medium">
                    Already have an account? <Link to="/login" state={{ from: from }} className="text-slate-900 font-bold hover:text-indigo-600 focus:outline-none focus:underline transition-colors ml-1">Sign in here</Link>
                  </p>
                </div>
              </motion.div>
            )}

            {/* ---------------- STEP 2: OTP ---------------- */}
            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.4 }} className="py-4">
                <MailIcon />
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">Verify Email</h2>
                  <p className="text-slate-500 text-sm mt-2 font-medium">Enter the 6-digit code sent to <br/><b className="text-slate-800">{email}</b></p>
                </div>
                <form onSubmit={handleVerifyAndRegister}>
                  <div className="relative w-full h-16 flex justify-between mb-8 cursor-text gap-2">
                    <input 
                      type="text" 
                      maxLength={6} 
                      autoFocus 
                      value={otp} 
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} 
                      onPaste={handleOtpPaste}
                      disabled={isLoading} 
                      className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-text" 
                      aria-label="6 digit OTP" 
                      autoComplete="one-time-code" 
                    />
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                      <div key={index} aria-hidden="true" className={`flex-1 h-14 sm:h-16 border-2 flex items-center justify-center text-xl sm:text-2xl font-black rounded-xl transition-all ${otp.length === index ? 'border-indigo-600 shadow-md scale-105 bg-white' : otp[index] ? 'border-slate-800 bg-slate-50 text-slate-900' : 'border-slate-200 bg-slate-50 text-transparent'}`}>
                        {otp[index] || ''}
                      </div>
                    ))}
                  </div>
                  <button 
                    type="submit" 
                    disabled={otp.length !== 6 || isLoading}
                    className="w-full bg-slate-900 text-white font-black py-4 rounded-xl hover:bg-indigo-600 focus:ring-4 focus:ring-indigo-600/50 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed mt-2 active:scale-95 flex justify-center items-center h-[56px] outline-none"
                    aria-live="polite"
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true"></div>
                        <span>VERIFYING...</span>
                      </div>
                    ) : (
                      "CONFIRM & LOGIN"
                    )}
                  </button>
                </form>
                <div className="mt-8 text-center space-y-4">
                  <p className="text-sm text-slate-500 font-medium">
                    Didn't receive the code?{' '}
                    <button 
                      onClick={handleSendOtp} 
                      disabled={isLoading || cooldown > 0} 
                      className={`font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-1 ${cooldown > 0 ? 'text-slate-400 cursor-not-allowed' : 'text-indigo-600 hover:underline'}`}
                      aria-label={cooldown > 0 ? `Resend code in ${Math.floor(cooldown / 60)} minutes and ${cooldown % 60} seconds` : "Resend code"}
                    >
                      {cooldown > 0 ? `Resend in ${Math.floor(cooldown / 60)}:${(cooldown % 60).toString().padStart(2, '0')}` : 'Resend'}
                    </button>
                  </p>
                  <button onClick={() => setStep(1)} disabled={isLoading} className="text-xs font-bold text-slate-400 hover:text-slate-800 focus:outline-none focus:text-slate-800 focus:underline uppercase tracking-widest transition-colors">Change Email ID</button>
                </div>
              </motion.div>
            )}

            {/* ---------------- STEP 3: SUCCESS ---------------- */}
            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, type: 'spring' }} className="py-10 text-center" aria-live="assertive">
                <SuccessIcon />
                <h2 className="text-3xl font-black text-slate-900 mt-6 tracking-tight">Account Created!</h2>
                <p className="text-slate-500 mt-2 font-medium text-lg">Welcome to the Jack Essentials family.</p>
                <motion.div className="mt-10 bg-slate-50 px-6 py-4 rounded-full border border-slate-100 flex items-center justify-center gap-3 w-max mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                  <div className="w-5 h-5 border-2 border-slate-300 border-t-[#FF4500] rounded-full animate-spin" aria-hidden="true"></div>
                  <p className="text-xs text-slate-600 uppercase tracking-widest font-bold">Entering Dashboard...</p>
                </motion.div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* FLOATING STATUS TOAST */}
        <AnimatePresence>
          {status.msg && step !== 3 && (
            <motion.div 
              initial={{ opacity: 0, y: 50, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.9 }} 
              className={`absolute bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-sm flex items-center justify-center text-center font-bold text-sm px-6 py-4 rounded-2xl shadow-xl border z-50 ${
                status.type === 'error' ? 'bg-red-50 border-red-200 text-red-600' : 
                status.type === 'loading' ? 'bg-slate-900 border-slate-800 text-white' : 
                'bg-green-50 border-green-200 text-green-700'
              }`}
              role="alert"
              aria-live="assertive"
            >
              {status.msg}
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
};

export default Register;