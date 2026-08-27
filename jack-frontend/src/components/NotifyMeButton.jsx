import React, { useState } from 'react';
import { FiBell } from 'react-icons/fi';
import axiosInstance from '../api/axiosInstance';

export const NotifyMeButton = ({ productId }) => {
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  const handleNotify = async () => {
    setLoading(true);
    try {
      // 🔥 PHASE 1 FIX: Removed '/api' prefix! 
      // Because axiosInstance baseURL is '.../api', adding '/api' here would cause a 404 on '/api/api/stock-alerts...'
      const res = await axiosInstance.post('/stock-alerts/subscribe', { productId });
      
      if (res.data.success) {
        setSubscribed(true);
        alert(res.data.message);
      }
    } catch (err) {
      alert(err.response?.data?.message || "Please login to set back-in-stock alerts.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={handleNotify}
      disabled={loading || subscribed}
      className={`w-full py-4 rounded-2xl font-black text-sm md:text-lg flex justify-center items-center gap-2 transition-all shadow-md ${subscribed ? 'bg-emerald-600 text-white cursor-default' : 'bg-slate-900 hover:bg-[#FF4500] text-white active:scale-95'}`}
    >
      <FiBell size={20} />
      <span>{subscribed ? "YOU WILL BE NOTIFIED" : "NOTIFY ME WHEN AVAILABLE"}</span>
    </button>
  );
};