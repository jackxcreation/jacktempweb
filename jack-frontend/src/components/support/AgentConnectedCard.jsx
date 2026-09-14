// jack-frontend/src/components/support/AgentConnectedCard.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { FiUserCheck } from 'react-icons/fi';

const AgentConnectedCard = ({ agent }) => {
  // 🔥 UPGRADE: Securely handle agent as object or string fallback
  const agentName = typeof agent === 'string' ? agent : (agent?.name || agent?.username || 'Support Agent');
  const agentDept = typeof agent === 'object' && (agent?.department || agent?.role) ? (agent.department || agent.role) : 'Live Support';
  const agentAvatar = typeof agent === 'object' ? (agent?.avatar || agent?.profilePic) : null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, scale: 0.95 }}
      role="status"
      aria-label={`${agentName} joined the chat`}
      className="flex justify-center my-3"
    >
      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-3.5 flex items-center gap-3.5 shadow-sm max-w-[90%] w-full">
        {agentAvatar ? (
          <img 
            src={agentAvatar} 
            alt={agentName} 
            className="w-10 h-10 rounded-full object-cover border-2 border-indigo-200 flex-shrink-0 shadow-sm"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className="bg-indigo-100 text-indigo-600 p-2.5 rounded-full flex-shrink-0 shadow-inner">
            <FiUserCheck size={18} />
          </div>
        )}
        
        <div className="overflow-hidden flex-1">
          <p className="text-xs font-black text-indigo-950 truncate">
            {agentName} <span className="font-bold text-indigo-600 font-normal">joined the chat</span>
          </p>
          <p className="text-[10px] text-indigo-600 mt-0.5 font-bold uppercase tracking-wider truncate">
            {agentDept}
          </p>
        </div>

        <div className="ml-auto flex-shrink-0 flex items-center gap-1.5 pl-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Active" />
        </div>
      </div>
    </motion.div>
  );
};

export default AgentConnectedCard;