import React from 'react';
import { motion } from 'framer-motion';
import { FiShield } from 'react-icons/fi';

const HumanModeBanner = ({ agent }) => {
  return (
    <motion.div 
      initial={{ height: 0, opacity: 0 }} 
      animate={{ height: 'auto', opacity: 1 }} 
      className="bg-indigo-600 text-indigo-50 px-4 py-2 flex items-center justify-center gap-2 shadow-inner z-0 overflow-hidden"
    >
      <FiShield size={14} className="opacity-90 flex-shrink-0" />
      <span className="text-[10px] uppercase tracking-widest font-black truncate">
        Secure Live Chat • {agent?.name || 'Agent'}
      </span>
    </motion.div>
  );
};

export default HumanModeBanner;