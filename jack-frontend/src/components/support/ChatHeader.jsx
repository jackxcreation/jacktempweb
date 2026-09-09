// components/support/ChatHeader.jsx
import React from 'react';
import { FiX, FiCheckCircle } from 'react-icons/fi';

const ChatHeader = ({ onClose, supportStatus, agent }) => {
  const getStatusDisplay = () => {
    switch (supportStatus) {
      case 'ESCALATING': return { text: 'Connecting to agent...', color: 'bg-yellow-400', badge: 'bg-slate-800' };
      case 'HUMAN_ACTIVE': return { text: `Live with ${agent?.name || 'Support'}`, color: 'bg-green-400', badge: 'bg-indigo-600' };
      case 'RESOLVED': return { text: 'Resolved', color: 'bg-slate-400', badge: 'bg-slate-800' };
      case 'AI_ACTIVE':
      default: return { text: 'AI Assistant (Powered by Groq)', color: 'bg-green-500', badge: 'bg-slate-900' };
    }
  };

  const statusInfo = getStatusDisplay();

  return (
    <div className={`text-white p-4 sm:p-5 flex items-center justify-between shadow-md z-10 transition-colors duration-300 ${statusInfo.badge}`}>
      <div>
        <h2 className="font-black text-lg flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full animate-pulse ${statusInfo.color}`}></div>
          Jack Support
        </h2>
        <p className="text-xs text-slate-300 mt-0.5 flex items-center gap-1">
          {supportStatus === 'RESOLVED' && <FiCheckCircle size={10} />}
          {statusInfo.text}
        </p>
      </div>
      <button
        onClick={onClose}
        aria-label="Close Chat"
        className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-100 focus:outline-none focus:ring-2 focus:ring-white"
      >
        <FiX size={24} />
      </button>
    </div>
  );
};

export default ChatHeader;