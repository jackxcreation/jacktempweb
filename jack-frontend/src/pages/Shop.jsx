import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiHeart, FiStar, FiShoppingCart, FiFilter, FiChevronDown, FiSearch, FiSliders, FiX } from 'react-icons/fi';
import Navbar from '../components/Navbar';
import { useCart } from '../context/CartContext';
import { useProducts } from '../context/ProductContext'; 

const CATEGORIES = ["All", "Fashion", "Electronics", "Home", "Beauty", "Travel"];

const Shop = ({ isLoggedIn, setIsLoggedIn }) => {
  const { addToCart } = useCart();
  const { products } = useProducts();
  
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState("popular");
  const [searchQuery, setSearchQuery] = useState("");
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // 🔥 ADVANCED FILTERING LOGIC 🔥
  let filteredProducts = [...(products || [])];

  // 1. Search Filter
  if (searchQuery.trim() !== "") {
    filteredProducts = filteredProducts.filter(p => 
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (p.brand && p.brand.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }

  // 2. Category Filter
  if (selectedCategory !== "All") {
    filteredProducts = filteredProducts.filter(p => p.category === selectedCategory);
  }

  // 3. Sorting Logic
  if (sortBy === "price-low") {
    filteredProducts.sort((a, b) => parseInt(String(a.price).replace(/,/g, '')) - parseInt(String(b.price).replace(/,/g, '')));
  } else if (sortBy === "price-high") {
    filteredProducts.sort((a, b) => parseInt(String(b.price).replace(/,/g, '')) - parseInt(String(a.price).replace(/,/g, '')));
  } else if (sortBy === "rating") {
    filteredProducts.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  } else if (sortBy === "newest") {
    filteredProducts.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-sans pb-24">
      <Navbar isLoggedIn={isLoggedIn} setIsLoggedIn={setIsLoggedIn} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 md:mt-10">
        
        {/* Breadcrumb & Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <div className="text-xs font-bold text-slate-400 mb-3 flex items-center space-x-2 uppercase tracking-widest">
              <Link to="/" className="hover:text-slate-900 transition-colors">Home</Link> <span>/</span> <span className="text-slate-800">Collections</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight">Premium Shop</h1>
            <p className="text-slate-500 font-medium mt-2">Showing {filteredProducts.length} curated products</p>
          </div>
          
          {/* Mobile Filter Toggle & Search */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search products..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-full py-3 pl-11 pr-4 text-sm font-medium outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all shadow-sm"
              />
              {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"><FiX size={14}/></button>}
            </div>
            <button onClick={() => setShowMobileFilters(true)} className="md:hidden bg-slate-900 text-white p-3 rounded-full shadow-md active:scale-95 transition-transform">
              <FiSliders size={20} />
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* ================= LEFT: FILTERS (Desktop) ================= */}
          <div className="hidden lg:block w-1/4 flex-shrink-0">
            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-8 sticky top-24">
              <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-4">
                <h3 className="text-lg font-black text-slate-800 flex items-center"><FiFilter className="mr-2 text-indigo-500" /> Filters</h3>
                {(selectedCategory !== 'All' || searchQuery) && (
                  <button onClick={() => {setSelectedCategory('All'); setSearchQuery('');}} className="text-xs font-bold text-[#FF4500] hover:underline">Clear All</button>
                )}
              </div>
              
              {/* Category Filter (Premium Pills) */}
              <div className="mb-8">
                <h4 className="font-bold text-slate-400 mb-4 uppercase text-xs tracking-widest">Categories</h4>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(cat => (
                    <button 
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${selectedCategory === cat ? 'bg-slate-900 border-slate-900 text-white shadow-md' : 'bg-slate-50 border-slate-100 text-slate-600 hover:border-slate-300'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort By */}
              <div>
                <h4 className="font-bold text-slate-400 mb-4 uppercase text-xs tracking-widest">Sort By</h4>
                <div className="space-y-2">
                  {[
                    { val: 'popular', label: 'Most Popular' },
                    { val: 'newest', label: 'Newest Arrivals' },
                    { val: 'price-low', label: 'Price: Low to High' },
                    { val: 'price-high', label: 'Price: High to Low' },
                    { val: 'rating', label: 'Highest Rated' }
                  ].map(sortOpt => (
                    <label key={sortOpt.val} className="flex items-center p-3 border border-slate-100 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors group">
                      <input type="radio" name="sort" value={sortOpt.val} checked={sortBy === sortOpt.val} onChange={(e) => setSortBy(e.target.value)} className="hidden" />
                      <div className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${sortBy === sortOpt.val ? 'border-[#FF4500]' : 'border-slate-300 group-hover:border-[#FF4500]'}`}>
                        {sortBy === sortOpt.val && <div className="w-2 h-2 bg-[#FF4500] rounded-full"></div>}
                      </div>
                      <span className={`text-sm font-bold ${sortBy === sortOpt.val ? 'text-slate-900' : 'text-slate-500'}`}>{sortOpt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ================= MOBILE FILTERS DRAWER ================= */}
          <AnimatePresence>
            {showMobileFilters && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/60 z-50 lg:hidden flex justify-end backdrop-blur-sm">
                <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="w-4/5 max-w-sm bg-white h-full shadow-2xl p-6 flex flex-col">
                  <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-4">
                    <h3 className="text-xl font-black text-slate-900">Filters & Sort</h3>
                    <button onClick={() => setShowMobileFilters(false)} className="p-2 bg-slate-100 rounded-full text-slate-500"><FiX size={20}/></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto space-y-8">
                    <div>
                      <h4 className="font-bold text-slate-400 mb-4 uppercase text-xs tracking-widest">Categories</h4>
                      <div className="flex flex-wrap gap-2">
                        {CATEGORIES.map(cat => (
                          <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${selectedCategory === cat ? 'bg-[#FF4500] border-[#FF4500] text-white shadow-md' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-400 mb-4 uppercase text-xs tracking-widest">Sort By</h4>
                      <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold text-slate-700 outline-none">
                        <option value="popular">Most Popular</option>
                        <option value="newest">Newest Arrivals</option>
                        <option value="price-low">Price: Low to High</option>
                        <option value="price-high">Price: High to Low</option>
                        <option value="rating">Highest Rated</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-100 flex gap-3 mt-auto">
                    <button onClick={() => {setSelectedCategory('All'); setSortBy('popular');}} className="w-1/3 py-4 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors">Clear</button>
                    <button onClick={() => setShowMobileFilters(false)} className="w-2/3 bg-slate-900 text-white font-black py-4 rounded-xl shadow-lg active:scale-95 transition-all">Show Results</button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ================= RIGHT: PRODUCT GRID ================= */}
          <div className="w-full lg:w-3/4">
            
            {/* Active Filters Display */}
            {(selectedCategory !== 'All' || searchQuery) && (
              <div className="flex items-center gap-2 mb-6 flex-wrap">
                <span className="text-xs font-bold text-slate-500">Active Filters:</span>
                {selectedCategory !== 'All' && <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-1 rounded-full text-xs font-bold flex items-center">{selectedCategory} <FiX onClick={() => setSelectedCategory('All')} className="ml-2 cursor-pointer hover:text-indigo-900"/></span>}
                {searchQuery && <span className="bg-slate-200 text-slate-700 border border-slate-300 px-3 py-1 rounded-full text-xs font-bold flex items-center">Search: "{searchQuery}" <FiX onClick={() => setSearchQuery('')} className="ml-2 cursor-pointer hover:text-black"/></span>}
              </div>
            )}

            {filteredProducts.length > 0 ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
                {filteredProducts.map((product) => (
                  <Link key={product.id || product._id} to={`/product/${product.id || product._id}`} className="block h-full outline-none">
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-50px" }}
                      className="bg-white rounded-3xl p-3 shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 group relative flex flex-col h-full overflow-hidden"
                    >
                      {/* Badges */}
                      <div className="absolute top-4 left-4 z-10 flex flex-col gap-1.5">
                        {product.badge && <span className="bg-slate-900 text-white text-[9px] font-black px-2.5 py-1 rounded-sm uppercase tracking-widest hidden sm:inline-block">{product.badge}</span>}
                        {product.discount && <span className="bg-[#FF4500] text-white text-[9px] font-black px-2.5 py-1 rounded-sm uppercase tracking-widest">{product.discount}</span>}
                      </div>

                      {/* Wishlist Button */}
                      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 p-2 sm:p-2.5 bg-white/90 backdrop-blur-md rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100 shadow-sm md:translate-x-2 md:group-hover:translate-x-0">
                        <FiHeart size={16} />
                      </button>

                      {/* Image Container - 🔥 PHASE 8: Added loading="lazy" for performance */}
                      <div className="w-full h-40 sm:h-52 bg-slate-50/50 rounded-2xl overflow-hidden mb-4 relative p-4 flex items-center justify-center">
                        <img 
                          src={product.image || (product.images && product.images[0])} 
                          alt={product.title} 
                          loading="lazy"
                          decoding="async"
                          className="max-w-full max-h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-500" 
                        />
                        
                        {/* Quick Add Button (Desktop Hover) */}
                        <div className="absolute bottom-0 left-0 w-full p-2 translate-y-full group-hover:translate-y-0 transition-transform duration-300 hidden md:block">
                          <button 
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); addToCart(product); }}
                            className="w-full bg-slate-900/90 backdrop-blur-sm text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-[#FF4500] transition-colors shadow-lg"
                          >
                            <FiShoppingCart size={16} /> Quick Add
                          </button>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="flex flex-col flex-grow px-1">
                        <div className="flex items-center space-x-1 mb-2">
                          <FiStar className="text-yellow-400 fill-yellow-400" size={12} />
                          <span className="text-[11px] font-black text-slate-700">{product.rating || '4.5'}</span>
                          <span className="text-[11px] text-slate-400 font-medium">({product.reviews || '120'})</span>
                        </div>
                        
                        <p className="text-[9px] sm:text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-1">{product.category || 'Premium'}</p>
                        <h3 className="text-xs sm:text-sm font-bold text-slate-800 line-clamp-2 mb-3 leading-snug group-hover:text-[#FF4500] transition-colors">{product.title}</h3>
                        
                        <div className="mt-auto flex items-end justify-between">
                          <div className="flex flex-col">
                            {product.mrp && <span className="text-[10px] sm:text-xs text-slate-400 line-through font-medium leading-none mb-0.5">₹{product.mrp}</span>}
                            <span className="text-base sm:text-lg font-black text-slate-900 leading-none">₹{product.price}</span>
                          </div>
                          
                          {/* Mobile Add to Cart */}
                          <button 
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); addToCart(product); }}
                            className="md:hidden bg-slate-100 text-slate-900 hover:bg-[#FF4500] hover:text-white p-2.5 rounded-xl transition-colors"
                          >
                            <FiShoppingCart size={16} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  </Link>
                ))}
              </div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-3xl border border-slate-100 p-12 text-center flex flex-col items-center justify-center min-h-[400px] shadow-sm">
                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-6">
                  <FiSearch size={40} />
                </div>
                <h2 className="text-2xl font-black text-slate-900 mb-2">No items found</h2>
                <p className="text-slate-500 font-medium mb-8 max-w-sm">We couldn't find any products matching your current filters or search query.</p>
                <button onClick={() => {setSelectedCategory("All"); setSearchQuery("");}} className="bg-slate-900 hover:bg-[#FF4500] text-white px-8 py-3.5 rounded-xl font-black transition-all shadow-md active:scale-95">
                  Clear All Filters
                </button>
              </motion.div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
};

export default Shop;