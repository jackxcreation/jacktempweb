// jack-frontend/src/components/support/ProductResultCard.jsx
import React from 'react';
import { FiExternalLink, FiBox, FiShoppingBag } from 'react-icons/fi';

const ProductResultCard = ({ data, onProductClick, onAddToCart }) => {
  if (!data) return null;

  const title = data.title || data.name || 'Jack Essentials Product';
  const price = data.price || data.mrp || 0;
  const image = data.image || data.imageUrl || data.thumbnail || '/logo.png';
  const productId = data.id || data._id;
  const inStock = data.stockStatus !== 'OUT_OF_STOCK' && (data.inStock !== false);

  const handleCardClick = () => {
    if (onProductClick) {
      onProductClick(data);
    } else if (productId && typeof window !== 'undefined') {
      window.open(`/product/${productId}`, '_blank');
    }
  };

  return (
    <div 
      onClick={handleCardClick}
      className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm my-2 flex flex-col w-full max-w-sm cursor-pointer hover:shadow-md hover:border-indigo-300 transition-all group"
    >
      {image && (
        <div className="h-36 w-full bg-slate-100 flex-shrink-0 border-b border-slate-200 relative overflow-hidden">
          <img 
            src={image} 
            alt={title} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => { e.target.src = '/logo.png'; }}
          />
          {!inStock && (
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center">
              <span className="text-white text-xs font-black uppercase tracking-widest bg-red-600 px-3 py-1 rounded-full shadow-md">
                Out of Stock
              </span>
            </div>
          )}
        </div>
      )}
      <div className="p-4 flex flex-col flex-1 justify-between">
        <h4 className="text-sm font-bold text-slate-800 line-clamp-2 leading-snug group-hover:text-indigo-600 transition-colors">
          {title}
        </h4>
        <div className="flex items-end justify-between mt-3 pt-3 border-t border-slate-100">
          <div className="flex flex-col">
            {price ? (
              <span className="text-base font-black text-slate-900">
                ₹{Number(price).toLocaleString('en-IN')}
              </span>
            ) : (
              <span className="text-xs font-bold text-slate-400">Price on Request</span>
            )}
            <span className={`text-[10px] font-bold mt-0.5 flex items-center gap-1 ${inStock ? 'text-emerald-600' : 'text-rose-500'}`}>
              <FiBox size={11} /> {inStock ? 'In Stock' : 'Out of Stock'}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {onAddToCart && inStock && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToCart(data);
                }}
                className="p-2 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white rounded-xl transition-colors border border-indigo-100 cursor-pointer"
                title="Add to Bag"
              >
                <FiShoppingBag size={15} />
              </button>
            )}
            <div className="p-2 bg-slate-50 group-hover:bg-indigo-50 border border-slate-200 group-hover:border-indigo-100 rounded-xl text-slate-600 group-hover:text-indigo-600 transition-colors">
              <FiExternalLink size={15} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductResultCard;