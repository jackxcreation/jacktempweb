// jack-frontend/src/components/support/ChatHeader.jsx
import React from 'react';
import { FiX, FiCheckCircle } from 'react-icons/fi';

const ChatHeader = ({ onClose, supportStatus, agent }) => {
  const getStatusDisplay = () => {
    const upperStatus = String(supportStatus || '').toUpperCase();
    const agentName = agent?.name || agent?.username || 'Support';

    switch (upperStatus) {
      case 'ESCALATING': 
      case 'WAITING_FOR_AGENT': 
        return { text: 'Connecting to support agent...', color: 'bg-yellow-400', badge: 'bg-slate-900' };
      case 'HUMAN_ACTIVE': 
        return { text: `Live with ${agentName}`, color: 'bg-emerald-400', badge: 'bg-indigo-600' };
      case 'RESOLVED': 
      case 'CLOSED': 
        return { text: 'Conversation Resolved', color: 'bg-slate-400', badge: 'bg-slate-900' };
      case 'AI_ACTIVE':
      default: 
        return { text: 'AI Assistant (Powered by Gemini)', color: 'bg-emerald-500', badge: 'bg-slate-900' }; // 🔥 Gemini branding maintained
    }
  };

  const statusInfo = getStatusDisplay();
  const upperStatus = String(supportStatus || '').toUpperCase();
  const isResolved = upperStatus === 'RESOLVED' || upperStatus === 'CLOSED';

  return (
    <div className={`text-white p-4 sm:p-5 flex items-center justify-between shadow-md z-10 transition-colors duration-300 flex-shrink-0 ${statusInfo.badge}`}>
      <div>
        <h2 className="font-black text-lg flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${statusInfo.color}`} />
          Jack Support
        </h2>
        <p className="text-xs text-slate-300 mt-0.5 flex items-center gap-1 font-medium">
          {isResolved && <FiCheckCircle size={12} className="text-emerald-400" />}
          <span>{statusInfo.text}</span>
        </p>
      </div>
      <button
        onClick={onClose}
        aria-label="Close Chat"
        className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-100 focus:outline-none focus:ring-2 focus:ring-white cursor-pointer"
      >
        <FiX size={22} />
      </button>
    </div>
  );
};

export default ChatHeader;