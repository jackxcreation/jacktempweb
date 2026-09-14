// jack-frontend/src/components/SmartStockAlertToast.jsx
import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPackage, FiX } from 'react-icons/fi';
import { API_URL } from '../config';

export const SmartStockAlertToast = () => {
  const [alertInfo, setAlertInfo] = useState(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    // 🔥 UPGRADE: Robust token check matching multi-storage keys across app
    const token = localStorage.getItem('token') || 
                  localStorage.getItem('jack_token') || 
                  localStorage.getItem('admin_token');
    
    // Agar token nahi hai (yani user login nahi hai), toh wapas laut jao (Socket connect mat karo)
    if (!token) return;

    // Resolve socket base URL cleanly from API_URL config
    const socketUrl = API_URL ? API_URL.replace(/\/api$/, '') : (window.location.origin.includes('localhost') ? 'http://localhost:5000' : undefined);

    // Agar token mil gaya, tabhi safely socket connect karo
    const socket = io(socketUrl, {
      auth: { token },
      withCredentials: true
    });

    socket.on('stock_alert_notification', (data) => {
      setAlertInfo(data);
      
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      timeoutRef.current = setTimeout(() => {
        setAlertInfo(null);
      }, 6000); // Hide after 6 seconds
    });

    return () => {
      socket.disconnect();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleDismiss = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setAlertInfo(null);
  };

  if (!alertInfo) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.9 }}
        className="fixed bottom-6 right-6 bg-emerald-600 text-white p-4 rounded-2xl shadow-2xl z-[9999] max-w-sm border border-emerald-500 flex items-start gap-3"
      >
        <div className="w-10 h-10 bg-white/20 text-white rounded-xl flex items-center justify-center shrink-0 shadow-inner">
          <FiPackage size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-black text-xs text-emerald-100 uppercase tracking-widest mb-1">📦 Stock Alert!</h4>
          <p className="text-xs text-white font-medium leading-snug">
            {alertInfo.message || 'Item is back in stock!'}
          </p>
        </div>
        <button 
          onClick={handleDismiss}
          aria-label="Close notification"
          className="text-emerald-200 hover:text-white p-1 cursor-pointer transition-colors"
        >
          <FiX size={16} />
        </button>
      </motion.div>
    </AnimatePresence>
  );
};

export default SmartStockAlertToast;