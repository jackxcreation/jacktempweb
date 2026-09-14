// jack-frontend/src/components/SmartPriceDropToast.jsx
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiTrendingDown, FiX } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';

const formatCurrency = (paise) => {
  if (typeof paise !== 'number') return '₹0.00';
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const SmartPriceDropToast = () => {
  const { socket } = useUser();
  const [alertData, setAlertData] = useState(null);
  const navigate = useNavigate();
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    const handlePriceDrop = (data) => {
      setAlertData(data);
      
      // Clear any existing active timeout
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      // Auto dismiss after 8 seconds
      timeoutRef.current = setTimeout(() => {
        setAlertData(null);
      }, 8000);
    };

    socket.on('smart_price_drop_recommendation', handlePriceDrop);

    return () => {
      socket.off('smart_price_drop_recommendation', handlePriceDrop);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [socket]);

  const handleDismiss = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setAlertData(null);
  };

  if (!alertData) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0, y: 50, scale: 0.9 }} 
        animate={{ opacity: 1, y: 0, scale: 1 }} 
        exit={{ opacity: 0, y: 20, scale: 0.9 }}
        className="fixed bottom-6 left-6 bg-slate-900 text-white p-4 rounded-2xl shadow-2xl z-50 max-w-sm border border-slate-800 flex items-start gap-3"
      >
        <div className="w-10 h-10 bg-orange-500/20 text-[#FF4500] rounded-xl flex items-center justify-center shrink-0 shadow-inner">
          <FiTrendingDown size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-black text-xs text-orange-400 uppercase tracking-widest mb-1">
            {alertData.title || 'Price Drop Alert!'}
          </h4>
          <p className="text-xs text-slate-300 font-medium leading-snug mb-3">
            {alertData.message}
            {/* Optional price display if provided in socket payload */}
            {alertData.newPrice && (
              <span className="block mt-1 font-bold text-emerald-400">
                Now only {formatCurrency(alertData.newPrice)}
              </span>
            )}
          </p>
          <button 
            onClick={() => { 
              if (alertData.productId) {
                navigate(`/product/${alertData.productId}`); 
              }
              handleDismiss(); 
            }}
            className="bg-[#FF4500] hover:bg-[#e03d00] text-white text-[10px] font-black uppercase tracking-wider px-4 py-2 rounded-xl transition-colors shadow-sm cursor-pointer"
          >
            Check Out Deal
          </button>
        </div>
        <button 
          onClick={handleDismiss} 
          aria-label="Close notification"
          className="text-slate-400 hover:text-white p-1 cursor-pointer"
        >
          <FiX size={16} />
        </button>
      </motion.div>
    </AnimatePresence>
  );
};

export default SmartPriceDropToast;