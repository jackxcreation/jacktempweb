// src/pages/Register.jsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { FiUser, FiMail, FiLock, FiEye, FiEyeOff, FiCheck, FiArrowRight, FiPhone, FiCheckCircle, FiShield, FiX, FiAlertCircle, FiWifi, FiMessageCircle, FiZap, FiTruck, FiTag } from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';
import { auth, googleProvider } from '../firebase';
import { signInWithPopup } from 'firebase/auth';
import { API_URL } from '../config';
import axiosInstance from '../api/axiosInstance';

import { useUser } from '../context/UserContext';

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
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: 'easeOut' } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.2, ease: 'easeIn' } }
};
const toastVariants = {
  hidden: { opacity: 0, y: 40, scale: 0.95, x: '-50%' },
  show: { opacity: 1, y: 0, scale: 1, x: '-50%', transition: { type: 'spring', stiffness: 450, damping: 25 } },
  exit: { opacity: 0, y: 20, scale: 0.95, x: '-50%', transition: { duration: 0.2, ease: 'easeOut' } }
};
const lineReveal = {
  hidden: { y: '110%', rotate: 2 },
  show: (i) => ({ y: 0, rotate: 0, transition: { duration: 0.9, delay: 0.25 + i * 0.12, ease: [0.16, 1, 0.3, 1] } })
};

const NOISE = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

const MANIFESTO = [
  { n: '01', icon: FiTag, title: 'VIP Pricing', body: 'Member-only drops and early access to every launch.' },
  { n: '02', icon: FiMessageCircle, title: 'WhatsApp Verified', body: 'One-tap OTP. No spam, no passwords to remember.' },
  { n: '03', icon: FiTruck, title: 'Live Tracking', body: 'Real-time order updates straight to your phone.' }
];

const MARQUEE = ['Essentials', 'Crafted Daily', 'Members First', 'Verified Secure', 'Ships in 24h'];

// --- Presentational Atoms ---
const SuccessIcon = React.memo(() => (
  <motion.div className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-full flex justify-center items-center mx-auto mb-6 shadow-inner relative" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 10 }}>
    <div className="absolute inset-0 rounded-full border-4 border-emerald-200 animate-ping opacity-50"></div>
    <FiCheck size={40} aria-hidden="true" />
  </motion.div>
));

const Spinner = ({ className = '' }) => (
  <span className={`inline-block w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin ${className}`} aria-hidden="true" />
);

const FloatingInput = React.memo(({ icon: Icon, label, id, value, right, rightWidth = 'pr-12', accent = false, className = '', ...props }) => (
  <div className={`relative group ${className}`}>
    <Icon className={`absolute left-5 top-1/2 -translate-y-1/2 transition-colors duration-300 pointer-events-none z-10 ${accent ? 'text-emerald-500' : 'text-slate-400 group-focus-within:text-[#FF4500]'}`} size={18} aria-hidden="true" />
    <input
      id={id}
      value={value}
      placeholder=" "
      className={`peer w-full pl-13 ${rightWidth} pt-6 pb-2.5 bg-white/60 border rounded-2xl outline-none transition-[border-color,box-shadow,background-color] duration-300 font-semibold text-slate-900 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_1px_2px_rgba(15,23,42,0.04)] disabled:opacity-60 disabled:cursor-not-allowed focus:bg-white focus:border-[#FF4500] focus:ring-4 focus:ring-[#FF4500]/10 ${accent ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200/80 hover:border-slate-300'}`}
      style={{ paddingLeft: '3.25rem' }}
      {...props}
    />
    <label
      htmlFor={id}
      className={`absolute left-[3.25rem] top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm pointer-events-none transition-all duration-300 origin-left
        peer-focus:top-3 peer-focus:translate-y-0 peer-focus:text-[10px] peer-focus:font-black peer-focus:uppercase peer-focus:tracking-[0.18em] peer-focus:text-[#FF4500]
        peer-[:not(:placeholder-shown)]:top-3 peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-[10px] peer-[:not(:placeholder-shown)]:font-black peer-[:not(:placeholder-shown)]:uppercase peer-[:not(:placeholder-shown)]:tracking-[0.18em] ${accent ? 'peer-[:not(:placeholder-shown)]:text-emerald-600' : 'peer-[:not(:placeholder-shown)]:text-slate-500'}`}
    >
      {label}
    </label>
    {right && <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 z-10">{right}</div>}
  </div>
));

const EyeToggle = ({ shown, onToggle, label }) => (
  <motion.button type="button" onClick={onToggle} whileTap={{ scale: 0.85 }} aria-label={shown ? `Hide ${label}` : `Show ${label}`} className="p-2 mr-1 rounded-xl text-slate-400 hover:text-[#FF4500] hover:bg-orange-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4500]/40 transition-colors">
    <AnimatePresence mode="wait" initial={false}>
      <motion.span key={shown ? 'off' : 'on'} initial={{ opacity: 0, scale: 0.6, rotate: -20 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} exit={{ opacity: 0, scale: 0.6, rotate: 20 }} transition={{ duration: 0.15 }} className="block">
        {shown ? <FiEyeOff size={18} aria-hidden="true" /> : <FiEye size={18} aria-hidden="true" />}
      </motion.span>
    </AnimatePresence>
  </motion.button>
);

const RuleChip = ({ ok, children }) => (
  <motion.li layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border transition-colors duration-300 ${ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
    <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center transition-colors duration-300 ${ok ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-transparent'}`}>
      <FiCheck size={9} strokeWidth={4} />
    </span>
    {children}
  </motion.li>
);

const Register = ({ setIsLoggedIn }) => {
  const [step, setStep] = useState(1); // Step 1: Form details & WhatsApp OTP, Step 3: Success
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [whatsappOtp, setWhatsappOtp] = useState('');

  // WhatsApp OTP Verification States
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isMobileVerified, setIsMobileVerified] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  const [cooldown, setCooldown] = useState(0);
  const [otpAttempts, setOtpAttempts] = useState(0);

  const [status, setStatus] = useState({ type: '', msg: '' });
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from || '/';

  const isMounted = useRef(true);
  const isRequesting = useRef(false);

  const { loginUser, socialLoginUser } = useUser();

  // Ambient parallax (left panel)
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 40, damping: 20 });
  const sy = useSpring(my, { stiffness: 40, damping: 20 });
  const orbA = { x: useTransform(sx, [-1, 1], [-40, 40]), y: useTransform(sy, [-1, 1], [-30, 30]) };
  const orbB = { x: useTransform(sx, [-1, 1], [30, -30]), y: useTransform(sy, [-1, 1], [25, -25]) };
  const heroTilt = { rotateX: useTransform(sy, [-1, 1], [4, -4]), rotateY: useTransform(sx, [-1, 1], [-4, 4]) };
  const handlePanelMove = useCallback((e) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set(((e.clientX - r.left) / r.width) * 2 - 1);
    my.set(((e.clientY - r.top) / r.height) * 2 - 1);
  }, [mx, my]);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'Sign Up | Jack Essentials — Create Your Account';
  }, []);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Persistent Cooldown Setup
  useEffect(() => {
    const savedEndTime = sessionStorage.getItem('whatsappOtpCooldownEnd');
    if (savedEndTime) {
      const remaining = Math.floor((parseInt(savedEndTime, 10) - Date.now()) / 1000);
      if (remaining > 0) setCooldown(remaining);
      else sessionStorage.removeItem('whatsappOtpCooldownEnd');
    }
  }, []);

  // Cooldown Timer Engine
  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      sessionStorage.setItem('whatsappOtpCooldownEnd', (Date.now() + cooldown * 1000).toString());
      timer = setInterval(() => {
        if (isMounted.current) setCooldown((prev) => prev - 1);
      }, 1000);
    } else {
      sessionStorage.removeItem('whatsappOtpCooldownEnd');
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  // Toast status cleanup
  useEffect(() => {
    let timer;
    if (status.msg && status.type === 'error') {
      timer = setTimeout(() => {
        if (isMounted.current) setStatus({ type: '', msg: '' });
      }, 4000);
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
          if (res.status >= 500 && res.status <= 599 && i < maxRetries - 1) {
            await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
            continue;
          }

          let msg = data.error || data.message;
          if (!msg) {
            const statusMap = {
              400: 'Invalid request data. Please check your inputs.',
              401: 'Unauthorized access.',
              403: 'Access forbidden.',
              404: 'Endpoint not found.',
              409: 'Conflict. User might already exist.',
              422: 'Unprocessable Entity. Validation failed.',
              429: 'Too many requests. Please slow down.',
              500: 'Internal Server Error.',
              502: 'Bad Gateway.',
              503: 'Service temporarily unavailable.',
              504: 'Gateway Timeout.'
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
    setWhatsappOtp('');
    setIsOtpSent(false);
    setIsMobileVerified(false);
    setOtpAttempts(0);
    sessionStorage.removeItem('whatsappOtpCooldownEnd');
  }, []);

  const handleEmailChange = useCallback((e) => setEmail(e.target.value.toLowerCase().trim()), []);

  const handleMobileChange = useCallback((e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 10 && val.startsWith('91')) val = val.slice(2);
    setMobile(val.slice(0, 10));
    if (isMobileVerified) {
      setIsMobileVerified(false);
      setIsOtpSent(false);
    }
  }, [isMobileVerified]);

  const validatePassword = useCallback((pass) => {
    if (pass.length < 8) return 'Password must be at least 8 characters.';
    if (!/[A-Z]/.test(pass)) return 'Password must contain an uppercase letter.';
    if (!/[a-z]/.test(pass)) return 'Password must contain a lowercase letter.';
    if (!/[0-9]/.test(pass)) return 'Password must contain a number.';
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pass)) return 'Password must contain a special character.';
    return '';
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

  // Live rule checklist (UI only — mirrors validatePassword)
  const passRules = useMemo(() => ([
    { ok: password.length >= 8, label: '8+ chars' },
    { ok: /[A-Z]/.test(password), label: 'Uppercase' },
    { ok: /[a-z]/.test(password), label: 'Lowercase' },
    { ok: /[0-9]/.test(password), label: 'Number' },
    { ok: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password), label: 'Symbol' }
  ]), [password]);

  const confirmMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const confirmMatch = confirmPassword.length > 0 && password === confirmPassword;

  // Send WhatsApp OTP Handler
  const handleSendWhatsappOtp = useCallback(async () => {
    if (isSendingOtp) return;
    if (!navigator.onLine) return setStatus({ type: 'error', msg: 'No internet connection available.' });
    if (mobile.length !== 10) return setStatus({ type: 'error', msg: 'Enter a valid 10-digit mobile number before requesting OTP.' });

    let nextCooldown = 30;
    if (otpAttempts === 1) nextCooldown = 60;
    else if (otpAttempts === 2) nextCooldown = 300;
    else if (otpAttempts >= 3) nextCooldown = 600;

    setIsSendingOtp(true);
    setStatus({ type: 'loading', msg: 'Sending WhatsApp verification code...' });

    try {
      const res = await axiosInstance.post('/whatsapp/send-otp', { phone: `+91${mobile}` });
      if (!isMounted.current) return;

      if (res.data?.success) {
        setStatus({ type: 'success', msg: 'WhatsApp OTP sent successfully!' });
        setIsOtpSent(true);
        setCooldown(nextCooldown);
        setOtpAttempts(prev => prev + 1);
      } else {
        setStatus({ type: 'error', msg: res.data?.message || 'Failed to send WhatsApp OTP.' });
      }
    } catch (error) {
      if (isMounted.current) {
        setStatus({ type: 'error', msg: error.response?.data?.message || 'Failed to dispatch WhatsApp OTP.' });
      }
    } finally {
      if (isMounted.current) setIsSendingOtp(false);
    }
  }, [mobile, otpAttempts, isSendingOtp]);

  // Verify WhatsApp OTP Handler
  const handleVerifyWhatsappOtp = useCallback(async () => {
    if (isVerifyingOtp) return;
    if (!navigator.onLine) return setStatus({ type: 'error', msg: 'No internet connection available.' });
    if (whatsappOtp.length !== 6) return setStatus({ type: 'error', msg: 'Enter the valid 6-digit WhatsApp code.' });

    setIsVerifyingOtp(true);
    setStatus({ type: 'loading', msg: 'Verifying WhatsApp number...' });

    try {
      const res = await axiosInstance.post('/whatsapp/verify-otp', { phone: `+91${mobile}`, otp: whatsappOtp });
      if (!isMounted.current) return;

      if (res.data?.success) {
        setIsMobileVerified(true);
        setStatus({ type: 'success', msg: 'WhatsApp number verified successfully!' });
      } else {
        setStatus({ type: 'error', msg: res.data?.message || 'Invalid WhatsApp OTP code.' });
      }
    } catch (error) {
      if (isMounted.current) {
        setStatus({ type: 'error', msg: error.response?.data?.message || 'Verification failed.' });
      }
    } finally {
      if (isMounted.current) setIsVerifyingOtp(false);
    }
  }, [mobile, whatsappOtp, isVerifyingOtp]);

  // Complete Registration Handler (Canonical Route Alignment: /api/auth/register)
  const handleFinalRegister = useCallback(async (e) => {
    if (e) e.preventDefault();
    if (isRequesting.current) return;
    if (!navigator.onLine) return setStatus({ type: 'error', msg: 'No internet connection available.' });

    const passError = validatePassword(password);
    if (passError) return setStatus({ type: 'error', msg: passError });
    if (password !== confirmPassword) return setStatus({ type: 'error', msg: 'Passwords do not match!' });
    if (!isValidEmail) return setStatus({ type: 'error', msg: 'Enter a valid email address.' });
    if (!isMobileVerified) return setStatus({ type: 'error', msg: 'Please verify your mobile number via WhatsApp OTP before registering.' });

    isRequesting.current = true;
    setStatus({ type: 'loading', msg: 'Setting up your secure profile...' });

    try {
      // 🔥 CANONICAL AUTH ROUTE ALIGNMENT: Updated from /api/users/register to /api/auth/register
      const regRes = await safeFetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          email,
          phone: mobile,
          password
        })
      });

      if (!isMounted.current) return;

      if (regRes.ok) {
        await loginUser(email, password);
        if (setIsLoggedIn) setIsLoggedIn(true);

        setStep(3);
        resetForm();
        setTimeout(() => { if (isMounted.current) navigate(from, { replace: true }); }, 2500);
      } else {
        setStatus({ type: 'error', msg: regRes.message || 'Registration failed' });
      }
    } catch (error) {
      if (isMounted.current) setStatus({ type: 'error', msg: 'Connection Error.' });
    } finally {
      if (isMounted.current) isRequesting.current = false;
    }
  }, [name, email, mobile, password, confirmPassword, isValidEmail, isMobileVerified, validatePassword, loginUser, setIsLoggedIn, navigate, resetForm, from]);

  // Social Registration Handler (Canonical Route Alignment: /api/auth/social/google)
  const handleSocialRegister = useCallback(async (provider, providerName) => {
    if (isRequesting.current) return;
    if (!navigator.onLine) return setStatus({ type: 'error', msg: 'No internet connection available.' });

    isRequesting.current = true;
    setStatus({ type: 'loading', msg: `Connecting to ${providerName}...` });

    try {
      const result = await signInWithPopup(auth, provider);
      // 🔥 CANONICAL AUTH ROUTE ALIGNMENT: socialLoginUser internally points to /api/auth/social/google
      const dbRes = await socialLoginUser(result.user.displayName, result.user.email, result.user.uid);

      if (!isMounted.current) return;

      if (dbRes.success) {
        if (setIsLoggedIn) setIsLoggedIn(true);
        if (dbRes.isNewUser) {
          setStep(3);
          resetForm();
          setTimeout(() => { if (isMounted.current) navigate(from, { replace: true }); }, 2500);
        } else {
          setStatus({ type: 'success', msg: `Welcome back, ${result.user.displayName.split(' ')[0]}!` });
          resetForm();
          setTimeout(() => { if (isMounted.current) navigate(from, { replace: true }); }, 1500);
        }
      } else {
        setStatus({ type: 'error', msg: dbRes.message || 'Database sync failed!' });
      }
    } catch (error) {
      if (!isMounted.current) return;
      if (error.code !== 'auth/popup-closed-by-user') {
        setStatus({ type: 'error', msg: `Connection to ${providerName} failed.` });
      } else {
        setStatus({ type: '', msg: '' });
      }
    } finally {
      if (isMounted.current) isRequesting.current = false;
    }
  }, [socialLoginUser, setIsLoggedIn, navigate, resetForm, from]);

  const isFormValid = useMemo(() => {
    return name.trim().length > 0 &&
      isValidEmail &&
      mobile.length === 10 &&
      isMobileVerified &&
      validatePassword(password) === '' &&
      password === confirmPassword;
  }, [name, isValidEmail, mobile, isMobileVerified, password, confirmPassword, validatePassword]);

  const isLoading = status.type === 'loading' || isSendingOtp || isVerifyingOtp;

  const strengthColor = ['', 'bg-red-500', 'bg-amber-400', 'bg-sky-500', 'bg-emerald-500'][passStrength.score];
  const strengthText = ['', 'text-red-500', 'text-amber-500', 'text-sky-600', 'text-emerald-600'][passStrength.score];

  return (
    <div className="flex min-h-screen bg-[#F6F5F2] font-sans relative overflow-hidden selection:bg-[#FF4500] selection:text-white">

      {/* ================= LEFT PANEL — BRAND STORY ================= */}
      <div
        onMouseMove={handlePanelMove}
        className="hidden lg:flex lg:w-[45%] bg-[#0B0F19] text-white flex-col justify-between p-12 xl:p-16 relative overflow-hidden shadow-2xl z-10 select-none"
        role="complementary"
        style={{ perspective: 1200 }}
      >
        {/* Ambient orbs */}
        <motion.div style={orbA} className="absolute top-[-15%] right-[-15%] w-[640px] h-[640px] pointer-events-none">
          <motion.div animate={{ scale: [1, 1.12, 1], opacity: [0.28, 0.42, 0.28] }} transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }} className="w-full h-full bg-[#FF4500] rounded-full mix-blend-screen blur-[150px]" />
        </motion.div>
        <motion.div style={orbB} className="absolute bottom-[-25%] left-[-15%] w-[560px] h-[560px] pointer-events-none">
          <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.14, 0.26, 0.14] }} transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1 }} className="w-full h-full bg-indigo-600 rounded-full mix-blend-screen blur-[150px]" />
        </motion.div>
        {/* Grain + grid */}
        <div className="absolute inset-0 opacity-[0.07] mix-blend-overlay pointer-events-none" style={{ backgroundImage: NOISE }} aria-hidden="true" />
        <div className="absolute inset-0 pointer-events-none opacity-[0.06]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)', backgroundSize: '72px 72px', maskImage: 'radial-gradient(ellipse at 30% 40%, black 30%, transparent 75%)', WebkitMaskImage: 'radial-gradient(ellipse at 30% 40%, black 30%, transparent 75%)' }} aria-hidden="true" />

        {/* Top bar */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="z-10 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 rounded-lg p-1 -ml-1" aria-label="Jack Essentials — Home">
            <span className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xl flex items-center justify-center text-xl font-black tracking-tight" aria-hidden="true">J<span className="text-[#FF4500] group-hover:text-white transition-colors duration-300">S</span></span>
            <span className="text-xs font-bold tracking-[0.22em] text-slate-400 uppercase group-hover:text-slate-200 transition-colors">Jack Essentials</span>
          </Link>
          <div className="text-[11px] text-slate-400 font-bold tracking-[0.22em] uppercase flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-xl">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF4500] animate-pulse" aria-hidden="true"></span> Members Only
          </div>
        </motion.div>

        {/* Kinetic headline — masked line reveal */}
        <motion.div style={heroTilt} className="z-10 mt-10 relative will-change-transform">
          <h1 className="text-[64px] xl:text-[80px] font-black tracking-[-0.04em] leading-[0.95] mb-8">
            {['Join the', 'Elite', 'Club.'].map((line, i) => (
              <span key={line} className="block overflow-hidden pb-1">
                <motion.span custom={i} variants={lineReveal} initial="hidden" animate="show" className={`block origin-left ${i === 1 ? 'text-transparent bg-clip-text bg-gradient-to-r from-[#FF4500] via-orange-400 to-amber-300' : ''}`}>
                  {line}
                </motion.span>
              </span>
            ))}
          </h1>
          <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1, delay: 0.7, ease: [0.16, 1, 0.3, 1] }} className="w-20 h-1.5 origin-left bg-gradient-to-r from-[#FF4500] to-orange-300 rounded-full mb-7" />
          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.85 }} className="text-slate-400 max-w-sm text-lg font-medium leading-relaxed">
            Create an account with WhatsApp verification to unlock VIP pricing and instant order tracking.
          </motion.p>
        </motion.div>

        {/* Numbered manifesto */}
        <motion.ul variants={containerVariants} initial="hidden" animate="show" className="z-10 mt-12 space-y-0 border-t border-white/10">
          {MANIFESTO.map(({ n, icon: Icon, title, body }) => (
            <motion.li key={n} variants={itemVariants} className="group flex items-start gap-5 py-4 border-b border-white/10 hover:border-[#FF4500]/50 transition-colors">
              <span className="text-[11px] font-black tracking-widest text-[#FF4500] pt-1 tabular-nums">{n}</span>
              <span className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-300 group-hover:text-[#FF4500] group-hover:border-[#FF4500]/40 group-hover:-translate-y-0.5 transition-[color,border-color,transform] duration-300 shrink-0"><Icon size={16} /></span>
              <span className="min-w-0">
                <span className="block font-black text-sm tracking-tight">{title}</span>
                <span className="block text-slate-500 text-xs font-medium mt-0.5">{body}</span>
              </span>
            </motion.li>
          ))}
        </motion.ul>

        {/* Editorial marquee */}
        <div className="z-10 mt-auto pt-10 overflow-hidden" aria-hidden="true">
          <motion.div animate={{ x: ['0%', '-50%'] }} transition={{ duration: 28, repeat: Infinity, ease: 'linear' }} className="flex w-max gap-10 whitespace-nowrap">
            {[...MARQUEE, ...MARQUEE].map((w, i) => (
              <span key={i} className="flex items-center gap-10 text-[11px] font-black uppercase tracking-[0.3em] text-slate-600">
                {w} <span className="w-1.5 h-1.5 rounded-full bg-[#FF4500]/70" />
              </span>
            ))}
          </motion.div>
        </div>
      </div>

      {/* ================= RIGHT PANEL — AUTH CARD ================= */}
      <div className="w-full lg:w-[55%] flex flex-col items-center justify-center p-4 sm:p-6 md:p-12 relative z-20 overflow-hidden" role="main">
        {/* Soft ambient glows behind the glass card */}
        <div className="absolute -top-40 -right-40 w-[520px] h-[520px] rounded-full bg-[#FF4500]/15 blur-[140px] pointer-events-none" aria-hidden="true" />
        <div className="absolute -bottom-48 -left-32 w-[460px] h-[460px] rounded-full bg-indigo-400/15 blur-[140px] pointer-events-none" aria-hidden="true" />
        <div className="absolute inset-0 opacity-[0.35] pointer-events-none" style={{ backgroundImage: 'radial-gradient(rgba(15,23,42,.10) 1px, transparent 1px)', backgroundSize: '28px 28px', maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 70%)', WebkitMaskImage: 'radial-gradient(ellipse at center, black 20%, transparent 70%)' }} aria-hidden="true" />

        {/* Offline HUD Banner */}
        <AnimatePresence>
          {!navigator.onLine && (
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

        <motion.div variants={containerVariants} initial="hidden" animate="show" className="w-full max-w-[480px] relative py-6">

          {/* Mobile brand mark */}
          <div className="lg:hidden flex flex-col items-center mb-6" aria-hidden="true">
            <Link to="/" className="w-14 h-14 bg-[#0B0F19] rounded-2xl flex items-center justify-center mb-3 shadow-xl shadow-slate-900/20 hover:scale-105 transition-transform">
              <span className="text-2xl font-black text-white tracking-tight">J<span className="text-[#FF4500]">S</span></span>
            </Link>
          </div>

          {/* Glass card */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="relative rounded-[28px] bg-white/70 backdrop-blur-2xl border border-white/80 shadow-[0_30px_80px_-30px_rgba(15,23,42,0.25),0_1px_0_rgba(255,255,255,0.9)_inset] p-6 sm:p-9"
          >
            <div className="absolute inset-x-10 -top-px h-px bg-gradient-to-r from-transparent via-[#FF4500]/70 to-transparent" aria-hidden="true" />

            <AnimatePresence mode="wait">

              {/* ---------------- STEP 1: REGISTRATION FORM WITH WHATSAPP OTP ---------------- */}
              {step === 1 && (
                <motion.div key="step1" variants={formVariants} initial="hidden" animate="visible" exit="exit">
                  <div className="mb-7 text-center lg:text-left">
                    <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-[#FF4500] mb-3">
                      <FiShield size={12} /> Secure Sign Up
                    </div>
                    <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-[-0.03em] flex items-center justify-center lg:justify-start gap-3">
                      Create Account <span className="text-[#FF4500] select-none">✦</span>
                    </h2>
                    <p className="text-slate-500 mt-2 font-medium text-sm sm:text-base">Verify your mobile via WhatsApp to register securely.</p>
                  </div>

                  <form onSubmit={handleFinalRegister} className="space-y-3.5" noValidate>
                    <FloatingInput
                      id="reg-name" icon={FiUser} label="Full Name"
                      type="text" value={name} onChange={(e) => setName(e.target.value)} disabled={isLoading}
                      rightWidth="pr-5" aria-label="Full Name" autoComplete="name" required
                    />

                    <FloatingInput
                      id="reg-email" icon={FiMail} label="Email Address"
                      type="email" value={email} onChange={handleEmailChange} disabled={isLoading}
                      rightWidth="pr-12" aria-label="Email Address" autoComplete="email" required
                      right={
                        <AnimatePresence>
                          {isValidEmail && (
                            <motion.span initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} className="mr-2 text-emerald-500"><FiCheckCircle size={18} /></motion.span>
                          )}
                        </AnimatePresence>
                      }
                    />

                    {/* Mobile Number & WhatsApp OTP Inline Section */}
                    <div className="space-y-2">
                      <FloatingInput
                        id="reg-mobile" icon={FiPhone} label="Mobile Number (10 digits)"
                        type="tel" value={mobile} onChange={handleMobileChange} maxLength="10"
                        disabled={isLoading || isMobileVerified} accent={isMobileVerified}
                        rightWidth="pr-40" aria-label="Mobile Number" autoComplete="tel" required
                        right={
                          isMobileVerified ? (
                            <motion.span initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-1.5 bg-emerald-500 text-white font-black text-[11px] px-3 py-2 rounded-xl shadow-[0_6px_16px_-6px_rgba(16,185,129,0.7)]">
                              <FiCheckCircle size={14} /> Verified
                            </motion.span>
                          ) : (
                            <motion.button
                              type="button"
                              onClick={handleSendWhatsappOtp}
                              disabled={mobile.length !== 10 || isSendingOtp || cooldown > 0}
                              whileHover={{ y: -1 }} whileTap={{ scale: 0.96 }}
                              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black px-3.5 py-2.5 rounded-xl transition-colors shadow-[0_8px_18px_-8px_rgba(5,150,105,0.8)] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none tabular-nums"
                            >
                              {isSendingOtp ? <Spinner /> : <FiMessageCircle size={13} />}
                              {isSendingOtp ? 'Sending...' : cooldown > 0 ? `Resend (${cooldown}s)` : isOtpSent ? 'Resend OTP' : 'Send OTP'}
                            </motion.button>
                          )
                        }
                      />

                      {/* WhatsApp OTP Input Row */}
                      <AnimatePresence>
                        {isOtpSent && !isMobileVerified && (
                          <motion.div initial={{ opacity: 0, y: -10, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: -6, height: 0 }} className="overflow-hidden">
                            <div className="flex items-center gap-2 pt-1 pl-1">
                              <div className="relative flex-1 group">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600 pointer-events-none">OTP</span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  maxLength="6"
                                  value={whatsappOtp}
                                  onChange={(e) => setWhatsappOtp(e.target.value.replace(/\D/g, ''))}
                                  placeholder="• • • • • •"
                                  aria-label="6-digit WhatsApp OTP"
                                  className="w-full bg-white/70 border border-emerald-200 rounded-xl pl-14 pr-4 py-3.5 tracking-[0.45em] text-lg font-black text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-[border-color,box-shadow] placeholder:text-slate-300 placeholder:tracking-[0.3em]"
                                />
                              </div>
                              <motion.button
                                type="button"
                                onClick={handleVerifyWhatsappOtp}
                                disabled={whatsappOtp.length !== 6 || isVerifyingOtp}
                                whileHover={{ y: -1 }} whileTap={{ scale: 0.96 }}
                                className="flex items-center gap-2 bg-slate-900 hover:bg-emerald-600 text-white font-black text-xs px-5 py-4 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_10px_24px_-10px_rgba(15,23,42,0.6)]"
                              >
                                {isVerifyingOtp && <Spinner />}
                                {isVerifyingOtp ? 'Verifying' : 'Verify'}
                              </motion.button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <FloatingInput
                      id="reg-password" icon={FiLock} label="Create Password"
                      type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} disabled={isLoading}
                      rightWidth="pr-14" aria-label="Create Password" autoComplete="new-password" required
                      right={<EyeToggle shown={showPassword} onToggle={() => setShowPassword(!showPassword)} label="password" />}
                    />

                    {/* Password Strength Indicator */}
                    <AnimatePresence>
                      {password.length > 0 && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden" aria-live="polite">
                          <div className="flex flex-col gap-2 px-1.5 pb-1">
                            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                              <span>Password Strength</span>
                              <AnimatePresence mode="wait">
                                <motion.span key={passStrength.text} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className={strengthText}>{passStrength.text}</motion.span>
                              </AnimatePresence>
                            </div>
                            <div className="flex gap-1.5" aria-label={`Password strength: ${passStrength.text}`}>
                              {[1, 2, 3, 4].map((seg) => (
                                <div key={seg} className="h-1.5 flex-1 rounded-full bg-slate-200/80 overflow-hidden">
                                  <motion.div
                                    initial={false}
                                    animate={{ scaleX: passStrength.score >= seg ? 1 : 0 }}
                                    transition={{ duration: 0.35, delay: passStrength.score >= seg ? (seg - 1) * 0.05 : 0, ease: [0.16, 1, 0.3, 1] }}
                                    className={`h-full w-full origin-left rounded-full ${strengthColor}`}
                                  />
                                </div>
                              ))}
                            </div>
                            <ul className="flex flex-wrap gap-1.5 pt-0.5">
                              {passRules.map((r) => <RuleChip key={r.label} ok={r.ok}>{r.label}</RuleChip>)}
                            </ul>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <FloatingInput
                      id="reg-confirm" icon={FiLock} label="Confirm Password"
                      type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={isLoading}
                      accent={confirmMatch}
                      className={confirmMismatch ? '[&>input]:border-red-300 [&>input]:bg-red-50/40 [&>input]:focus:border-red-400 [&>input]:focus:ring-red-400/10' : ''}
                      rightWidth="pr-14" aria-label="Confirm Password" autoComplete="new-password" required
                      right={<EyeToggle shown={showConfirmPassword} onToggle={() => setShowConfirmPassword(!showConfirmPassword)} label="confirm password" />}
                    />
                    <AnimatePresence>
                      {confirmMismatch && (
                        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="!mt-1.5 px-2 text-[11px] font-bold text-red-500 flex items-center gap-1.5"><FiAlertCircle size={12} /> Passwords don't match yet.</motion.p>
                      )}
                    </AnimatePresence>

                    <div className="pt-3">
                      <motion.button
                        type="submit"
                        disabled={!isFormValid || isLoading}
                        whileHover={isFormValid && !isLoading ? { y: -2 } : {}}
                        whileTap={isFormValid && !isLoading ? { scale: 0.98 } : {}}
                        className={`group relative w-full overflow-hidden text-white font-black py-4 rounded-2xl outline-none transition-[background-color,box-shadow,opacity] duration-300 flex justify-center items-center h-[58px] disabled:cursor-not-allowed
                          ${isFormValid && !isLoading
                            ? 'bg-slate-900 hover:bg-[#FF4500] shadow-[0_18px_40px_-14px_rgba(15,23,42,0.55)] hover:shadow-[0_22px_48px_-12px_rgba(255,69,0,0.65)] focus-visible:ring-4 focus-visible:ring-[#FF4500]/30'
                            : 'bg-slate-900 disabled:opacity-40'}`}
                        aria-live="polite"
                      >
                        {/* Sheen */}
                        <span className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-[900ms] ease-out bg-gradient-to-r from-transparent via-white/25 to-transparent" aria-hidden="true" />
                        {isLoading ? (
                          <div className="flex items-center gap-3">
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true"></div>
                            <span className="tracking-[0.18em] text-xs font-black uppercase">Securing Registration...</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="tracking-wide">Complete Registration</span>
                            <FiArrowRight size={18} aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1" />
                          </div>
                        )}
                      </motion.button>
                      <p className="mt-3 text-center text-[11px] text-slate-400 font-medium flex items-center justify-center gap-1.5">
                        <FiShield size={12} className="text-emerald-500" /> 256-bit encrypted · WhatsApp verified · No spam, ever
                      </p>
                    </div>
                  </form>

                  <div className="relative flex items-center my-6 select-none" aria-hidden="true">
                    <div className="flex-grow border-t border-slate-200/80"></div>
                    <span className="flex-shrink-0 mx-4 text-slate-400 text-[10px] font-black uppercase tracking-[0.22em]">Or register with</span>
                    <div className="flex-grow border-t border-slate-200/80"></div>
                  </div>

                  <div className="flex justify-center mb-7">
                    <motion.button
                      type="button"
                      onClick={() => handleSocialRegister(googleProvider, 'Google')}
                      disabled={isLoading}
                      whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
                      className="group w-full flex justify-center items-center gap-3 py-3.5 border border-slate-200 rounded-2xl bg-white hover:border-slate-300 hover:shadow-[0_14px_30px_-16px_rgba(15,23,42,0.35)] transition-[border-color,box-shadow] duration-300 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/10"
                      aria-label="Sign up with Google"
                    >
                      <span className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center group-hover:rotate-[360deg] transition-transform duration-700 ease-out"><FcGoogle size={18} aria-hidden="true" /></span>
                      <span className="font-bold text-slate-700 text-sm">Sign up with Google</span>
                    </motion.button>
                  </div>

                  <div className="text-center">
                    <p className="text-sm text-slate-400 font-medium">
                      Already have an account?{' '}
                      <Link to="/login" state={{ from: from }} className="relative inline-block text-slate-900 font-black hover:text-[#FF4500] transition-colors ml-1 after:absolute after:left-0 after:-bottom-0.5 after:h-[2px] after:w-full after:origin-left after:scale-x-0 after:bg-[#FF4500] after:transition-transform after:duration-300 hover:after:scale-x-100">Sign in here</Link>
                    </p>
                  </div>
                </motion.div>
              )}

              {/* ---------------- STEP 3: SUCCESS ---------------- */}
              {step === 3 && (
                <motion.div key="step3" variants={formVariants} initial="hidden" animate="visible" exit="exit" className="py-10 text-center" aria-live="assertive">
                  <SuccessIcon />
                  <h2 className="text-3xl font-black text-slate-900 mt-6 tracking-[-0.03em]">Account Created!</h2>
                  <p className="text-slate-500 mt-2 font-medium text-lg">Welcome to the Jack Essentials family.</p>
                  <motion.div className="mt-10 bg-white/80 backdrop-blur-xl px-6 py-4 rounded-full border border-slate-100 flex items-center justify-center gap-3 w-max mx-auto shadow-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                    <div className="w-5 h-5 border-2 border-slate-300 border-t-[#FF4500] rounded-full animate-spin" aria-hidden="true"></div>
                    <p className="text-xs text-slate-600 uppercase tracking-widest font-black">Entering Dashboard...</p>
                  </motion.div>
                </motion.div>
              )}

            </AnimatePresence>
          </motion.div>
        </motion.div>

        {/* Global Toast HUD */}
        <div className="absolute bottom-6 left-0 right-0 pointer-events-none flex justify-center z-50 px-4">
          <AnimatePresence>
            {status.msg && step !== 3 && (
              <motion.div
                variants={toastVariants}
                initial="hidden"
                animate="show"
                exit="exit"
                role="alert"
                aria-live="assertive"
                className={`pointer-events-auto flex items-center justify-between gap-3 w-full max-w-sm font-bold text-xs sm:text-sm pl-4 pr-3 py-3.5 rounded-2xl shadow-[0_20px_50px_-20px_rgba(15,23,42,0.4)] border backdrop-blur-2xl relative overflow-hidden ${
                  status.type === 'error'
                    ? 'bg-white/90 border-red-200 text-red-700'
                    : status.type === 'loading'
                      ? 'bg-slate-950/95 border-slate-800 text-white'
                      : 'bg-white/90 border-emerald-200 text-emerald-700'
                }`}
              >
                <span className={`absolute left-0 top-0 bottom-0 w-1 ${status.type === 'error' ? 'bg-red-500' : status.type === 'loading' ? 'bg-[#FF4500]' : 'bg-emerald-500'}`} aria-hidden="true" />
                {status.type === 'error' && (
                  <motion.span initial={{ scaleX: 1 }} animate={{ scaleX: 0 }} transition={{ duration: 4, ease: 'linear' }} className="absolute left-0 bottom-0 h-[2px] w-full origin-left bg-red-300" aria-hidden="true" />
                )}
                <div className="flex items-center gap-2.5 min-w-0 pl-1">
                  {status.type === 'error' && <FiAlertCircle size={18} className="flex-shrink-0 text-red-500" />}
                  {status.type === 'success' && <FiCheckCircle size={18} className="flex-shrink-0 text-emerald-600" />}
                  {status.type === 'loading' && <FiZap size={18} className="flex-shrink-0 text-[#FF4500] animate-pulse" />}
                  <span className="leading-snug truncate pr-2">{status.msg}</span>
                </div>
                {status.type !== 'loading' && (
                  <button type="button" onClick={() => setStatus({ type: '', msg: '' })} aria-label="Dismiss" className="p-1.5 rounded-lg opacity-60 hover:opacity-100 hover:bg-black/5 transition-[opacity,background-color]">
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

export default Register;