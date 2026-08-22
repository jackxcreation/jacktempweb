import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMail, FiLock, FiEye, FiEyeOff, FiArrowLeft, FiShield, FiCheckCircle, FiKey, FiClock, FiAlertTriangle } from 'react-icons/fi';
import { API_URL } from '../config';

const ForgotPassword = () => {
  const [step, setStep] = useState(1); // 1: Email, 2: OTP, 3: New Password
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [isLoading, setIsLoading] = useState(false);
  
  // Security Features
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [cooldown, setCooldown] = useState(0);

  const navigate = useNavigate();

  // Cooldown Timer Logic
  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    } else if (cooldown === 0 && failedAttempts >= 3) {
      setFailedAttempts(0); // Reset attempts after cooldown ends
      setStatus({ type: '', msg: '' });
    }
    return () => clearInterval(timer);
  }, [cooldown, failedAttempts]);

  // Step 1: Send OTP to Email
  const handleSendOTP = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setStatus({ type: '', msg: '' });

    try {
      const response = await fetch(`${API_URL}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      const data = await response.json();
      if (response.ok) {
        setStatus({ type: 'success', msg: 'OTP sent to your email!' });
        setTimeout(() => {
          setStatus({ type: '', msg: '' });
          setStep(2);
        }, 1500);
      } else {
        setStatus({ type: 'error', msg: data.error || 'User not found.' });
      }
    } catch (error) {
      setStatus({ type: 'error', msg: 'Connection Error.' });
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: 🔥 REAL BACKEND OTP VERIFICATION 🔥
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setStatus({ type: 'error', msg: 'Please enter a valid 6-digit OTP.' });
      return;
    }
    
    setIsLoading(true);
    setStatus({ type: '', msg: '' });

    try {
      const response = await fetch(`${API_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });
      
      const data = await response.json();

      if (response.ok) {
        // OTP Verified Successfully! Now open Step 3
        setStatus({ type: 'success', msg: 'OTP Verified Successfully!' });
        setTimeout(() => {
          setStatus({ type: '', msg: '' });
          setStep(3); 
        }, 1200);
      } else {
        // Handle Failure & Cooldown
        const newFailCount = failedAttempts + 1;
        setFailedAttempts(newFailCount);
        
        if (newFailCount >= 3) {
          setCooldown(60); // 60 Seconds Cooldown
          setStatus({ type: 'error', msg: 'Too many failed attempts. Please wait 60s.' });
        } else {
          setStatus({ type: 'error', msg: data.error || 'Invalid OTP.' });
        }
        setOtp(''); // Clear OTP box so they type again
      }
    } catch (error) {
      setStatus({ type: 'error', msg: 'Connection Error.' });
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Final Reset Password
  const handleReset = async (e) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      setStatus({ type: 'error', msg: 'Passwords do not match.' });
      return;
    }
    
    setIsLoading(true);
    setStatus({ type: '', msg: '' });

    try {
      const response = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword })
      });
      
      const data = await response.json();

      if (response.ok) {
        setStatus({ type: 'success', msg: 'Password updated! Redirecting...' });
        setStep(4); // Success State
        setTimeout(() => navigate('/login'), 2500);
      } else {
        setStatus({ type: 'error', msg: data.error || 'Failed to update password.' });
      }
    } catch (error) {
      setStatus({ type: 'error', msg: 'Connection Error.' });
    } finally {
      setIsLoading(false);
    }
  };

  // Framer Motion Variants for smooth slide & fade
  const pageVariants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0, transition: { duration: 0.4, ease: "easeOut" } },
    exit: { opacity: 0, x: -20, transition: { duration: 0.2 } }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 font-sans relative overflow-hidden">
      {/* Premium Background Orbs */}
      <div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] bg-indigo-500 rounded-full mix-blend-multiply filter blur-[120px] opacity-20 animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-[#FF4500] rounded-full mix-blend-multiply filter blur-[120px] opacity-10"></div>

      <div className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-2xl shadow-indigo-100/50 w-full max-w-md border border-slate-100 relative z-10 overflow-hidden">
        
        {/* Progress Dots */}
        {step < 4 && (
          <div className="flex justify-center gap-2 mb-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${step >= i ? 'w-8 bg-slate-900' : 'w-2 bg-slate-200'}`} />
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">
          
          {/* STEP 1: EMAIL */}
          {step === 1 && (
            <motion.div key="step1" variants={pageVariants} initial="initial" animate="animate" exit="exit">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-slate-900/20">
                  <FiShield size={32} className="text-white" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Forgot Password?</h2>
                <p className="text-slate-500 text-sm mt-2 font-medium">Enter your registered email to receive a 6-digit OTP.</p>
              </div>

              <form onSubmit={handleSendOTP} className="space-y-5">
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition-colors"><FiMail size={18} /></div>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-11 py-4 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-600/10 transition-all font-medium" placeholder="Registered Email" required disabled={isLoading} />
                </div>
                <button type="submit" disabled={isLoading} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl hover:bg-indigo-600 active:scale-[0.98] transition-all flex justify-center items-center gap-2 shadow-xl shadow-slate-900/20">
                  {isLoading ? "SENDING..." : "SEND OTP"}
                </button>
              </form>
            </motion.div>
          )}

          {/* STEP 2: OTP */}
          {step === 2 && (
            <motion.div key="step2" variants={pageVariants} initial="initial" animate="animate" exit="exit">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
                  <FiKey size={32} className="text-indigo-600" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Enter OTP</h2>
                <p className="text-slate-500 text-sm mt-2 font-medium">We sent a secure code to <strong className="text-slate-800">{email}</strong></p>
              </div>

              <form onSubmit={handleVerifyOTP} className="space-y-6">
                <div className="relative">
                  <input 
                    type="text" 
                    maxLength={6} 
                    value={otp} 
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} // Strictly Numbers only
                    className={`w-full py-4 bg-slate-50/50 border ${cooldown > 0 ? 'border-red-300 bg-red-50 text-red-400' : 'border-slate-200'} rounded-2xl outline-none focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-600/10 transition-all font-black text-3xl text-center tracking-[0.5em]`} 
                    placeholder="------" 
                    required 
                    disabled={cooldown > 0 || isLoading}
                  />
                </div>
                
                {cooldown > 0 ? (
                  <div className="flex items-center justify-center gap-2 text-red-500 font-bold bg-red-50 py-3 rounded-xl">
                    <FiClock size={18} className="animate-pulse" />
                    <span>Try again in {cooldown}s</span>
                  </div>
                ) : (
                  <button type="submit" disabled={otp.length !== 6 || isLoading} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl hover:bg-indigo-600 disabled:opacity-50 disabled:hover:bg-slate-900 active:scale-[0.98] transition-all shadow-xl shadow-slate-900/20">
                    {isLoading ? "VERIFYING..." : "VERIFY CODE"}
                  </button>
                )}
                
                {cooldown === 0 && (
                   <button type="button" onClick={() => setStep(1)} className="w-full text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors">Wrong email? Change it</button>
                )}
              </form>
            </motion.div>
          )}

          {/* STEP 3: NEW PASSWORD */}
          {step === 3 && (
            <motion.div key="step3" variants={pageVariants} initial="initial" animate="animate" exit="exit">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-[#FF4500]/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
                  <FiLock size={32} className="text-[#FF4500]" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Secure Account</h2>
                <p className="text-slate-500 text-sm mt-2 font-medium">Create a strong new password.</p>
              </div>

              <form onSubmit={handleReset} className="space-y-5">
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition-colors"><FiLock size={18} /></div>
                  <input type={showPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full pl-11 py-4 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-600/10 transition-all font-medium" placeholder="New Password" required disabled={isLoading} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-700">{showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}</button>
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition-colors"><FiCheckCircle size={18} /></div>
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full pl-11 py-4 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-600/10 transition-all font-medium" placeholder="Confirm Password" required disabled={isLoading} />
                </div>
                
                <button type="submit" disabled={isLoading || newPassword.length < 6} className="w-full bg-[#FF4500] text-white font-black py-4 rounded-2xl hover:bg-orange-600 disabled:opacity-50 active:scale-[0.98] transition-all shadow-xl shadow-orange-500/20">
                  {isLoading ? "UPDATING..." : "UPDATE PASSWORD"}
                </button>
              </form>
            </motion.div>
          )}

          {/* STEP 4: SUCCESS */}
          {step === 4 && (
            <motion.div key="step4" variants={pageVariants} initial="initial" animate="animate" className="text-center py-6">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <FiCheckCircle size={40} className="text-green-500" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-2">All Set!</h2>
              <p className="text-slate-500 font-medium">Your password has been updated securely. Redirecting to login...</p>
            </motion.div>
          )}

        </AnimatePresence>

        {/* Global Status Messages */}
        {status.msg && step !== 4 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`mt-6 p-4 rounded-xl text-sm font-bold flex items-center gap-3 ${status.type === 'error' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
            {status.type === 'error' ? <FiAlertTriangle size={18} /> : <FiCheckCircle size={18} />}
            {status.msg}
          </motion.div>
        )}

        {/* Footer Link */}
        {step < 4 && (
          <div className="mt-8 text-center border-t border-slate-100 pt-6">
            <Link to="/login" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors"><FiArrowLeft size={16} /> Return to Login</Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;