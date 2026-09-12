import React from 'react';
import { FiLifeBuoy } from 'react-icons/fi';

const TicketCreatedCard = ({ data }) => {
  if (!data || !data.ticketId) return null;

  return (
    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 shadow-sm mt-2 w-full max-w-sm text-center">
      <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-2">
        <FiLifeBuoy size={20} />
      </div>
      <h4 className="text-sm font-black text-indigo-900 mb-1">Ticket Created</h4>
      <p className="text-xs text-indigo-700 font-medium mb-3">
        Our support team has received your request.
      </p>
      <div className="bg-white rounded-lg p-2 border border-indigo-100 inline-block">
        <span className="text-[10px] text-slate-500 uppercase tracking-widest block mb-0.5">Ticket ID</span>
        <span className="text-sm font-mono font-bold text-slate-800">#{data.ticketId}</span>
      </div>
      {data.priority === 'HIGH' && (
        <div className="mt-3 text-[10px] font-bold text-red-500 bg-red-50 inline-block px-2 py-1 rounded">
          Priority: High
        </div>
      )}
    </div>
  );
};

export default TicketCreatedCard;