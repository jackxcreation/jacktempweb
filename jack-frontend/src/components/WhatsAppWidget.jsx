// jack-frontend/src/components/support/WhatsAppWidget.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { FaWhatsapp } from 'react-icons/fa';

export const WhatsAppWidget = ({ customMessage, phoneNumber }) => {
  // Default WhatsApp Business Number & message as requested
  const whatsappNumber = phoneNumber || "917008559252"; 
  const defaultMessage = customMessage || "Hi Jack Essentials Support, I need help with my order/product.";

  const handleWhatsAppClick = () => {
    const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(defaultMessage)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <motion.div 
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 1, type: "spring", stiffness: 260, damping: 20 }}
      className="fixed bottom-6 left-6 z-50"
    >
      <button 
        onClick={handleWhatsAppClick}
        aria-label="Chat on WhatsApp"
        className="w-14 h-14 bg-[#25D366] hover:bg-[#20ba5a] text-white rounded-full flex items-center justify-center shadow-[0_10px_25px_rgba(37,211,102,0.4)] transition-all transform hover:scale-110 active:scale-95 group relative cursor-pointer"
      >
        <FaWhatsapp size={32} />
        
        {/* 🔥 Subtle live pulse ring for high visibility */}
        <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-25 pointer-events-none" />

        {/* Tooltip on hover */}
        <span className="absolute left-16 bg-slate-900 text-white text-xs font-bold py-1.5 px-3 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-md pointer-events-none">
          Chat on WhatsApp 💬
        </span>
      </button>
    </motion.div>
  );
};

export default WhatsAppWidget;