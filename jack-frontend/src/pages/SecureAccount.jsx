import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiLock, FiShield, FiCheckCircle } from 'react-icons/fi';
import { io } from 'socket.io-client';
import { API_URL } from '../config';

// Initialize Socket
const socket = io(API_URL.replace('/api', ''));

const SecureAccount = () => {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email');
  const [pin, setPin] = useState('');
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLock = async () => {
    if (pin.length < 4) {
      setStatus({ type: 'error', msg: "Security PIN must be exactly 4 digits." });
      return;
    }
    
    setIsLoading(true);
    setStatus({ type: '', msg: '' });

    try {
      const res = await fetch(`${API_URL}/users/lock-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, newSecurityCode: pin })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setStatus({ type: 'success', msg: "Account Locked Successfully! Terminating other sessions..." });
        
        // 🔥 MAGIC: Trigger Instant Logout across all devices 🔥
        if (data.userId) {
          socket.emit('lock_user_session', data.userId);
        }

        setTimeout(() => navigate('/login'), 3000);
      } else {
        setStatus({ type: 'error', msg: data.error || "Failed to lock account." });
      }
    } catch (err) { 
      setStatus({ type: 'error', msg: "Connection failed. Please check your internet." });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinChange = (e) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    if (value.length <= 4) setPin(value);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 relative overflow-hidden font-sans">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-500/20 rounded-full blur-[120px] pointer-events-none"></div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white p-8 md:p-10 rounded-[2rem] shadow-2xl shadow-red-900/10 w-full max-w-md border border-red-50 relative z-10"
      >
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <FiShield size={40} className="text-red-600 animate-pulse" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Emergency Lock</h2>
          <p className="text-slate-500 text-sm mt-2 font-medium">Securing account for <br/><span className="text-slate-900 font-bold">{email}</span></p>
        </div>

        <div className="space-y-6">
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-slate-400">
              <FiLock size={20} />
            </div>
            <input 
              type="password" 
              placeholder="Set 4-Digit Security PIN" 
              value={pin} 
              onChange={handlePinChange}
              disabled={isLoading}
              className="w-full pl-14 pr-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-center text-2xl font-black tracking-[0.5em] text-slate-900 outline-none focus:border-red-500 focus:bg-white transition-all shadow-sm"
            />
          </div>

          <button 
            onClick={handleLock} 
            disabled={isLoading || pin.length < 4}
            className="w-full bg-red-600 text-white font-black py-4 rounded-2xl hover:bg-red-700 active:scale-95 transition-all shadow-lg shadow-red-600/30 disabled:opacity-50 flex justify-center items-center h-[60px]"
          >
            {isLoading ? (
              <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              "LOCK ACCOUNT NOW"
            )}
          </button>
        </div>

        <AnimatePresence>
          {status.msg && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className={`mt-6 p-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 ${status.type === 'error' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100'}`}
            >
              {status.type === 'success' && <FiCheckCircle size={18} />}
              {status.msg}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default SecureAccount;