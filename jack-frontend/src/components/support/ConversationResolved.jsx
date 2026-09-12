import React from 'react';
import { motion } from 'framer-motion';
import { FiCheckCircle, FiRefreshCw } from 'react-icons/fi';

const ConversationResolved = ({ onRestart }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }} 
      animate={{ opacity: 1, scale: 1 }} 
      className="my-6 mx-4"
    >
      <div className="bg-white border border-slate-200 rounded-xl p-6 text-center shadow-sm">
        <div className="w-14 h-14 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
          <FiCheckCircle size={28} />
        </div>
        <h3 className="text-sm font-black text-slate-800 mb-1">Issue Resolved</h3>
        <p className="text-xs text-slate-500 mb-5 leading-relaxed">
          This support conversation has been marked as resolved. If you need more help, you can always start a new chat.
        </p>
        <button 
          onClick={onRestart} 
          className="flex items-center justify-center gap-2 w-full py-3 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1"
        >
          <FiRefreshCw size={14} /> Start New Conversation
        </button>
      </div>
    </motion.div>
  );
};

export default ConversationResolved;