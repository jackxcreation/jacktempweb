import React from 'react';
import { FiPackage, FiCalendar } from 'react-icons/fi';

const OrderStatusCard = ({ data }) => {
  if (!data || !data.orderId) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm mt-2 w-full max-w-sm">
      <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex justify-between items-center">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
          <FiPackage size={12} /> Order #{data.orderId}
        </span>
      </div>
      <div className="p-3">
        <div className="flex justify-between items-start mb-2">
          <div>
            <p className="text-[10px] text-slate-400 font-medium">Status</p>
            <p className="text-sm font-bold text-[#FF4500] uppercase tracking-wide">
              {data.status || 'PROCESSING'}
            </p>
          </div>
          {data.totalAmount && (
            <div className="text-right">
              <p className="text-[10px] text-slate-400 font-medium">Total</p>
              <p className="text-sm font-bold text-slate-800">₹{data.totalAmount}</p>
            </div>
          )}
        </div>
        
        {data.expectedDelivery && (
          <div className="mt-3 bg-slate-50 rounded p-2 flex items-center gap-2 border border-slate-100">
            <FiCalendar className="text-slate-400" size={14} />
            <p className="text-xs text-slate-600 font-medium">
              Delivery by: <span className="text-slate-800 font-bold">{data.expectedDelivery}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderStatusCard;