// jack-frontend/src/components/support/ShipmentTimeline.jsx
import React from 'react';
import { FiTruck, FiExternalLink, FiClock } from 'react-icons/fi';

const ShipmentTimeline = ({ data, onTrackClick }) => {
  if (!data) return null;

  // 🔥 UPGRADE: Normalize status aliases from different courier partners (e.g. Shiprocket/Delhivery)
  const rawStatus = String(data.status || data.shipmentStatus || 'PLACED').toUpperCase().replace(/\s+/g, '_');
  
  const statusMapping = {
    PROCESSING: 'PLACED',
    PENDING: 'PLACED',
    ORDERED: 'PLACED',
    DISPATCHED: 'SHIPPED',
    IN_TRANSIT: 'SHIPPED',
    TRANSIT: 'SHIPPED',
    OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
    DELIVERED: 'DELIVERED',
    COMPLETED: 'DELIVERED'
  };

  const normalizedStatus = statusMapping[rawStatus] || rawStatus;
  const stages = ['PLACED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'];
  const currentIdx = stages.indexOf(normalizedStatus);
  
  // Fallback index determination
  const activeIdx = currentIdx !== -1 ? currentIdx : (rawStatus.includes('DELIVER') ? 3 : 1);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm my-2 w-full max-w-sm">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
          <FiTruck className="text-indigo-600" size={16} /> Tracking Details
        </span>
        {data.courier && (
          <span className="text-[10px] bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg font-extrabold uppercase tracking-wider border border-slate-200">
            {data.courier}
          </span>
        )}
      </div>

      <div className="relative border-l-2 border-slate-100 ml-2 space-y-4 py-1">
        {stages.map((stage, idx) => {
          const isCompleted = idx <= activeIdx;
          const isCurrent = idx === activeIdx;
          
          return (
            <div key={stage} className="relative pl-5">
              <div className={`absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full ring-4 ring-white transition-all ${
                isCurrent ? 'bg-[#FF4500] shadow-[0_0_0_2px_rgba(255,69,0,0.3)] animate-pulse' : 
                isCompleted ? 'bg-indigo-600' : 'bg-slate-200'
              }`} />
              <p className={`text-xs font-bold ${
                isCurrent ? 'text-[#FF4500] font-black' : 
                isCompleted ? 'text-slate-800' : 'text-slate-400'
              }`}>
                {stage.replace(/_/g, ' ')}
              </p>
              {isCurrent && data.currentLocation && (
                <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
                  Current Location: {data.currentLocation}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {(data.estimatedDelivery || data.deliveryDate) && (
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs text-slate-600 font-semibold bg-indigo-50/50 p-2.5 rounded-xl">
          <FiClock className="text-indigo-600 flex-shrink-0" size={14} />
          <span>Est. Delivery: {data.estimatedDelivery || data.deliveryDate}</span>
        </div>
      )}

      {(data.awb || data.awbNumber || data.trackingId) && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-mono">
          <div>
            <span className="text-slate-400 uppercase tracking-widest block font-bold text-[9px]">AWB ID</span>
            <span className="font-bold text-slate-700">{data.awb || data.awbNumber || data.trackingId}</span>
          </div>
          {onTrackClick && (
            <button
              onClick={() => onTrackClick(data.awb || data.awbNumber || data.trackingId)}
              className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <span>Track</span>
              <FiExternalLink size={12} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ShipmentTimeline;