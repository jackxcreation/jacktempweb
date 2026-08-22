import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiUnlock, FiAlertCircle, FiMessageSquare } from 'react-icons/fi';
import { API_URL } from '../config';

const UnlockAccount = () => {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email');
  const [pin, setPin] = useState('');
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleUnlock = async (e) => {
    e.preventDefault();
    if (pin.length < 4) return;
    
    setIsLoading(true);
    setStatus({ type: '', msg: '' });

    try {
      const res = await fetch(`${API_URL}/users/unlock-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, securityCode: pin })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setStatus({ type: 'success', msg: "Identity verified! Removing security lock..." });
        // Redirect to login to create a fresh session safely
        setTimeout(() => navigate('/login'), 2500);
      } else {
        setStatus({ type: 'error', msg: data.error || "Incorrect Security PIN." });
      }
    } catch (err) {
      setStatus({ type: 'error', msg: "Connection Error. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinChange = (e) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    if (value.length <= 4) setPin(value);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B0F19] p-6 relative overflow-hidden font-sans">
      
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-slate-900 p-8 md:p-10 rounded-[2rem] shadow-2xl shadow-black/50 w-full max-w-lg border border-slate-800 relative z-10"
      >
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 bg-indigo-500/20 rounded-2xl flex items-center justify-center mb-5 border border-indigo-500/30">
            <FiUnlock size={28} className="text-indigo-400" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">Security Verification</h2>
          
          <div className="mt-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <p className="text-slate-300 text-sm leading-relaxed">
              To protect your account, you recently enabled a Security Lock. Please enter your 4-digit Security PIN to verify your identity. <br/><br/>
              <span className="text-indigo-400 font-bold">(This is a one-time verification. Once verified, you can log in normally.)</span>
            </p>
          </div>
          <p className="text-slate-500 text-xs mt-4 font-bold uppercase tracking-wider">{email}</p>
        </div>

        <form onSubmit={handleUnlock} className="space-y-6">
          <div className="relative">
            <input 
              type="password" 
              placeholder="••••" 
              value={pin} 
              onChange={handlePinChange}
              disabled={isLoading}
              className="w-full py-5 bg-slate-950 border-2 border-slate-800 rounded-2xl text-center text-3xl font-black tracking-[1em] text-white outline-none focus:border-indigo-500 transition-all shadow-inner"
            />
          </div>

          <button 
            type="submit" 
            disabled={isLoading || pin.length < 4}
            className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl hover:bg-indigo-500 active:scale-95 transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center h-[60px]"
          >
            {isLoading ? (
              <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              "VERIFY & UNLOCK"
            )}
          </button>
        </form>

        <AnimatePresence>
          {status.msg && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className={`mt-6 p-4 rounded-xl text-sm font-bold flex items-start gap-3 ${status.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}
            >
              <FiAlertCircle size={18} className="shrink-0 mt-0.5" />
              {status.msg}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-8 text-center border-t border-slate-800 pt-6">
          <p className="text-sm text-slate-400 font-medium flex items-center justify-center gap-2">
            Forgot security key? 
            <Link to="/support" className="text-indigo-400 font-bold hover:text-indigo-300 transition-colors flex items-center gap-1">
               Click here <FiMessageSquare size={14} />
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default UnlockAccount;