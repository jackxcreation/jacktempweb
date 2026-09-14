// jack-frontend/src/components/support/ConversationResolved.jsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FiCheckCircle, FiRefreshCw, FiStar } from 'react-icons/fi';

const ConversationResolved = ({ onRestart, onRateFeedback }) => {
  const [rating, setRating] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const handleRating = (stars) => {
    setRating(stars);
    setSubmitted(true);
    if (onRateFeedback) {
      onRateFeedback(stars);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }} 
      animate={{ opacity: 1, scale: 1 }} 
      className="my-6 mx-4"
    >
      <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center shadow-sm">
        <div className="w-14 h-14 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
          <FiCheckCircle size={28} />
        </div>
        <h3 className="text-sm font-black text-slate-900 mb-1">Issue Resolved</h3>
        <p className="text-xs text-slate-500 mb-4 leading-relaxed">
          This support conversation has been marked as resolved. If you need more help, you can always start a new chat.
        </p>

        {/* 🔥 NEW: Optional CSAT Feedback Rating Section */}
        {!submitted ? (
          <div className="mb-5 p-3 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-[11px] font-bold text-slate-700 mb-2">How was your support experience?</p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => handleRating(star)}
                  className="p-1.5 text-amber-400 hover:scale-110 transition-transform focus:outline-none cursor-pointer"
                  title={`${star} Star`}
                >
                  <FiStar size={18} className={rating >= star ? 'fill-current' : 'text-slate-300'} />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mb-5 p-2.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-xl border border-emerald-100 flex items-center justify-center gap-1.5">
            <span>⭐ Thank you for your feedback!</span>
          </div>
        )}

        <button 
          onClick={onRestart} 
          className="flex items-center justify-center gap-2 w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1 cursor-pointer"
        >
          <FiRefreshCw size={14} /> Start New Conversation
        </button>
      </div>
    </motion.div>
  );
};

export default ConversationResolved;