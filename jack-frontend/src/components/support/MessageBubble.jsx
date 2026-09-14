// jack-frontend/src/components/support/MessageBubble.jsx
import React from 'react';
import { motion } from 'framer-motion';

// Sub-component for Order Tracking rendering safely
const OrderTrackingCard = ({ data }) => {
  if (!data) return null;
  const orderId = data.orderId || data.id || data._id;
  if (!orderId) return null;

  return (
    <div className="bg-white rounded-xl p-3.5 mt-2 shadow-sm border border-slate-200 w-full max-w-sm">
      <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Order #{orderId}</div>
      <div className="font-bold text-slate-800 text-sm mb-2">Status: <span className="text-[#FF4500] uppercase">{data.status || 'PROCESSING'}</span></div>
      {data.expectedDelivery && <div className="text-xs text-slate-600 font-medium">Expected Delivery: <span className="text-slate-800 font-bold">{data.expectedDelivery}</span></div>}
      {data.awb && <div className="text-xs text-slate-600 font-mono mt-1 pt-1 border-t border-slate-100">AWB: {data.awb}</div>}
    </div>
  );
};

// Sub-component for Product rendering safely
const ProductCard = ({ data }) => {
  if (!data || !(data.title || data.name)) return null;
  const title = data.title || data.name;
  const price = data.price || data.mrp;
  const image = data.image || data.imageUrl || data.thumbnail;
  const stock = data.stockStatus || (data.inStock !== false ? 'In Stock' : 'Out of Stock');

  return (
    <div className="bg-white rounded-xl overflow-hidden mt-2 shadow-sm border border-slate-200 w-full max-w-sm">
      {image && <img src={image} alt={title} className="w-full h-32 object-cover" onError={(e) => { e.target.style.display = 'none'; }} />}
      <div className="p-3.5">
        <div className="font-bold text-slate-800 text-sm line-clamp-2 leading-snug">{title}</div>
        {price && <div className="text-[#FF4500] font-black text-sm mt-1.5">₹{Number(price).toLocaleString('en-IN')}</div>}
        {stock && <div className="text-[10px] font-bold text-emerald-600 mt-1 uppercase tracking-wider">{stock}</div>}
      </div>
    </div>
  );
};

const MessageBubble = ({ msg }) => {
  if (!msg) return null;

  if (msg.type === 'system') {
    return (
      <div className="flex justify-center my-3">
        <span className="bg-slate-200/80 text-slate-600 text-[10px] uppercase tracking-widest font-extrabold px-3.5 py-1.5 rounded-full shadow-sm text-center max-w-[85%]">
          {msg.text || msg.content}
        </span>
      </div>
    );
  }

  const sender = String(msg.sender || msg.senderType || 'bot').toLowerCase();
  const isUser = sender === 'user' || sender === 'customer';
  const isAdmin = sender === 'admin' || sender === 'agent';
  const isBot = sender === 'bot' || sender === 'ai';

  // Apply correct existing hierarchy branding
  const containerStyle = isUser ? 'ml-auto items-end' : 'mr-auto items-start';
  let bubbleStyle = 'p-3.5 rounded-2xl text-sm shadow-sm leading-relaxed border ';
  
  if (isUser) {
    bubbleStyle += 'bg-[#FF4500] text-white border-transparent rounded-tr-sm';
  } else if (isAdmin) {
    bubbleStyle += 'bg-indigo-50 border-indigo-200 text-indigo-950 rounded-tl-sm';
  } else {
    // AI Bot
    bubbleStyle += 'bg-white border-slate-200 text-slate-800 rounded-tl-sm';
  }

  const messageText = msg.text || msg.content;
  const messageTime = msg.time || (msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col max-w-[85%] ${containerStyle} mb-4`}
    >
      <div className={bubbleStyle}>
        {isAdmin && (
          <span className="block text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">
            Support Agent {msg.agentName ? `(${msg.agentName})` : ''}
          </span>
        )}
        
        {/* Render text if it exists */}
        {messageText && <div className="whitespace-pre-wrap break-words">{messageText}</div>}
        
        {/* Safe Rich Card Rendering */}
        {msg.structuredData && (
          <div className="mt-1">
            {['order_tracking', 'order_status'].includes(msg.structuredData.type) && (
              <OrderTrackingCard data={msg.structuredData.data || msg.structuredData} />
            )}
            {['product', 'product_recommendation'].includes(msg.structuredData.type) && (
              <ProductCard data={msg.structuredData.data || msg.structuredData} />
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 mt-1 px-1">
        {messageTime && <span className="text-[10px] text-slate-400 font-medium">{messageTime}</span>}
        {/* Fake Delivery Status for UI polish on user messages */}
        {isUser && msg.status && (
          <span className="text-[10px] text-slate-400">
            {msg.status === 'sent' && '✓'}
            {msg.status === 'delivered' && '✓✓'}
            {msg.status === 'error' && '⚠'}
          </span>
        )}
      </div>
    </motion.div>
  );
};

export default MessageBubble;