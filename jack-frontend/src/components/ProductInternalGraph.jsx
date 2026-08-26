import React from 'react';
import { Link } from 'react-router-dom';
import { FiChevronRight, FiLayers, FiCompass } from 'react-icons/fi';

export const ProductInternalGraph = ({ product }) => {
  if (!product) return null;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 md:p-8 mt-12 mb-8">
      <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
        <FiCompass className="text-[#FF4500]" /> Explore Related Guides & Ecosystem
      </h3>

      <div className="flex flex-wrap items-center gap-3 text-sm font-bold">
        {/* 1. Current Product to Category */}
        <Link 
          to={`/shop?category=${encodeURIComponent(product.category)}`} 
          className="bg-white hover:border-[#FF4500] hover:text-[#FF4500] text-slate-700 px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm transition-all flex items-center gap-2"
        >
          <span>{product.category}</span>
          <FiChevronRight size={14} className="text-slate-400" />
        </Link>

        {/* 2. Category to Brand */}
        <Link 
          to={`/shop?brand=${encodeURIComponent(product.brand)}`} 
          className="bg-white hover:border-[#FF4500] hover:text-[#FF4500] text-slate-700 px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm transition-all flex items-center gap-2"
        >
          <span>More by {product.brand}</span>
          <FiChevronRight size={14} className="text-slate-400" />
        </Link>

        {/* 3. Brand to Comparison Hub */}
        <Link 
          to="/comparisons" 
          className="bg-white hover:border-[#FF4500] hover:text-[#FF4500] text-slate-700 px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm transition-all flex items-center gap-2"
        >
          <span>Compare {product.brand} Models</span>
          <FiChevronRight size={14} className="text-slate-400" />
        </Link>

        {/* 4. Comparison to Buying Guides */}
        <Link 
          to="/comparisons" 
          className="bg-orange-50 text-[#FF4500] px-4 py-2.5 rounded-xl border border-orange-200 shadow-sm transition-all flex items-center gap-2"
        >
          <FiLayers size={14} />
          <span>Best Buying Guides</span>
        </Link>
      </div>
    </div>
  );
};