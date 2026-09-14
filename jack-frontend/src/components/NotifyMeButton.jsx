// jack-frontend/src/components/NotifyMeButton.jsx
import React, { useState } from 'react';
import { FiBell, FiCheckCircle } from 'react-icons/fi';
import axiosInstance from '../api/axiosInstance';

export const NotifyMeButton = ({ productId }) => {
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  const handleNotify = async () => {
    if (!productId || loading || subscribed) return;
    
    setLoading(true);
    try {
      // 🔥 PHASE 1 FIX: Removed '/api' prefix! 
      // Because axiosInstance baseURL is '.../api', adding '/api' here would cause a 404 on '/api/api/stock-alerts...'
      const res = await axiosInstance.post('/stock-alerts/subscribe', { productId });
      
      if (res?.data?.success) {
        setSubscribed(true);
        alert(res.data.message || "You will be notified when this item is back in stock!");
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || "Please login to set back-in-stock alerts.";
      alert(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={handleNotify}
      disabled={loading || subscribed}
      aria-label={subscribed ? "Subscribed to stock alert" : "Notify me when available"}
      className={`w-full py-4 rounded-2xl font-black text-sm md:text-base flex justify-center items-center gap-2.5 transition-all shadow-sm cursor-pointer ${
        subscribed 
          ? 'bg-emerald-600 text-white cursor-default shadow-none' 
          : 'bg-slate-900 hover:bg-[#FF4500] text-white active:scale-95'
      } disabled:opacity-80`}
    >
      {subscribed ? <FiCheckCircle size={20} /> : <FiBell size={20} className={loading ? "animate-bounce" : ""} />}
      <span>{loading ? "PROCESSING..." : subscribed ? "YOU WILL BE NOTIFIED" : "NOTIFY ME WHEN AVAILABLE"}</span>
    </button>
  );
};

export default NotifyMeButton;