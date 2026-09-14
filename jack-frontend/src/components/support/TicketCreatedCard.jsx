// jack-frontend/src/components/support/TicketCreatedCard.jsx
import React from 'react';
import { FiLifeBuoy, FiArrowRight, FiClock } from 'react-icons/fi';

const TicketCreatedCard = ({ data, onViewTicket }) => {
  if (!data) return null;

  // 🔥 UPGRADE: Support multiple id aliases (ticketId, id, _id)
  const ticketId = data.ticketId || data.id || data._id;
  if (!ticketId) return null;

  const priority = String(data.priority || 'MEDIUM').toUpperCase();
  const createdAt = data.createdAt ? new Date(data.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

  // Dynamic priority badge colors
  const getPriorityBadgeStyle = (p) => {
    switch (p) {
      case 'URGENT':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'HIGH':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 shadow-sm my-2 w-full max-w-sm text-center">
      <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-2 shadow-inner">
        <FiLifeBuoy size={20} />
      </div>
      <h4 className="text-sm font-black text-indigo-900 mb-1">Ticket Created Successfully</h4>
      <p className="text-xs text-indigo-700 font-medium mb-3">
        {data.message || 'Our support team has received your request and will get back to you shortly.'}
      </p>
      
      <div className="flex items-center justify-center gap-2 mb-3">
        <div className="bg-white rounded-xl px-3 py-2 border border-indigo-100 inline-block shadow-sm">
          <span className="text-[10px] text-slate-400 uppercase tracking-widest block mb-0.5 font-bold">Ticket ID</span>
          <span className="text-sm font-mono font-black text-slate-800">#{ticketId}</span>
        </div>
        
        {priority && (
          <div className={`px-2.5 py-2 rounded-xl text-[10px] font-black border ${getPriorityBadgeStyle(priority)} uppercase tracking-wider inline-flex flex-col justify-center items-center shadow-sm`}>
            <span className="text-[9px] opacity-75">Priority</span>
            <span>{priority}</span>
          </div>
        )}
      </div>

      {createdAt && (
        <div className="flex items-center justify-center gap-1 text-[10px] text-slate-500 mb-2">
          <FiClock size={12} />
          <span>Created at {createdAt}</span>
        </div>
      )}

      {onViewTicket && (
        <button
          onClick={() => onViewTicket(ticketId)}
          className="mt-1 w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 px-4 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
        >
          <span>View Ticket Status</span>
          <FiArrowRight size={14} />
        </button>
      )}
    </div>
  );
};

export default TicketCreatedCard;