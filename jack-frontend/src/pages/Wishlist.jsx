import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiHeart, FiShoppingCart, FiTrash2, FiArrowRight, FiStar } from 'react-icons/fi';
import Navbar from '../components/Navbar';
import { useUser } from '../context/UserContext';
import { useCart } from '../context/CartContext';
import { getOptimizedImageUrl } from '../utils/imageOptimizer';

const formatCurrency = (paise) => {
  if (typeof paise !== 'number') return '₹0.00';
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const Wishlist = ({ isLoggedIn, setIsLoggedIn }) => {
  const { wishlist, toggleWishlist, fetchWishlist, user, isLoadingSession } = useUser();
  const { addToCart } = useCart();

  // Jab page load ho tab wishlist fetch karo
  useEffect(() => {
    if (user && !isLoadingSession) {
      fetchWishlist();
    }
  }, [user, isLoadingSession]);

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-sans text-slate-900 selection:bg-[#FF4500] selection:text-white pb-20">
      <Navbar isLoggedIn={isLoggedIn} setIsLoggedIn={setIsLoggedIn} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 md:mt-12">
        <div className="flex items-center gap-3 mb-8 md:mb-10 border-b border-slate-200/60 pb-6">
          <div className="bg-red-50 p-3 rounded-2xl text-[#FF4500]">
            <FiHeart size={28} className="fill-[#FF4500]" />
          </div>
          <div>
            <h1 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tight">My Wishlist</h1>
            <p className="text-sm font-medium text-slate-500 mt-1">
              {wishlist?.length || 0} {wishlist?.length === 1 ? 'item' : 'items'} saved
            </p>
          </div>
        </div>

        {!user ? (
          <div className="bg-white rounded-[2rem] p-10 md:p-16 text-center border border-slate-100 shadow-sm">
            <FiHeart size={48} className="mx-auto text-slate-300 mb-6" />
            <h2 className="text-2xl font-black text-slate-900 mb-2">Please Login</h2>
            <p className="text-slate-500 font-medium mb-8">You need to login to view your saved items.</p>
            <Link to="/login" className="bg-slate-900 text-white px-8 py-3.5 rounded-xl font-bold hover:bg-[#FF4500] transition-colors shadow-md inline-block">
              Login to Continue
            </Link>
          </div>
        ) : !wishlist || wishlist.length === 0 ? (
          <div className="bg-white rounded-[2rem] p-10 md:p-16 text-center border border-slate-100 shadow-sm">
            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <FiHeart size={32} className="text-slate-300" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">Your wishlist is empty</h2>
            <p className="text-slate-500 font-medium mb-8">Looks like you haven't added anything to your wishlist yet.</p>
            <Link to="/shop" className="bg-[#FF4500] text-white px-8 py-3.5 rounded-xl font-bold hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/20 inline-flex items-center gap-2">
              Start Shopping <FiArrowRight />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            <AnimatePresence>
              {wishlist.map((item) => {
                // Item populate hoke aata hai backend se. Agar populated nahi hai toh normal mapping use karo.
                const product = item.product || item; 
                if (!product) return null;

                const productPricePaise = product.pricePaise || (product.price ? product.price * 100 : 0);
                const productMrpPaise = product.mrpPaise || (product.mrp ? product.mrp * 100 : 0);
                const rawImg = product.image || (product.images && product.images[0]);

                return (
                  <motion.div
                    key={product.id || product._id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-white rounded-2xl md:rounded-3xl p-3 md:p-4 shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 flex flex-col group relative"
                  >
                    {/* Delete Button */}
                    <button 
                      onClick={() => toggleWishlist(product.id || product._id)}
                      className="absolute top-4 right-4 z-10 p-2 bg-white/90 backdrop-blur-sm rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors shadow-sm"
                      title="Remove from wishlist"
                    >
                      <FiTrash2 size={16} />
                    </button>

                    {/* Image */}
                    <Link to={`/product/${product.id || product._id}`} className="w-full h-36 md:h-48 bg-slate-50 rounded-xl md:rounded-2xl overflow-hidden mb-4 relative p-4 flex items-center justify-center mix-blend-multiply group-hover:bg-slate-100/50 transition-colors">
                      <img 
                        src={getOptimizedImageUrl(rawImg, 300)} 
                        alt={product.title} 
                        className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-500" 
                      />
                    </Link>

                    {/* Content */}
                    <div className="flex flex-col flex-1">
                      <div className="flex items-center gap-1 mb-2">
                        <FiStar size={12} className="text-yellow-400 fill-yellow-400" />
                        <span className="text-[11px] font-bold text-slate-700">{product.rating || "4.5"}</span>
                      </div>
                      <Link to={`/product/${product.id || product._id}`}>
                        <h3 className="text-sm font-bold text-slate-800 line-clamp-2 mb-3 group-hover:text-[#FF4500] transition-colors">{product.title}</h3>
                      </Link>
                      
                      <div className="mt-auto flex flex-col gap-3">
                        <div className="flex items-end gap-2">
                          <span className="text-lg font-black text-slate-900 leading-none">{formatCurrency(productPricePaise)}</span>
                          {productMrpPaise > productPricePaise && (
                            <span className="text-xs text-slate-400 line-through font-medium leading-none mb-0.5">{formatCurrency(productMrpPaise)}</span>
                          )}
                        </div>
                        
                        <button 
                          onClick={() => addToCart(product)}
                          className="w-full bg-slate-100 hover:bg-slate-900 text-slate-900 hover:text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors text-xs uppercase tracking-wide"
                        >
                          <FiShoppingCart size={14} /> Add to Cart
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  );
};

export default Wishlist;