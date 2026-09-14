// jack-frontend/src/components/support/OrderStatusCard.jsx
import React from 'react';
import { FiPackage, FiCalendar, FiArrowRight, FiCheckCircle, FiClock } from 'react-icons/fi';

const OrderStatusCard = ({ data, onViewOrder }) => {
  if (!data) return null;

  // 🔥 UPGRADE: Support multiple order id aliases (orderId, id, _id)
  const orderId = data.orderId || data.id || data._id;
  if (!orderId) return null;

  const status = String(data.status || 'PROCESSING').toUpperCase();
  const total = data.totalAmount || data.total || data.amount;
  const deliveryDate = data.expectedDelivery || data.deliveryDate || data.estimatedDelivery;

  // Dynamic status badge styling
  const getStatusStyle = (st) => {
    switch (st) {
      case 'DELIVERED':
        return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      case 'CANCELLED':
      case 'RETURNED':
        return 'text-rose-600 bg-rose-50 border-rose-200';
      case 'SHIPPED':
      case 'OUT_FOR_DELIVERY':
        return 'text-indigo-600 bg-indigo-50 border-indigo-200';
      default:
        return 'text-[#FF4500] bg-orange-50 border-orange-200';
    }
  };

  const handleCardClick = () => {
    if (onViewOrder) {
      onViewOrder(orderId);
    } else if (typeof window !== 'undefined') {
      window.open(`/order/${orderId}`, '_blank');
    }
  };

  return (
    <div 
      onClick={handleCardClick}
      className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm my-2 w-full max-w-sm cursor-pointer hover:shadow-md hover:border-indigo-300 transition-all group"
    >
      <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex justify-between items-center">
        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1.5">
          <FiPackage size={13} className="text-indigo-600" /> Order #{orderId}
        </span>
        <span className="text-[10px] font-bold text-slate-400 group-hover:text-indigo-600 transition-colors flex items-center gap-1">
          View Details <FiArrowRight size={10} />
        </span>
      </div>

      <div className="p-4">
        <div className="flex justify-between items-center mb-3">
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Status</p>
            <div className={`mt-0.5 px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wide inline-flex items-center gap-1 border ${getStatusStyle(status)}`}>
              {status === 'DELIVERED' ? <FiCheckCircle size={12} /> : <FiClock size={12} />}
              <span>{status.replace(/_/g, ' ')}</span>
            </div>
          </div>
          {total && (
            <div className="text-right">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Amount</p>
              <p className="text-base font-black text-slate-900">₹{Number(total).toLocaleString('en-IN')}</p>
            </div>
          )}
        </div>
        
        {deliveryDate && (
          <div className="mt-3 bg-slate-50 rounded-xl p-2.5 flex items-center gap-2 border border-slate-100">
            <FiCalendar className="text-indigo-600 flex-shrink-0" size={15} />
            <p className="text-xs text-slate-600 font-medium">
              Delivery by: <span className="text-slate-900 font-bold">{deliveryDate}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderStatusCard;