import React from 'react';
import { FiTruck } from 'react-icons/fi';

const ShipmentTimeline = ({ data }) => {
  if (!data || !data.status) return null;

  const stages = ['PLACED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'];
  const currentIdx = stages.indexOf(data.status.toUpperCase());
  
  // Fallback to 0 if unknown status
  const activeIdx = currentIdx !== -1 ? currentIdx : 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm mt-2 w-full max-w-sm">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <FiTruck className="text-indigo-500" /> Tracking Details
        </span>
        {data.courier && (
          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold">
            {data.courier}
          </span>
        )}
      </div>

      <div className="relative border-l-2 border-slate-100 ml-2 space-y-4">
        {stages.map((stage, idx) => {
          const isCompleted = idx <= activeIdx;
          const isCurrent = idx === activeIdx;
          
          return (
            <div key={stage} className="relative pl-4">
              <div className={`absolute -left-[5px] top-1 w-2 h-2 rounded-full ring-2 ring-white ${
                isCurrent ? 'bg-[#FF4500] shadow-[0_0_0_2px_rgba(255,69,0,0.2)]' : 
                isCompleted ? 'bg-indigo-500' : 'bg-slate-200'
              }`} />
              <p className={`text-xs font-bold ${
                isCurrent ? 'text-[#FF4500]' : 
                isCompleted ? 'text-slate-700' : 'text-slate-400'
              }`}>
                {stage.replace(/_/g, ' ')}
              </p>
            </div>
          );
        })}
      </div>

      {data.awb && (
        <div className="mt-4 pt-3 border-t border-slate-100 text-[10px] text-slate-500 font-mono">
          AWB: {data.awb}
        </div>
      )}
    </div>
  );
};

export default ShipmentTimeline;