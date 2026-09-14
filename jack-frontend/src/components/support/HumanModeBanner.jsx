// jack-frontend/src/components/support/HumanModeBanner.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { FiShield } from 'react-icons/fi';

const HumanModeBanner = ({ agent }) => {
  const agentName = agent?.name || agent?.username || 'Support Agent';
  const agentRole = agent?.role || agent?.department || '';

  return (
    <motion.div 
      initial={{ height: 0, opacity: 0 }} 
      animate={{ height: 'auto', opacity: 1 }} 
      exit={{ height: 0, opacity: 0 }}
      role="status"
      aria-label={`Secure live chat connected with ${agentName}`}
      className="bg-indigo-600 text-indigo-50 px-4 py-2.5 flex items-center justify-between gap-2 shadow-inner z-0 overflow-hidden border-b border-indigo-700 flex-shrink-0"
    >
      <div className="flex items-center gap-2 truncate">
        <FiShield size={14} className="opacity-90 flex-shrink-0 text-indigo-200" />
        <span className="text-[10px] uppercase tracking-widest font-black truncate">
          Secure Live Chat • <span className="text-white underline decoration-indigo-400">{agentName}</span>
          {agentRole && <span className="opacity-75 font-normal ml-1">({agentRole})</span>}
        </span>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[9px] font-bold tracking-wider text-indigo-200 uppercase">Live</span>
      </div>
    </motion.div>
  );
};

export default HumanModeBanner;