import React from 'react';
import { motion } from 'framer-motion';
import { FiCpu } from 'react-icons/fi';

const AIThinkingIndicator = () => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 5 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="flex flex-col max-w-[85%] mr-auto items-start mb-4"
    >
      <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm p-3.5 shadow-sm flex items-center gap-2.5">
        <FiCpu className="text-slate-400 animate-pulse" size={16} />
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
          Jack is checking
        </span>
        <div className="flex gap-1 ml-1">
          <div className="w-1.5 h-1.5 bg-[#FF4500] rounded-full animate-bounce"></div>
          <div className="w-1.5 h-1.5 bg-[#FF4500] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-1.5 h-1.5 bg-[#FF4500] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>
      </div>
    </motion.div>
  );
};

export default AIThinkingIndicator;