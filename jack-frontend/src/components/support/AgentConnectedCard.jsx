import React from 'react';
import { motion } from 'framer-motion';
import { FiUserCheck } from 'react-icons/fi';

const AgentConnectedCard = ({ agent }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="flex justify-center my-4"
    >
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex items-center gap-3 shadow-sm max-w-[90%]">
        <div className="bg-indigo-100 text-indigo-600 p-2.5 rounded-full flex-shrink-0">
          <FiUserCheck size={18} />
        </div>
        <div>
          <p className="text-xs font-bold text-indigo-900">
            {agent?.name || 'A support agent'} joined the chat
          </p>
          <p className="text-[10px] text-indigo-600 mt-0.5 font-medium">
            {agent?.department || 'Live Support'}
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default AgentConnectedCard;