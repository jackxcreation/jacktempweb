// components/support/MessageBubble.jsx
import React from 'react';
import { motion } from 'framer-motion';

// Sub-component for Order Tracking rendering safely
const OrderTrackingCard = ({ data }) => {
  if (!data || !data.orderId) return null;
  return (
    <div className="bg-white rounded-lg p-3 mt-1 shadow-sm border border-slate-200">
      <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Order #{data.orderId}</div>
      <div className="font-bold text-slate-800 text-sm mb-2">Status: <span className="text-[#FF4500]">{data.status}</span></div>
      {data.expectedDelivery && <div className="text-xs text-slate-600">Expected Delivery: {data.expectedDelivery}</div>}
      {data.awb && <div className="text-xs text-slate-600 font-mono mt-1">AWB: {data.awb}</div>}
    </div>
  );
};

// Sub-component for Product rendering safely
const ProductCard = ({ data }) => {
  if (!data || !data.title) return null;
  return (
    <div className="bg-white rounded-lg overflow-hidden mt-1 shadow-sm border border-slate-200">
      {data.image && <img src={data.image} alt={data.title} className="w-full h-32 object-cover" />}
      <div className="p-3">
        <div className="font-bold text-slate-800 text-sm line-clamp-2">{data.title}</div>
        {data.price && <div className="text-[#FF4500] font-black text-sm mt-1">₹{data.price}</div>}
        {data.stockStatus && <div className="text-xs text-slate-500 mt-1">{data.stockStatus}</div>}
      </div>
    </div>
  );
};

const MessageBubble = ({ msg }) => {
  if (msg.type === 'system') {
    return (
      <div className="flex justify-center my-4">
        <span className="bg-slate-200 text-slate-600 text-[10px] uppercase tracking-widest font-bold px-3 py-1 rounded-full">
          {msg.text}
        </span>
      </div>
    );
  }

  const isUser = msg.sender === 'user';
  const isAdmin = msg.sender === 'admin';
  const isBot = msg.sender === 'bot';

  // Apply correct existing hierarchy branding
  let containerStyle = isUser ? 'ml-auto items-end' : 'mr-auto items-start';
  let bubbleStyle = 'p-3.5 rounded-2xl text-sm shadow-sm leading-relaxed border ';
  
  if (isUser) {
    bubbleStyle += 'bg-[#FF4500] text-white border-transparent rounded-tr-sm';
  } else if (isAdmin) {
    bubbleStyle += 'bg-indigo-100 border-indigo-200 text-indigo-900 rounded-tl-sm';
  } else {
    // AI Bot
    bubbleStyle += 'bg-white border-slate-200 text-slate-800 rounded-tl-sm';
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col max-w-[85%] ${containerStyle} mb-4`}
    >
      <div className={bubbleStyle}>
        {isAdmin && (
          <span className="block text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">
            Support Agent
          </span>
        )}
        
        {/* Render text if it exists */}
        {msg.text && <div className="whitespace-pre-wrap break-words">{msg.text}</div>}
        
        {/* Safe Rich Card Rendering */}
        {msg.structuredData && msg.structuredData.type === 'order_tracking' && (
          <OrderTrackingCard data={msg.structuredData.data} />
        )}
        {msg.structuredData && msg.structuredData.type === 'product' && (
          <ProductCard data={msg.structuredData.data} />
        )}
      </div>

      <div className="flex items-center gap-1 mt-1 px-1">
        <span className="text-[10px] text-slate-400 font-medium">{msg.time}</span>
        {/* Fake Delivery Status for UI polish on user messages */}
        {isUser && msg.status && (
          <span className="text-[10px] text-slate-400">
            {msg.status === 'sent' && '✓'}
            {msg.status === 'error' && '⚠'}
          </span>
        )}
      </div>
    </motion.div>
  );
};

export default MessageBubble;