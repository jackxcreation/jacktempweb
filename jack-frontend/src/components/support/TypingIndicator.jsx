// jack-frontend/src/components/support/TypingIndicator.jsx
import React from 'react';
import { motion } from 'framer-motion';

const TypingIndicator = ({ agentName }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 5 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, scale: 0.9 }}
      aria-label={agentName ? `${agentName} is typing` : "Typing indicator"}
      className="flex flex-col max-w-[85%] mr-auto items-start mb-4"
    >
      {agentName && (
        <span className="text-[10px] text-slate-400 font-medium ml-1 mb-1">
          {agentName} is typing...
        </span>
      )}
      <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm p-3.5 shadow-sm flex items-center gap-1.5 h-9">
        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
      </div>
    </motion.div>
  );
};

export default TypingIndicator;