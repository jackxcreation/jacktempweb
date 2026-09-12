import React from 'react';
import { FiExternalLink, FiBox } from 'react-icons/fi';

const ProductResultCard = ({ data }) => {
  if (!data || !data.title) return null;

  const inStock = data.stockStatus !== 'OUT_OF_STOCK';

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm mt-2 flex flex-col w-full max-w-sm cursor-pointer hover:shadow-md transition-shadow">
      {data.image && (
        <div className="h-32 w-full bg-slate-100 flex-shrink-0 border-b border-slate-200">
          <img 
            src={data.image} 
            alt={data.title} 
            className="w-full h-full object-cover"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        </div>
      )}
      <div className="p-3">
        <h4 className="text-sm font-bold text-slate-800 line-clamp-2 leading-tight">
          {data.title}
        </h4>
        <div className="flex items-end justify-between mt-2">
          <div className="flex flex-col">
            {data.price && (
              <span className="text-sm font-black text-slate-900">
                ₹{data.price}
              </span>
            )}
            <span className={`text-[10px] font-bold mt-0.5 flex items-center gap-1 ${inStock ? 'text-green-600' : 'text-red-500'}`}>
              <FiBox size={10} /> {inStock ? 'In Stock' : 'Out of Stock'}
            </span>
          </div>
          <button className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 transition-colors">
            <FiExternalLink size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductResultCard;