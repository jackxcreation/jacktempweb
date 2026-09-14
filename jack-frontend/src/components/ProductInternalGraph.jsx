// jack-frontend/src/components/support/ProductInternalGraph.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { FiChevronRight, FiLayers, FiCompass } from 'react-icons/fi';

export const ProductInternalGraph = ({ product }) => {
  if (!product) return null;

  // 🔥 UPGRADE: Safe fallbacks for category and brand property names
  const category = product.category || product.categoryName || 'General';
  const brand = product.brand || product.brandName || 'Jack Essentials';

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 md:p-8 mt-12 mb-8">
      <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
        <FiCompass className="text-[#FF4500]" size={16} /> Explore Related Guides & Ecosystem
      </h3>

      <div className="flex flex-wrap items-center gap-3 text-sm font-bold">
        {/* 1. Current Product to Category */}
        <Link 
          to={`/shop?category=${encodeURIComponent(category)}`} 
          className="bg-white hover:border-[#FF4500] hover:text-[#FF4500] text-slate-700 px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm transition-all flex items-center gap-2 group cursor-pointer"
        >
          <span>{category}</span>
          <FiChevronRight size={14} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
        </Link>

        {/* 2. Category to Brand */}
        <Link 
          to={`/shop?brand=${encodeURIComponent(brand)}`} 
          className="bg-white hover:border-[#FF4500] hover:text-[#FF4500] text-slate-700 px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm transition-all flex items-center gap-2 group cursor-pointer"
        >
          <span>More by {brand}</span>
          <FiChevronRight size={14} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
        </Link>

        {/* 3. Brand to Comparison Hub */}
        <Link 
          to={`/comparisons?brand=${encodeURIComponent(brand)}`} 
          className="bg-white hover:border-[#FF4500] hover:text-[#FF4500] text-slate-700 px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm transition-all flex items-center gap-2 group cursor-pointer"
        >
          <span>Compare {brand} Models</span>
          <FiChevronRight size={14} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
        </Link>

        {/* 4. Comparison to Buying Guides */}
        <Link 
          to="/comparisons" 
          className="bg-orange-50 hover:bg-orange-100 text-[#FF4500] px-4 py-2.5 rounded-xl border border-orange-200 shadow-sm transition-all flex items-center gap-2 cursor-pointer"
        >
          <FiLayers size={14} />
          <span>Best Buying Guides</span>
        </Link>
      </div>
    </div>
  );
};

export default ProductInternalGraph;