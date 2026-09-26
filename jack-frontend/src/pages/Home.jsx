// src/pages/Home.jsx
import React, { useState, useEffect, useMemo, memo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiHeart, FiStar, FiShoppingCart, FiTruck, FiShield, 
  FiRefreshCcw, FiArrowRight, FiClock, FiZap,
  FiSmartphone, FiWatch, FiCpu, FiHome, FiCompass, FiTv, FiSmile, FiEye, FiX, FiCheck,
  FiLock, FiAward, FiTrendingUp, FiChevronRight, FiLayers
} from 'react-icons/fi';
import { useCart } from '../context/CartContext';
import { useUser } from '../context/UserContext';
import { useProducts } from '../context/ProductContext';
import { useCompare } from '../context/CompareContext';
import { getOptimizedImageUrl } from '../utils/imageOptimizer';
import axiosInstance from '../api/axiosInstance';
import SEOManager from '../components/SEOManager'; // 🔥 TASK #54: Dynamic SEO Manager
import ProductImage from '../components/ProductImage'; // 🔥 TASK #57: WebP/AVIF Responsive Optimized Images
import SmartImage from '../components/SmartImage'; // 🔥 TASK #58: Universal Broken-Image Fallback Component

// 🔥 CANONICAL CURRENCY FORMATTER UTILITY
const formatCurrency = (paise) => {
  if (typeof paise !== 'number') return '₹0.00';
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// --- Constants ---
const BANNERS = [
  "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=2070&auto=format&fit=crop", 
  "https://images.unsplash.com/photo-1498049794561-7780e7231661?q=80&w=2070&auto=format&fit=crop", 
  "https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=2070&auto=format&fit=crop"  
];

const BANNER_COPY = [
  { eyebrow: "Mega Sale Live", title: "Upgrade Your", accent: "Lifestyle.", sub: "Curated essentials across mobiles, fashion, home & more — at prices that make sense." },
  { eyebrow: "New Season Drop", title: "Designed for", accent: "Everyday.", sub: "Premium quality, honest pricing, and delivery that never keeps you waiting." },
  { eyebrow: "Editor's Picks", title: "Essentials,", accent: "Elevated.", sub: "Hand-picked bestsellers loved by thousands of customers across India." }
];

const CATEGORIES = [
  { name: "Mobiles", icon: FiSmartphone, path: "/shop?category=mobiles" },
  { name: "Fashion", icon: FiWatch, path: "/shop?category=fashion" },
  { name: "Electronics", icon: FiCpu, path: "/shop?category=electronics" },
  { name: "Home", icon: FiHome, path: "/shop?category=home" },
  { name: "Travel", icon: FiCompass, path: "/shop?category=travel" },
  { name: "Appliances", icon: FiTv, path: "/shop?category=appliances" },
  { name: "Toys", icon: FiSmile, path: "/shop?category=toys" },
  { name: "Beauty", icon: FiEye, path: "/shop?category=beauty" }
];

const TRUST_BADGES = [
  { icon: FiLock, title: "256-bit Secure", sub: "Bank-grade encrypted checkout", tone: "bg-emerald-50 text-emerald-600 border-emerald-100/60" },
  { icon: FiZap, title: "Lightning-Fast Shipping", sub: "Dispatched within 24 hours", tone: "bg-amber-50 text-amber-600 border-amber-100/60" },
  { icon: FiAward, title: "100% Authentic", sub: "Sourced directly from brands", tone: "bg-indigo-50 text-indigo-600 border-indigo-100/60" },
  { icon: FiRefreshCcw, title: "Easy 7-Day Returns", sub: "No questions asked policy", tone: "bg-orange-50 text-[#FF4500] border-orange-100/60" }
];

// --- Utilities ---
const calculateDiscountPercentage = (mrpPaise, pricePaise) => {
  if (!mrpPaise || !pricePaise || mrpPaise <= pricePaise) return null;
  return Math.round(((mrpPaise - pricePaise) / mrpPaise) * 100);
};

// --- Motion Presets ---
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: i * 0.05 } })
};

// ==========================================
// 🧭 SECTION HEADER
// ==========================================
const SectionHeader = memo(({ eyebrow, eyebrowIcon: EyebrowIcon, title, subtitle, ctaLabel, ctaTo, dark = false }) => (
  <div className="flex flex-row items-end justify-between mb-6 md:mb-10 gap-3">
    <div className="min-w-0">
      {eyebrow && (
        <motion.span 
          initial={{ opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
          className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-full mb-3 border ${dark ? 'bg-white/10 text-white/90 border-white/15 backdrop-blur-md' : 'bg-orange-50 text-[#FF4500] border-orange-100 shadow-sm'}`}
        >
          {EyebrowIcon && <EyebrowIcon size={11} />} {eyebrow}
        </motion.span>
      )}
      <motion.h3 
        initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4 }}
        className={`text-2xl sm:text-3xl md:text-4xl font-black tracking-tight leading-[1.1] ${dark ? 'text-white' : 'text-slate-900'}`}
      >
        {title}
      </motion.h3>
      {subtitle && <p className={`mt-2 text-xs sm:text-sm font-medium hidden sm:block ${dark ? 'text-white/60' : 'text-slate-500'}`}>{subtitle}</p>}
    </div>
    {ctaLabel && ctaTo && (
      <Link 
        to={ctaTo} 
        className={`group shrink-0 inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold px-4 sm:px-5 py-2.5 rounded-full border transition-all duration-300 outline-none whitespace-nowrap ${dark ? 'bg-white/10 text-white border-white/15 hover:bg-white hover:text-slate-900 backdrop-blur-md' : 'bg-white text-slate-700 border-slate-200/80 hover:border-[#FF4500] hover:text-[#FF4500] hover:shadow-lg hover:shadow-orange-500/10 hover:-translate-y-0.5'}`}
      >
        {ctaLabel} <FiArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-1" />
      </Link>
    )}
  </div>
));
SectionHeader.displayName = "SectionHeader";

// ==========================================
// ⚖️ SIDE-BY-SIDE COMPARISON MODAL COMPONENT
// ==========================================
const CompareModal = ({ isOpen, onClose }) => {
  const { compareList, removeFromCompare, clearCompare } = useCompare();

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-950/75 z-50 flex items-center justify-center p-4 backdrop-blur-md">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }} 
          animate={{ opacity: 1, scale: 1, y: 0 }} 
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="bg-white rounded-[2.5rem] max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl shadow-black/50 flex flex-col font-sans ring-1 ring-white/20"
        >
          {/* Header */}
          <div className="flex justify-between items-center p-6 sm:p-8 border-b border-slate-100 bg-slate-50/50">
            <div>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#FF4500] mb-1"><FiLayers size={11} /> Compare Mode</span>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Product Comparison</h2>
              <p className="text-xs text-slate-500 font-medium">Compare up to 2 products side-by-side</p>
            </div>
            <div className="flex items-center gap-4">
              {compareList.length > 0 && (
                <button onClick={clearCompare} className="text-xs font-bold text-red-500 hover:underline outline-none">Clear All</button>
              )}
              <button onClick={onClose} className="p-3 bg-white border border-slate-200 rounded-full text-slate-500 hover:bg-slate-900 hover:text-white hover:rotate-90 transition-all duration-300 outline-none shadow-sm"><FiX size={18}/></button>
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-[radial-gradient(ellipse_at_top,rgba(255,69,0,0.03),transparent_70%)]">
            {compareList.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-20 h-20 mx-auto rounded-3xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 mb-4 shadow-inner"><FiLayers size={30} /></div>
                <p className="text-slate-800 font-bold mb-1">No products selected for comparison.</p>
                <p className="text-xs text-slate-400">Click "Compare" on any product card to start comparing.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {/* Labels Column */}
                <div className="hidden sm:block space-y-6 pt-28 font-bold text-slate-400 text-[11px] uppercase tracking-[0.15em]">
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
                  const productPricePaise = product.pricePaise || (product.price ? product.price * 100 : 0);
                  const productMrpPaise = product.mrpPaise || (product.mrp ? product.mrp * 100 : 0);

                  return (
                    <div key={product.id || product._id} className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm relative flex flex-col hover:shadow-xl transition-shadow duration-300">
                      <button 
                        onClick={() => removeFromCompare(product.id || product._id)}
                        className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full text-slate-400 hover:text-white hover:bg-red-500 transition-colors shadow-sm outline-none"
                      >
                        <FiX size={14} />
                      </button>

                      {/* Image & Title */}
                      <div className="h-40 bg-slate-50 rounded-2xl p-4 flex items-center justify-center mb-4 overflow-hidden border border-slate-100">
                        <SmartImage src={getOptimizedImageUrl(rawImg, 200)} alt={product.title} width={200} height={160} className="max-h-full object-contain mix-blend-multiply" />
                      </div>
                      <h3 className="text-sm font-bold text-slate-800 line-clamp-2 mb-6 h-10">{product.title}</h3>

                      {/* Specs Mapping */}
                      <div className="space-y-6 text-sm font-bold text-slate-900">
                        {/* Price */}
                        <div>
                          <span className="text-[#FF4500] text-lg tracking-tight">{formatCurrency(productPricePaise)}</span>
                          {productMrpPaise > productPricePaise && (
                            <span className="text-xs text-slate-400 line-through ml-2 font-normal">{formatCurrency(productMrpPaise)}</span>
                          )}
                        </div>

                        {/* Rating */}
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <FiStar className="text-amber-400 fill-amber-400" size={14} />
                          <span>{product.rating || '4.5'} ({product.reviews || 120} reviews)</span>
                        </div>

                        {/* Category & Brand */}
                        <div>
                          <span className="text-indigo-600 block capitalize">{product.category}</span>
                          <span className="text-xs text-slate-500 font-medium">Brand: {product.brand || 'Generic'}</span>
                        </div>

                        {/* Warranty */}
                        <div className="text-slate-600 font-medium text-xs">
                          {product.warranty || '1 Year Manufacturer Warranty'}
                        </div>

                        {/* Delivery */}
                        <div className="text-emerald-600 font-medium text-xs flex items-center gap-1">
                          <FiCheck size={14} /> Standard Delivery (3-5 Days)
                        </div>

                        {/* Features / Specs */}
                        <div className="text-xs text-slate-600 font-medium space-y-1.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
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
                  <div className="rounded-3xl border-2 border-dashed border-slate-200 p-8 flex flex-col items-center justify-center text-center bg-slate-50/50">
                    <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-300 mb-3 text-2xl font-light shadow-sm">+</div>
                    <p className="text-xs font-bold text-slate-700 mb-1">Add one more product</p>
                    <p className="text-[11px] text-slate-400">Select another product to compare side-by-side.</p>
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

// ==========================================
// 🛍️ PRODUCT CARD
// ==========================================
const ProductCard = memo(({ product }) => {
  const { addToCart } = useCart();
  const { addToCompare } = useCompare(); 
  const { user, toggleWishlist, wishlist } = useUser(); 
  const [justAdded, setJustAdded] = useState(false);

  if (!product) return null;

  const productPricePaise = product.pricePaise || (product.price ? product.price * 100 : 0);
  const productMrpPaise = product.mrpPaise || (product.mrp ? product.mrp * 100 : 0);

  const discountPercent = calculateDiscountPercentage(productMrpPaise, productPricePaise);
  const displayDiscount = product.discount || (discountPercent ? `${discountPercent}% OFF` : null);
  const rawImg = product.image;

  const isInWishlist = wishlist?.some(item => {
    const p = item.product || item;
    return String(p._id || p.id) === String(product.id || product._id);
  });

  const handleQuickAdd = (e) => {
    e.preventDefault(); 
    e.stopPropagation(); 
    addToCart(product);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1400);
  };

  return (
    <Link 
      to={`/product/${product.id || product._id}`} 
      className="block h-full outline-none focus-visible:ring-4 focus-visible:ring-[#FF4500]/30 rounded-3xl group"
      aria-label={`View details for ${product.title}`}
    >
      <motion.div 
        initial={{ opacity: 0, y: 15 }} 
        whileInView={{ opacity: 1, y: 0 }} 
        viewport={{ once: true, margin: "-30px" }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        whileHover={{ y: -6 }}
        className="bg-white rounded-3xl p-3 sm:p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)] hover:shadow-[0_20px_45px_-12px_rgba(15,23,42,0.12)] transition-all duration-300 border border-slate-200/80 hover:border-[#FF4500]/30 relative flex flex-col h-full overflow-hidden"
      >
        {/* Dynamic Meta Badges */}
        <div className="absolute top-3 left-3 sm:top-5 sm:left-5 z-10 flex flex-col gap-1.5 items-start pointer-events-none select-none">
          {product.isBestSeller && (
            <span className="bg-slate-900 text-amber-300 text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider shadow-sm flex items-center gap-1">
              <FiAward size={10} /> Best Seller
            </span>
          )}
          {(product.isTrending || (product.views && product.views > 50)) && (
            <span className="bg-[#FF4500] text-white text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider flex items-center gap-1 shadow-sm shadow-orange-500/25">
              <FiZap size={10} /> Trending
            </span>
          )}
          {displayDiscount && (
            <span className="bg-red-500 text-white text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider shadow-sm shadow-red-500/25">
              {displayDiscount}
            </span>
          )}
        </div>

        {/* Wishlist Action */}
        <motion.button 
          whileTap={{ scale: 0.75 }}
          onClick={(e) => { 
            e.preventDefault(); 
            e.stopPropagation(); 
            if (!user) {
              alert("Please login to add items to your wishlist!");
              return;
            }
            toggleWishlist(product.id || product._id);
          }} 
          className={`absolute top-3 right-3 sm:top-5 sm:right-5 z-10 p-2 sm:p-2.5 backdrop-blur-md rounded-full transition-all duration-300 shadow-sm outline-none border ${isInWishlist ? 'bg-red-500 text-white border-red-500 shadow-red-500/30' : 'bg-white/90 text-slate-400 border-slate-200/80 hover:text-red-500 hover:bg-red-50 hover:border-red-100'}`}
          aria-label="Add to Wishlist"
        >
          <motion.span
            key={isInWishlist ? 'filled' : 'empty'}
            initial={{ scale: 0.6 }}
            animate={{ scale: [0.6, 1.25, 1] }}
            transition={{ duration: 0.3 }}
            className="block"
          >
            <FiHeart size={15} className={`${isInWishlist ? 'fill-current' : ''}`} />
          </motion.span>
        </motion.button>

        {/* Image Container with WebP/AVIF Responsive Optimization */}
        <div className="w-full h-40 sm:h-52 md:h-60 bg-gradient-to-b from-[#F8F9FA] to-[#EEF0F3] rounded-2xl overflow-hidden mb-3.5 relative p-4 flex items-center justify-center transition-colors duration-300 group-hover:from-orange-50/40 group-hover:to-orange-100/30">
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(circle_at_50%_120%,rgba(255,69,0,0.12),transparent_70%)] pointer-events-none" />
          <ProductImage 
            src={rawImg} 
            alt={product.title} 
            width={320}
            height={256}
            className="w-full h-full max-w-full max-h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-500 ease-out will-change-transform relative z-[1]" 
          />
          
          {/* Desktop Hover Quick Add & Compare Buttons */}
          <div className="absolute bottom-2 left-2 right-2 p-1.5 translate-y-12 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 ease-out hidden md:flex gap-2 z-[2] bg-white/80 backdrop-blur-xl rounded-2xl p-2 shadow-lg border border-white/60">
            <button 
              onClick={handleQuickAdd}
              className={`flex-1 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all duration-300 shadow-md text-xs outline-none cursor-pointer ${justAdded ? 'bg-emerald-500 shadow-emerald-500/30' : 'bg-slate-900 hover:bg-[#FF4500] shadow-slate-900/20'}`}
              aria-label={`Quick add ${product.title} to cart`}
            >
              {justAdded ? <><FiCheck size={14} /> Added</> : <><FiShoppingCart size={14} /> Quick Add</>}
            </button>
            <button 
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); addToCompare(product); }}
              className="bg-slate-100 text-slate-700 font-bold px-3.5 py-2.5 rounded-xl hover:bg-slate-900 hover:text-white transition-colors duration-300 text-xs outline-none cursor-pointer flex items-center justify-center"
              aria-label={`Compare ${product.title}`}
            >
              <FiLayers size={14} />
            </button>
          </div>
        </div>

        {/* Contextual Product Metadata */}
        <div className="flex flex-col flex-grow px-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-md text-[11px] font-black">
              <FiStar className="fill-current text-emerald-500" size={10} /> {product.rating || "0.0"}
            </span>
            <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
              {product.reviews ? `${product.reviews} reviews` : 'No reviews yet'}
            </span>
          </div>
          
          <h3 className="text-xs sm:text-sm font-bold text-slate-800 line-clamp-2 mb-3 leading-snug group-hover:text-[#FF4500] transition-colors duration-200">
            {product.title}
          </h3>
          
          <div className="mt-auto flex items-end justify-between pt-1">
            <div className="flex flex-col">
              {productMrpPaise > productPricePaise && (
                <span className="text-[11px] sm:text-xs text-slate-400 line-through font-medium leading-none mb-1">{formatCurrency(productMrpPaise)}</span>
              )}
              <span className="text-base sm:text-lg font-black text-slate-900 leading-none tracking-tight">{formatCurrency(productPricePaise)}</span>
            </div>
            
            {/* Mobile Actions */}
            <div className="flex gap-1.5 md:hidden">
              <button 
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); addToCompare(product); }}
                className="bg-slate-100 text-slate-700 active:bg-slate-900 active:text-white p-2.5 rounded-xl transition-colors outline-none cursor-pointer"
                aria-label={`Compare ${product.title}`}
              >
                <FiLayers size={14} />
              </button>
              <button 
                onClick={handleQuickAdd}
                className={`p-2.5 rounded-xl transition-colors outline-none cursor-pointer ${justAdded ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white active:bg-[#FF4500]'}`}
                aria-label={`Add ${product.title} to cart`}
              >
                {justAdded ? <FiCheck size={14} /> : <FiShoppingCart size={14} />}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
});
ProductCard.displayName = "ProductCard";

const ProductSkeleton = memo(() => (
  <div className="bg-white rounded-3xl p-3 sm:p-4 shadow-sm border border-slate-100 flex flex-col h-full min-h-[260px] sm:min-h-[380px] animate-pulse">
    <div className="w-full h-40 sm:h-52 md:h-60 bg-slate-100 rounded-2xl mb-4"></div>
    <div className="w-1/3 h-4 bg-slate-100 rounded mb-2"></div>
    <div className="w-full h-4 bg-slate-100 rounded mb-2"></div>
    <div className="w-2/3 h-4 bg-slate-100 rounded mb-4"></div>
    <div className="mt-auto flex justify-between items-end">
      <div className="flex flex-col gap-1 w-1/2">
        <div className="w-1/2 h-3 bg-slate-100 rounded"></div>
        <div className="w-full h-6 bg-slate-100 rounded"></div>
      </div>
      <div className="w-10 h-10 bg-slate-100 rounded-xl"></div>
    </div>
  </div>
));
ProductSkeleton.displayName = "ProductSkeleton";

// ==========================================
// 🏠 MAIN PAGE PIPELINE
// ==========================================
const Home = ({ isLoggedIn, setIsLoggedIn }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [trendingProducts, setTrendingProducts] = useState([]);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false); 
  
  const userContext = useUser();
  const recentlyViewed = userContext?.recentlyViewed || []; 
  
  const productContext = useProducts();
  const products = productContext?.products || [];
  const { compareList } = useCompare(); 

  // 🔥 Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const dealOfTheDayProducts = useMemo(() => {
    if (!products || products.length === 0) return [];
    return [...products]
      .filter(p => {
        const mrp = p.mrpPaise || (p.mrp ? p.mrp * 100 : 0);
        const price = p.pricePaise || (p.price ? p.price * 100 : 0);
        return mrp > 0 && price > 0 && mrp > price;
      })
      .sort((a, b) => {
        const mrpA = a.mrpPaise || (a.mrp ? a.mrp * 100 : 0);
        const priceA = a.pricePaise || (a.price ? a.price * 100 : 0);
        const mrpB = b.mrpPaise || (b.mrp ? b.mrp * 100 : 0);
        const priceB = b.pricePaise || (b.price ? b.price * 100 : 0);
        return calculateDiscountPercentage(mrpB, priceB) - calculateDiscountPercentage(mrpA, priceA);
      })
      .slice(0, 4);
  }, [products]);

  const newArrivals = useMemo(() => {
    if (!products || products.length === 0) return [];
    return [...products].reverse().slice(0, 4);
  }, [products]);

  // ✨ AI Recommended Essentials
  const recommendedProducts = useMemo(() => {
    if (!products || products.length === 0) return [];
    const score = (p) => (Number(p.rating) || 0) * 20 + (Number(p.views) || 0) * 0.5 + (Number(p.reviews) || 0) * 0.2;
    return [...products].sort((a, b) => score(b) - score(a)).slice(0, 8);
  }, [products]);

  // 🔥 FIX: Replaced AbortController with isMounted flag to prevent console spam
  useEffect(() => {
    let isMounted = true; 

    const fetchTrending = async () => {
      try {
        if (isMounted) setLoadingTrending(true);
        const res = await axiosInstance.get(`/products/trending/top`);
        
        if (isMounted) {
          if (Array.isArray(res.data)) {
            setTrendingProducts(res.data);
          } else {
            throw new Error("Invalid structure returned");
          }
        }
      } catch (err) {
        if (isMounted) {
          console.warn("API Note: Could not fetch trending products, using catalog fallback.");
          setTrendingProducts(products.slice(0, 8));
        }
      } finally {
        if (isMounted) {
          setLoadingTrending(false);
        }
      }
    };

    fetchTrending();

    const timer = setInterval(() => {
      if (isMounted) {
        setCurrentSlide((prev) => (prev === BANNERS.length - 1 ? 0 : prev + 1));
      }
    }, 6000);

    return () => {
      isMounted = false; 
      clearInterval(timer);
    };
  }, [products]);

  const copy = BANNER_COPY[currentSlide] || BANNER_COPY[0];

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-sans selection:bg-[#FF4500] selection:text-white text-slate-900 antialiased overflow-x-hidden">

      {/* 🔥 TASK #54: Dynamic SEO Manager integration */}
      <SEOManager 
        title="Jack Essentials — Premium Lifestyle, Electronics & More"
        description="Shop premium products, electronics, home decor, and fashion at Jack Essentials with secure payments, cashfree gateway, and fast pan-India delivery."
        canonicalUrl={typeof window !== 'undefined' ? window.location.href : "https://thejackessentials.com"}
      />

      <main className="max-w-[1440px] mx-auto pb-28 px-3 sm:px-6 md:px-8 outline-none" tabIndex="-1">
        
        {/* ================= CATEGORY PILLS ================= */}
        <nav className="mt-4 md:mt-8" aria-label="Product Categories Pipeline">
          <div className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide py-3 px-1 snap-x scroll-smooth">
            {CATEGORIES.map((cat, index) => {
              const IconComponent = cat.icon;
              return (
                <motion.div
                  key={index}
                  custom={index}
                  initial="hidden"
                  animate="show"
                  variants={fadeUp}
                  className="snap-start shrink-0"
                >
                  <Link 
                    to={cat.path} 
                    className="group flex items-center gap-2.5 pl-2 pr-5 sm:pr-6 py-2 rounded-2xl bg-white/90 backdrop-blur-xl border border-slate-200/80 shadow-[0_2px_8px_rgba(15,23,42,0.04)] hover:shadow-[0_12px_28px_-8px_rgba(255,69,0,0.3)] hover:-translate-y-1 hover:border-[#FF4500]/40 transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-[#FF4500]/40"
                  >
                    <div className="w-9 h-9 sm:w-11 sm:h-11 bg-slate-900 group-hover:bg-[#FF4500] rounded-xl flex items-center justify-center text-white transition-colors duration-300 shadow-sm">
                      <IconComponent size={18} className="stroke-[1.75]" />
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors tracking-tight whitespace-nowrap">
                      {cat.name}
                    </span>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </nav>

        {/* ================= HERO ================= */}
        <section className="mt-4 md:mt-6 grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
          
          {/* Main Hero Banner */}
          <div className="lg:col-span-8 relative h-[300px] sm:h-[380px] md:h-[460px] lg:h-[540px] rounded-[2.5rem] overflow-hidden bg-slate-950 shadow-[0_25px_50px_-12px_rgba(15,23,42,0.35)] group ring-1 ring-white/10">
            {/* Ambient glow orbs */}
            <div className="absolute -top-32 -left-32 w-[450px] h-[450px] bg-[#FF4500]/35 rounded-full blur-[130px] pointer-events-none animate-pulse [animation-duration:5s]" />
            <div className="absolute -bottom-40 right-0 w-[500px] h-[500px] bg-amber-400/20 rounded-full blur-[140px] pointer-events-none animate-pulse [animation-duration:7s]" />

            <AnimatePresence mode="wait">
              <motion.div 
                key={currentSlide}
                initial={{ opacity: 0, scale: 1.05 }} 
                animate={{ opacity: 1, scale: 1 }} 
                exit={{ opacity: 0 }} 
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} 
                className="absolute inset-0 w-full h-full"
              >
                <ProductImage 
                  src={BANNERS[currentSlide]} 
                  alt="ECommerce Spotlight Promotion" 
                  width={1200}
                  height={540}
                  priority={currentSlide === 0}
                  className="w-full h-full object-cover select-none pointer-events-none opacity-65 mix-blend-luminosity group-hover:scale-[1.02] transition-transform duration-[2000ms] ease-out" 
                />
              </motion.div>
            </AnimatePresence>

            {/* Gradient overlays */}
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/75 to-transparent pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent pointer-events-none" />

            {/* Copy */}
            <div className="absolute inset-0 flex flex-col justify-center px-6 sm:px-12 md:px-16 pointer-events-none">
              <AnimatePresence mode="wait">
                <motion.div key={`copy-${currentSlide}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
                  <motion.div initial={{ y: 15, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }} className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white/10 backdrop-blur-xl rounded-full mb-4 w-max border border-white/20">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF4500] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF4500]"></span>
                    </span>
                    <span className="text-white font-black tracking-[0.2em] uppercase text-[10px]">{copy.eyebrow}</span>
                  </motion.div>
                  
                  <motion.h2 initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3, duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="text-white text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black max-w-2xl leading-[1] tracking-[-0.03em]">
                    {copy.title} <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF4500] via-orange-400 to-amber-300">{copy.accent}</span>
                  </motion.h2>

                  <motion.p initial={{ y: 15, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.45 }} className="mt-4 text-white/70 text-sm md:text-base font-medium max-w-md leading-relaxed hidden sm:block">
                    {copy.sub}
                  </motion.p>
                </motion.div>
              </AnimatePresence>
              
              <motion.div initial={{ y: 15, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.6 }} className="mt-6 md:mt-8 flex items-center gap-3.5 pointer-events-auto">
                <Link to="/shop" className="group/btn relative bg-[#FF4500] text-white px-7 py-3.5 sm:py-4 rounded-full font-black shadow-[0_10px_30px_-6px_rgba(255,69,0,0.7)] hover:shadow-[0_16px_40px_-6px_rgba(255,69,0,0.9)] hover:-translate-y-0.5 active:scale-95 transition-all duration-300 flex items-center gap-2 text-xs sm:text-sm tracking-wide outline-none overflow-hidden">
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700" />
                  <span className="relative">SHOP NOW</span> <FiArrowRight size={15} className="relative transition-transform duration-300 group-hover/btn:translate-x-1" />
                </Link>
                <Link to="/shop?category=electronics" className="hidden sm:inline-flex items-center gap-2 text-white/90 hover:text-white font-bold text-sm px-6 py-4 rounded-full border border-white/20 hover:border-white/40 bg-white/5 hover:bg-white/10 backdrop-blur-xl transition-all duration-300 outline-none">
                  Explore Electronics
                </Link>
              </motion.div>
            </div>

            {/* Slide indicators */}
            <div className="absolute bottom-6 left-6 sm:left-12 md:left-16 flex space-x-2 z-20 pointer-events-auto">
              {BANNERS.map((_, idx) => (
                <button 
                  key={idx} 
                  onClick={() => setCurrentSlide(idx)} 
                  aria-label={`Go to slide ${idx + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-500 outline-none ${currentSlide === idx ? 'w-10 bg-[#FF4500]' : 'w-2 bg-white/30 hover:bg-white/60'}`} 
                />
              ))}
            </div>
          </div>

          {/* Side CTA Cards */}
          <div className="lg:col-span-4 grid grid-cols-2 lg:grid-cols-1 gap-4">
            <motion.div custom={1} initial="hidden" animate="show" variants={fadeUp} className="h-full">
              <Link to="/shop?category=mobiles" className="group relative flex flex-col justify-between h-full min-h-[160px] lg:min-h-0 p-5 sm:p-7 rounded-[2.25rem] bg-white border border-slate-200/80 shadow-[0_4px_20px_rgba(15,23,42,0.04)] hover:shadow-[0_20px_45px_-12px_rgba(15,23,42,0.12)] hover:-translate-y-1 transition-all duration-300 overflow-hidden outline-none">
                <div className="absolute -right-12 -top-12 w-44 h-44 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-colors duration-500" />
                <div className="relative">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">Fresh Launches</span>
                  <h4 className="mt-2 text-lg sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">Latest Smartphones</h4>
                  <p className="mt-1 text-xs text-slate-500 font-medium hidden sm:block">Flagship performance, unbeatable value.</p>
                </div>
                <div className="relative flex items-center justify-between mt-4">
                  <span className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1 group-hover:text-indigo-600 transition-colors">Explore <FiChevronRight size={14} className="transition-transform group-hover:translate-x-1" /></span>
                  <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-2xl bg-slate-900 text-white flex items-center justify-center group-hover:bg-indigo-600 group-hover:rotate-6 transition-all duration-300 shadow-md"><FiSmartphone size={20} /></div>
                </div>
              </Link>
            </motion.div>

            <motion.div custom={2} initial="hidden" animate="show" variants={fadeUp} className="h-full">
              <Link to="/shop?category=fashion" className="group relative flex flex-col justify-between h-full min-h-[160px] lg:min-h-0 p-5 sm:p-7 rounded-[2.25rem] bg-[#FF4500] text-white shadow-[0_15px_35px_-10px_rgba(255,69,0,0.5)] hover:shadow-[0_22px_45px_-10px_rgba(255,69,0,0.7)] hover:-translate-y-1 transition-all duration-300 overflow-hidden outline-none">
                <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-amber-300/40 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-700" />
                <div className="relative">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/80">Style Edit</span>
                  <h4 className="mt-2 text-lg sm:text-2xl font-black tracking-tight leading-tight">Fashion Up To 60% Off</h4>
                  <p className="mt-1 text-xs text-white/80 font-medium hidden sm:block">Watches, accessories & seasonal picks.</p>
                </div>
                <div className="relative flex items-center justify-between mt-4">
                  <span className="text-xs sm:text-sm font-bold flex items-center gap-1">Shop Now <FiChevronRight size={14} className="transition-transform group-hover:translate-x-1" /></span>
                  <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center group-hover:bg-white group-hover:text-[#FF4500] group-hover:-rotate-6 transition-all duration-300 shadow-md"><FiWatch size={20} /></div>
                </div>
              </Link>
            </motion.div>
          </div>
        </section>

        {/* ================= TRUST BADGES ================= */}
        <section className="mt-6 md:mt-8 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {TRUST_BADGES.map((badge, i) => {
            const Icon = badge.icon;
            return (
              <motion.div 
                key={badge.title}
                custom={i}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: "-30px" }}
                variants={fadeUp}
                className="group flex items-center gap-3.5 p-4 sm:p-5 rounded-3xl bg-white/90 backdrop-blur-xl border border-slate-200/80 shadow-[0_2px_10px_rgba(15,23,42,0.03)] hover:shadow-[0_16px_32px_-12px_rgba(15,23,42,0.12)] hover:-translate-y-1 transition-all duration-300"
              >
                <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shrink-0 border ${badge.tone} group-hover:scale-110 transition-transform duration-300 shadow-sm`}><Icon size={20} className="stroke-[1.75]" /></div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 text-xs sm:text-sm tracking-tight leading-tight truncate">{badge.title}</p>
                  <p className="text-[10px] sm:text-xs text-slate-500 font-medium mt-0.5 truncate">{badge.sub}</p>
                </div>
              </motion.div>
            );
          })}
        </section>

        {/* ================= DEAL OF THE DAY ================= */}
        {dealOfTheDayProducts.length > 0 && (
          <section className="mt-12 md:mt-24 relative rounded-[2.5rem] p-6 sm:p-10 md:p-14 bg-slate-950 overflow-hidden shadow-[0_30px_60px_-20px_rgba(15,23,42,0.45)] ring-1 ring-white/10">
            <div className="absolute -top-40 right-1/4 w-[500px] h-[500px] bg-[#FF4500]/25 rounded-full blur-[140px] pointer-events-none" />
            <div className="absolute -bottom-40 -left-20 w-[400px] h-[400px] bg-red-500/15 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
            
            <div className="relative">
              <SectionHeader 
                dark
                eyebrow="Limited Time"
                eyebrowIcon={FiClock}
                title={<>Deal of the <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF4500] to-amber-300">Day</span></>}
                subtitle="Biggest markdowns across the catalogue — refreshed daily."
                ctaLabel="View All"
                ctaTo="/shop"
              />
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
                {dealOfTheDayProducts.map((product, index) => (
                  <ProductCard key={product.id || product._id ? `deal-${product.id || product._id}` : `deal-fallback-${index}`} product={product} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ================= TRENDING NOW ================= */}
        <section className="mt-12 md:mt-24">
          <SectionHeader 
            eyebrow="Hot Right Now"
            eyebrowIcon={FiTrendingUp}
            title="Trending Now"
            subtitle="What everyone's adding to their cart this week."
            ctaLabel="Explore All"
            ctaTo="/shop"
          />

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 md:gap-6">
            {loadingTrending ? (
              Array(8).fill(0).map((_, i) => <ProductSkeleton key={i} />)
            ) : trendingProducts.length > 0 ? (
              trendingProducts.map((product, index) => <ProductCard key={product.id || product._id ? `trend-${product.id || product._id}` : `trend-fallback-${index}`} product={product} />)
            ) : (
              <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-slate-200/80 shadow-sm">
                <p className="text-slate-400 font-medium text-sm">Populating recommendations...</p>
              </div>
            )}
          </div>
        </section>

        {/* ================= AI RECOMMENDED ESSENTIALS ================= */}
        {recommendedProducts.length > 0 && (
          <section className="mt-12 md:mt-24">
            <SectionHeader 
              eyebrow="Smart Picks"
              eyebrowIcon={FiZap}
              title={<>AI Recommended <span className="text-[#FF4500]">Essentials</span></>}
              subtitle="Ranked by rating, popularity and community reviews."
              ctaLabel="See More"
              ctaTo="/shop"
            />
            <div className="-mx-3 sm:-mx-6 px-3 sm:px-6 overflow-x-auto scrollbar-hide snap-x snap-mandatory scroll-smooth pb-2">
              <div className="flex gap-4 sm:gap-6 w-max">
                {recommendedProducts.map((product, index) => (
                  <div key={product.id || product._id ? `rec-${product.id || product._id}` : `rec-fallback-${index}`} className="w-[240px] sm:w-[270px] md:w-[300px] shrink-0 snap-start">
                    <ProductCard product={product} />
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ================= NEW ARRIVALS ================= */}
        {newArrivals.length > 0 && (
          <section className="mt-12 md:mt-24 border-t border-slate-200/80 pt-12 md:pt-20">
            <SectionHeader 
              eyebrow="Just Landed"
              eyebrowIcon={FiStar}
              title="New Arrivals"
              subtitle="Freshly stocked and ready to ship."
            />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 md:gap-6">
              {newArrivals.map((product, index) => (
                <ProductCard key={product.id || product._id ? `new-${product.id || product._id}` : `new-fallback-${index}`} product={product} />
              ))}
            </div>
          </section>
        )}

        {/* ================= RECENTLY VIEWED ================= */}
        {recentlyViewed.length > 0 && (
          <section className="mt-12 md:mt-24 border-t border-slate-200/80 pt-12 md:pt-20">
            <SectionHeader 
              eyebrow="Pick Up Where You Left"
              eyebrowIcon={FiEye}
              title="Recently Viewed"
            />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 md:gap-6">
              {recentlyViewed.slice(0, 4).map((product, index) => (
                <ProductCard key={product.id || product._id ? `recent-${product.id || product._id}` : `recent-fallback-${index}`} product={product} />
              ))}
            </div>
          </section>
        )}

        {/* ================= VALUE PROPOSITION STRIP ================= */}
        <section className="mt-12 md:mt-24 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: FiTruck, title: "Free Premium Delivery", sub: "On all prepaid orders over ₹99", tone: "text-indigo-600 bg-indigo-50 border-indigo-100" },
            { icon: FiShield, title: "Secure Payment Protection", sub: "100% encrypted gateway compliance", tone: "text-emerald-600 bg-emerald-50 border-emerald-100" },
            { icon: FiRefreshCcw, title: "Easy Returns Assurance", sub: "No questions asked 7-day window", tone: "text-[#FF4500] bg-orange-50 border-orange-100" }
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div 
                key={item.title}
                custom={i}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                variants={fadeUp}
                className="flex items-center gap-4 p-6 rounded-[2rem] bg-white border border-slate-200/80 shadow-[0_4px_20px_rgba(15,23,42,0.03)] hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
              >
                <div className={`w-13 h-13 rounded-2xl flex items-center justify-center shrink-0 border ${item.tone} shadow-sm`}><Icon size={22} className="stroke-[1.75]" /></div>
                <div>
                  <p className="font-bold text-slate-900 text-base tracking-tight">{item.title}</p>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">{item.sub}</p>
                </div>
              </motion.div>
            );
          })}
        </section>

      </main>

      {/* 🔥 FLOATING COMPARE BAR */}
      <AnimatePresence>
        {compareList.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            className="fixed bottom-6 right-6 bg-slate-950/90 backdrop-blur-xl text-white pl-6 pr-2.5 py-2.5 rounded-full shadow-[0_20px_50px_-12px_rgba(15,23,42,0.6)] flex items-center gap-5 z-40 border border-white/15"
          >
            <span className="text-xs font-bold flex items-center gap-2">
              <FiLayers size={15} className="text-[#FF4500]" /> Comparing <span className="bg-white/10 px-2.5 py-0.5 rounded-full text-[10px]">{compareList.length}/2</span>
            </span>
            <button 
              onClick={() => setIsCompareModalOpen(true)}
              className="bg-[#FF4500] hover:bg-[#e03d00] text-white text-xs font-black px-4.5 py-2.5 rounded-full shadow-lg shadow-orange-500/35 active:scale-95 transition-all outline-none cursor-pointer flex items-center gap-1.5"
            >
              View Comparison <FiArrowRight size={13} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🔥 COMPARISON MODAL */}
      <CompareModal isOpen={isCompareModalOpen} onClose={() => setIsCompareModalOpen(false)} />
    </div>
  );
};

export default Home;