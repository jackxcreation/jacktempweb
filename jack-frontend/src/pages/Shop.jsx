import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiHeart, FiStar, FiShoppingCart, FiFilter, FiChevronDown, FiSearch, FiSliders, FiX, FiCheck } from 'react-icons/fi';
import Navbar from '../components/Navbar';
import { useCart } from '../context/CartContext';
import { useProducts } from '../context/ProductContext'; 
import { useCompare } from '../context/CompareContext'; // 🔥 Compare context integration
import { getOptimizedImageUrl } from '../utils/imageOptimizer';

// 🔥 CANONICAL CURRENCY FORMATTER UTILITY
const formatCurrency = (paise) => {
  if (typeof paise !== 'number') return '₹0.00';
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const CATEGORIES = ["All", "Fashion", "Electronics", "Home", "Beauty", "Travel"];

// ==========================================
// ⚖️ SIDE-BY-SIDE COMPARISON MODAL COMPONENT
// ==========================================
const CompareModal = ({ isOpen, onClose }) => {
  const { compareList, removeFromCompare, clearCompare } = useCompare();

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} 
          animate={{ opacity: 1, scale: 1 }} 
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-[2rem] max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="flex justify-between items-center p-6 border-b border-slate-100">
            <div>
              <h2 className="text-2xl font-black text-slate-900">Product Comparison</h2>
              <p className="text-xs text-slate-500 font-medium">Compare up to 2 products side-by-side</p>
            </div>
            <div className="flex items-center gap-4">
              {compareList.length > 0 && (
                <button onClick={clearCompare} className="text-xs font-bold text-red-500 hover:underline">Clear All</button>
              )}
              <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 transition-colors"><FiX size={20}/></button>
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {compareList.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-slate-400 font-medium mb-2">No products selected for comparison.</p>
                <p className="text-xs text-slate-400">Click "Compare" on any product card to start comparing.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-6">
                {/* Labels Column */}
                <div className="space-y-6 pt-24 font-bold text-slate-400 text-sm uppercase tracking-wider">
                  <div>Price</div>
                  <div>Rating</div>
                  <div>Category & Brand</div>
                  <div>Warranty</div>
                  <div>Delivery Info</div>
                  <div>Key Features / Specs</div>
                </div>

                {/* Product Columns */}
                {compareList.map((product) => {
                  const rawImg = product.image || (product.images && product.images[0]);
                  return (
                    <div key={product.id || product._id} className="bg-slate-50/50 rounded-3xl p-6 border border-slate-100 relative flex flex-col">
                      <button 
                        onClick={() => removeFromCompare(product.id || product._id)}
                        className="absolute top-4 right-4 p-1.5 bg-white rounded-full text-slate-400 hover:text-red-500 shadow-sm"
                      >
                        <FiX size={14} />
                      </button>

                      {/* Image & Title */}
                      <div className="h-36 bg-white rounded-2xl p-3 flex items-center justify-center mb-4 shadow-sm">
                        <img src={getOptimizedImageUrl(rawImg, 200)} alt={product.title} className="max-h-full object-contain" />
                      </div>
                      <h3 className="text-sm font-bold text-slate-800 line-clamp-2 mb-6 h-10">{product.title}</h3>

                      {/* Specs Mapping */}
                      <div className="space-y-6 text-sm font-bold text-slate-900">
                        {/* Price */}
                        <div>
                          <span className="text-[#FF4500] text-lg">{formatCurrency(product.pricePaise)}</span>
                          {product.mrpPaise > product.pricePaise && (
                            <span className="text-xs text-slate-400 line-through ml-2">{formatCurrency(product.mrpPaise)}</span>
                          )}
                        </div>

                        {/* Rating */}
                        <div className="flex items-center gap-1 text-slate-700">
                          <FiStar className="text-yellow-400 fill-yellow-400" size={14} />
                          <span>{product.rating || '4.5'} ({product.reviews || 120} reviews)</span>
                        </div>

                        {/* Category & Brand */}
                        <div>
                          <span className="text-indigo-600 block">{product.category}</span>
                          <span className="text-xs text-slate-500 font-medium">Brand: {product.brand || 'Generic'}</span>
                        </div>

                        {/* Warranty */}
                        <div className="text-slate-600 font-medium">
                          {product.warranty || '1 Year Manufacturer Warranty'}
                        </div>

                        {/* Delivery */}
                        <div className="text-emerald-600 font-medium text-xs flex items-center gap-1">
                          <FiCheck size={14} /> Standard Delivery (3-5 Days)
                        </div>

                        {/* Features / Specs */}
                        <div className="text-xs text-slate-500 font-medium space-y-1 bg-white p-3 rounded-xl border border-slate-100">
                          <div>Color: {product.color || 'Standard'}</div>
                          <div>Material: {product.material || 'Premium Build'}</div>
                          <div>Weight: {product.weight || 'N/A'}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Empty Slot if only 1 product selected */}
                {compareList.length === 1 && (
                  <div className="rounded-3xl border-2 border-dashed border-slate-200 p-6 flex flex-col items-center justify-center text-center">
                    <p className="text-xs font-bold text-slate-400 mb-2">Add one more product</p>
                    <p className="text-[11px] text-slate-400">Select another product from shop to compare side-by-side.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

const Shop = ({ isLoggedIn, setIsLoggedIn }) => {
  const { addToCart } = useCart();
  const { fetchFilteredProducts } = useProducts();
  const { compareList, addToCompare } = useCompare(); 
  
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState("popular");
  const [searchQuery, setSearchQuery] = useState("");
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

  // 🔥 Powerful Filter States
  const [selectedBrand, setSelectedBrand] = useState("");
  const [minRating, setMinRating] = useState(0);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [priceRange, setPriceRange] = useState(200000); // Max price in paise (₹2000)

  // Server-side paginated & filtered products state
  const [paginatedData, setPaginatedData] = useState({ products: [], total: 0, page: 1, pages: 1 });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // 🔥 FLIPKART-SCALE SERVER-SIDE FETCHING & FILTERING
  const loadFilteredProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = {
        category: selectedCategory,
        sort: sortBy,
        search: searchQuery,
        brand: selectedBrand,
        rating: minRating,
        availability: inStockOnly ? 'in-stock' : '',
        color: selectedColor,
        size: selectedSize,
        maxPrice: priceRange,
        limit: 24
      };
      const result = await fetchFilteredProducts(params);
      setPaginatedData(result);
    } catch (error) {
      console.error("Failed to load filtered catalog:", error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory, sortBy, searchQuery, selectedBrand, minRating, inStockOnly, selectedColor, selectedSize, priceRange, fetchFilteredProducts]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      loadFilteredProducts();
    }, 300); // Debounce to prevent multiple rapid queries while typing search

    return () => clearTimeout(debounceTimer);
  }, [loadFilteredProducts]);

  const filteredProducts = paginatedData.products || [];

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
            <p className="text-slate-500 font-medium mt-2">
              {isLoading ? "Loading catalog..." : `Showing ${paginatedData.total || filteredProducts.length} curated products`}
            </p>
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
          
          {/* ================= LEFT: POWERFUL FILTERS (Desktop) ================= */}
          <div className="hidden lg:block w-1/4 flex-shrink-0">
            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-6 sticky top-24 space-y-8">
              <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                <h3 className="text-lg font-black text-slate-800 flex items-center"><FiFilter className="mr-2 text-indigo-500" /> Filters</h3>
                {(selectedCategory !== 'All' || searchQuery || selectedBrand || minRating > 0 || inStockOnly || selectedColor || selectedSize) && (
                  <button onClick={() => {setSelectedCategory('All'); setSearchQuery(''); setSelectedBrand(''); setMinRating(0); setInStockOnly(false); setSelectedColor(''); setSelectedSize('');}} className="text-xs font-bold text-[#FF4500] hover:underline">Clear All</button>
                )}
              </div>
              
              {/* Category Filter (Premium Pills) */}
              <div>
                <h4 className="font-bold text-slate-400 mb-3 uppercase text-xs tracking-widest">Categories</h4>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(cat => (
                    <button 
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${selectedCategory === cat ? 'bg-slate-900 border-slate-900 text-white shadow-md' : 'bg-slate-50 border-slate-100 text-slate-600 hover:border-slate-300'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price Range Slider */}
              <div>
                <h4 className="font-bold text-slate-400 mb-2 uppercase text-xs tracking-widest">Max Price: ₹{priceRange / 100}</h4>
                <input 
                  type="range" 
                  min="500" 
                  max="500000" 
                  step="5000"
                  value={priceRange} 
                  onChange={(e) => setPriceRange(Number(e.target.value))}
                  className="w-full accent-[#FF4500] cursor-pointer"
                />
              </div>

              {/* Availability Filter */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">In Stock Only</span>
                <input 
                  type="checkbox" 
                  checked={inStockOnly} 
                  onChange={(e) => setInStockOnly(e.target.checked)}
                  className="w-4 h-4 accent-[#FF4500] rounded cursor-pointer"
                />
              </div>

              {/* Rating Filter */}
              <div>
                <h4 className="font-bold text-slate-400 mb-3 uppercase text-xs tracking-widest">Minimum Rating</h4>
                <div className="space-y-2">
                  {[4, 3, 2].map(stars => (
                    <label key={stars} className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                      <input 
                        type="radio" 
                        name="desktop-rating" 
                        checked={minRating === stars} 
                        onChange={() => setMinRating(stars)}
                        className="accent-[#FF4500]"
                      />
                      <span className="flex items-center text-yellow-500">{'★'.repeat(stars)} & above</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Color Swatches */}
              <div>
                <h4 className="font-bold text-slate-400 mb-3 uppercase text-xs tracking-widest">Color</h4>
                <div className="flex flex-wrap gap-2">
                  {['Black', 'White', 'Blue', 'Red', 'Silver', 'Gold'].map(col => (
                    <button 
                      key={col}
                      onClick={() => setSelectedColor(selectedColor === col ? '' : col)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${selectedColor === col ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                    >
                      {col}
                    </button>
                  ))}
                </div>
              </div>

              {/* Size Selection */}
              <div>
                <h4 className="font-bold text-slate-400 mb-3 uppercase text-xs tracking-widest">Size</h4>
                <div className="flex flex-wrap gap-2">
                  {['S', 'M', 'L', 'XL', 'Free Size'].map(sz => (
                    <button 
                      key={sz}
                      onClick={() => setSelectedSize(selectedSize === sz ? '' : sz)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${selectedSize === sz ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort By */}
              <div>
                <h4 className="font-bold text-slate-400 mb-3 uppercase text-xs tracking-widest">Sort By</h4>
                <div className="space-y-2">
                  {[
                    { val: 'popular', label: 'Most Popular' },
                    { val: 'newest', label: 'Newest Arrivals' },
                    { val: 'price-low', label: 'Price: Low to High' },
                    { val: 'price-high', label: 'Price: High to Low' },
                    { val: 'rating', label: 'Highest Rated' }
                  ].map(sortOpt => (
                    <label key={sortOpt.val} className="flex items-center p-2.5 border border-slate-100 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors group">
                      <input type="radio" name="sort" value={sortOpt.val} checked={sortBy === sortOpt.val} onChange={(e) => setSortBy(e.target.value)} className="hidden" />
                      <div className={`w-3.5 h-3.5 rounded-full border-2 mr-3 flex items-center justify-center ${sortBy === sortOpt.val ? 'border-[#FF4500]' : 'border-slate-300 group-hover:border-[#FF4500]'}`}>
                        {sortBy === sortOpt.val && <div className="w-1.5 h-1.5 bg-[#FF4500] rounded-full"></div>}
                      </div>
                      <span className={`text-xs font-bold ${sortBy === sortOpt.val ? 'text-slate-900' : 'text-slate-500'}`}>{sortOpt.label}</span>
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
                  <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                    <h3 className="text-xl font-black text-slate-900">Filters & Sort</h3>
                    <button onClick={() => setShowMobileFilters(false)} className="p-2 bg-slate-100 rounded-full text-slate-500"><FiX size={20}/></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto space-y-6 pr-1">
                    <div>
                      <h4 className="font-bold text-slate-400 mb-3 uppercase text-xs tracking-widest">Categories</h4>
                      <div className="flex flex-wrap gap-2">
                        {CATEGORIES.map(cat => (
                          <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${selectedCategory === cat ? 'bg-[#FF4500] border-[#FF4500] text-white shadow-md' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-400 mb-2 uppercase text-xs tracking-widest">Max Price: ₹{priceRange / 100}</h4>
                      <input 
                        type="range" 
                        min="500" 
                        max="500000" 
                        step="5000"
                        value={priceRange} 
                        onChange={(e) => setPriceRange(Number(e.target.value))}
                        className="w-full accent-[#FF4500]"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">In Stock Only</span>
                      <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} className="w-4 h-4 accent-[#FF4500] rounded cursor-pointer"/>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-400 mb-3 uppercase text-xs tracking-widest">Sort By</h4>
                      <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-700 outline-none">
                        <option value="popular">Most Popular</option>
                        <option value="newest">Newest Arrivals</option>
                        <option value="price-low">Price: Low to High</option>
                        <option value="price-high">Price: High to Low</option>
                        <option value="rating">Highest Rated</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-100 flex gap-3 mt-auto">
                    <button onClick={() => {setSelectedCategory('All'); setSortBy('popular'); setMinRating(0); setInStockOnly(false);}} className="w-1/3 py-3 text-slate-500 font-bold text-xs hover:bg-slate-50 rounded-xl transition-colors">Clear</button>
                    <button onClick={() => setShowMobileFilters(false)} className="w-2/3 bg-slate-900 text-white font-black text-xs py-3 rounded-xl shadow-lg active:scale-95 transition-all">Show Results</button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ================= RIGHT: PRODUCT GRID ================= */}
          <div className="w-full lg:w-3/4">
            
            {/* Active Filters Display */}
            {(selectedCategory !== 'All' || searchQuery || selectedBrand || minRating > 0 || inStockOnly || selectedColor || selectedSize) && (
              <div className="flex items-center gap-2 mb-6 flex-wrap">
                <span className="text-xs font-bold text-slate-500">Active Filters:</span>
                {selectedCategory !== 'All' && <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-1 rounded-full text-xs font-bold flex items-center">{selectedCategory} <FiX onClick={() => setSelectedCategory('All')} className="ml-2 cursor-pointer hover:text-indigo-900"/></span>}
                {searchQuery && <span className="bg-slate-200 text-slate-700 border border-slate-300 px-3 py-1 rounded-full text-xs font-bold flex items-center">Search: "{searchQuery}" <FiX onClick={() => setSearchQuery('')} className="ml-2 cursor-pointer hover:text-black"/></span>}
                {inStockOnly && <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-3 py-1 rounded-full text-xs font-bold flex items-center">In Stock <FiX onClick={() => setInStockOnly(false)} className="ml-2 cursor-pointer"/></span>}
                {minRating > 0 && <span className="bg-amber-50 text-amber-700 border border-amber-100 px-3 py-1 rounded-full text-xs font-bold flex items-center">{minRating}★ & Up <FiX onClick={() => setMinRating(0)} className="ml-2 cursor-pointer"/></span>}
              </div>
            )}

            {isLoading ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
                {Array(6).fill(0).map((_, i) => (
                  <div key={i} className="bg-white rounded-3xl p-4 h-72 animate-pulse border border-slate-100">
                    <div className="bg-slate-100 w-full h-40 rounded-2xl mb-4"></div>
                    <div className="bg-slate-100 w-3/4 h-4 rounded mb-2"></div>
                    <div className="bg-slate-100 w-1/2 h-4 rounded"></div>
                  </div>
                ))}
              </div>
            ) : filteredProducts.length > 0 ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
                {filteredProducts.map((product) => {
                  const productPricePaise = product.pricePaise || 0;
                  const productMrpPaise = product.mrpPaise || 0;
                  const rawImg = product.image || (product.images && product.images[0]);

                  return (
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

                        {/* Image Container */}
                        <div className="w-full h-40 sm:h-52 bg-slate-50/50 rounded-2xl overflow-hidden mb-4 relative p-4 flex items-center justify-center">
                          <img 
                            src={getOptimizedImageUrl(rawImg, 320)} 
                            alt={product.title} 
                            loading="lazy"
                            decoding="async"
                            className="max-w-full max-h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-500" 
                          />
                          
                          {/* Quick Add Button & Compare Button (Desktop Hover) */}
                          <div className="absolute bottom-0 left-0 w-full p-2 translate-y-full group-hover:translate-y-0 transition-transform duration-300 hidden md:flex gap-1">
                            <button 
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); addToCart(product); }}
                              className="flex-1 bg-slate-900/90 backdrop-blur-sm text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-1 hover:bg-[#FF4500] transition-colors shadow-lg text-xs"
                            >
                              <FiShoppingCart size={14} /> Add
                            </button>
                            <button 
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); addToCompare(product); }}
                              className="bg-white/90 backdrop-blur-sm text-slate-900 font-bold px-3 py-2.5 rounded-xl hover:bg-slate-900 hover:text-white transition-colors shadow-lg text-xs"
                            >
                              Compare
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
                              {productMrpPaise > productPricePaise && <span className="text-[10px] sm:text-xs text-slate-400 line-through font-medium leading-none mb-0.5">{formatCurrency(productMrpPaise)}</span>}
                              <span className="text-base sm:text-lg font-black text-slate-900 leading-none">{formatCurrency(productPricePaise)}</span>
                            </div>
                            
                            {/* Mobile Actions */}
                            <div className="flex gap-1 md:hidden">
                              <button 
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); addToCompare(product); }}
                                className="bg-slate-100 text-slate-700 hover:bg-slate-900 hover:text-white p-2 rounded-xl transition-colors text-[10px] font-bold"
                              >
                                Comp
                              </button>
                              <button 
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); addToCart(product); }}
                                className="bg-slate-100 text-slate-900 hover:bg-[#FF4500] hover:text-white p-2.5 rounded-xl transition-colors"
                              >
                                <FiShoppingCart size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-3xl border border-slate-100 p-12 text-center flex flex-col items-center justify-center min-h-[400px] shadow-sm">
                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-6">
                  <FiSearch size={40} />
                </div>
                <h2 className="text-2xl font-black text-slate-900 mb-2">No items found</h2>
                <p className="text-slate-500 font-medium mb-8 max-w-sm">We couldn't find any products matching your current filters or search query.</p>
                <button onClick={() => {setSelectedCategory("All"); setSearchQuery(""); setSelectedBrand(""); setMinRating(0); setInStockOnly(false); setSelectedColor(""); setSelectedSize("");}} className="bg-slate-900 hover:bg-[#FF4500] text-white px-8 py-3.5 rounded-xl font-black transition-all shadow-md active:scale-95">
                  Clear All Filters
                </button>
              </motion.div>
            )}
          </div>

        </div>
      </main>

      {/* 🔥 FLOATING COMPARE BAR */}
      {compareList.length > 0 && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-4 z-40 border border-slate-800">
          <span className="text-xs font-bold">Comparing ({compareList.length}/2)</span>
          <button 
            onClick={() => setIsCompareModalOpen(true)}
            className="bg-[#FF4500] text-white text-xs font-black px-4 py-2 rounded-full shadow-md active:scale-95 transition-transform"
          >
            View Comparison
          </button>
        </div>
      )}

      {/* 🔥 COMPARISON MODAL */}
      <CompareModal isOpen={isCompareModalOpen} onClose={() => setIsCompareModalOpen(false)} />
    </div>
  );
};

export default Shop;