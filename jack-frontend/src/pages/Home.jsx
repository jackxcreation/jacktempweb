import React, { useState, useEffect, useMemo, memo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '../components/Navbar';
import { 
  FiHeart, FiStar, FiShoppingCart, FiTruck, FiShield, 
  FiRefreshCcw, FiArrowRight, FiClock, FiZap,
  FiSmartphone, FiWatch, FiCpu, FiHome, FiCompass, FiTv, FiSmile, FiEye, FiX, FiCheck
} from 'react-icons/fi';
import { useCart } from '../context/CartContext';
import { useUser } from '../context/UserContext';
import { useProducts } from '../context/ProductContext';
import { useCompare } from '../context/CompareContext'; // 🔥 Compare context integration
import { getOptimizedImageUrl } from '../utils/imageOptimizer';

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

// --- Utilities ---
const calculateDiscountPercentage = (mrpPaise, pricePaise) => {
  if (!mrpPaise || !pricePaise || mrpPaise <= pricePaise) return null;
  return Math.round(((mrpPaise - pricePaise) / mrpPaise) * 100);
};

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
                  // 🔥 FIX: Fallback logic for price inside Compare Modal
                  const productPricePaise = product.pricePaise || (product.price ? product.price * 100 : 0);
                  const productMrpPaise = product.mrpPaise || (product.mrp ? product.mrp * 100 : 0);

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
                          <span className="text-[#FF4500] text-lg">{formatCurrency(productPricePaise)}</span>
                          {productMrpPaise > productPricePaise && (
                            <span className="text-xs text-slate-400 line-through ml-2">{formatCurrency(productMrpPaise)}</span>
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

// --- Components ---

const ProductCard = memo(({ product }) => {
  const { addToCart } = useCart();
  const { addToCompare } = useCompare(); // 🔥 Compare context integration
  const { user, toggleWishlist, wishlist } = useUser(); // 🔥 ADDED: Wishlist logic integration
  const [imgError, setImgError] = useState(false);

  if (!product) return null;

  // 🔥 FIX: Fallback logic for price inside Product Card
  const productPricePaise = product.pricePaise || (product.price ? product.price * 100 : 0);
  const productMrpPaise = product.mrpPaise || (product.mrp ? product.mrp * 100 : 0);

  const discountPercent = calculateDiscountPercentage(productMrpPaise, productPricePaise);
  const displayDiscount = product.discount || (discountPercent ? `${discountPercent}% OFF` : null);
  const rawImg = product.image;

  // 🔥 Check if this specific product is already in the wishlist
  const isInWishlist = wishlist?.some(item => {
    const p = item.product || item;
    return String(p._id || p.id) === String(product.id || product._id);
  });

  return (
    <Link 
      to={`/product/${product.id || product._id}`} 
      className="block h-full outline-none focus-visible:ring-4 focus-visible:ring-[#FF4500] rounded-xl sm:rounded-3xl group"
      aria-label={`View details for ${product.title}`}
    >
      <motion.div 
        initial={{ opacity: 0, y: 15 }} 
        whileInView={{ opacity: 1, y: 0 }} 
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="bg-white rounded-xl sm:rounded-3xl p-2 sm:p-3 shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-200 sm:border-slate-100/80 relative flex flex-col h-full overflow-hidden"
      >
        {/* Dynamic Meta Badges */}
        <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-10 flex flex-col gap-1 sm:gap-1.5 items-start pointer-events-none select-none origin-top-left scale-90 sm:scale-100">
          {product.isBestSeller && (
            <span className="bg-amber-500 text-slate-900 text-[8px] sm:text-[9px] font-black px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-sm uppercase tracking-wider shadow-sm">
              👑 Best Seller
            </span>
          )}
          {(product.isTrending || (product.views && product.views > 50)) && (
            <span className="bg-red-500 text-white text-[8px] sm:text-[9px] font-black px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-sm uppercase tracking-wider flex items-center gap-1 shadow-sm shadow-red-500/20">
              <FiZap size={8} className="sm:w-[9px] sm:h-[9px]" /> Trending
            </span>
          )}
          {displayDiscount && (
            <span className="bg-[#FF4500] text-white text-[8px] sm:text-[9px] font-black px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-sm uppercase tracking-wider shadow-sm">
              {displayDiscount}
            </span>
          )}
        </div>

        {/* Wishlist Action 🔥 FIX: Now actually toggles wishlist */}
        <button 
          onClick={(e) => { 
            e.preventDefault(); 
            e.stopPropagation(); 
            if (!user) {
              alert("Please login to add items to your wishlist!");
              return;
            }
            toggleWishlist(product.id || product._id);
          }} 
          className={`absolute top-2 right-2 sm:top-4 sm:right-4 z-10 p-1.5 sm:p-2.5 backdrop-blur-md rounded-full transition-all shadow-sm outline-none ${isInWishlist ? 'bg-red-50 text-red-500' : 'bg-white/90 text-slate-400 hover:text-red-500 hover:bg-red-50'}`}
          aria-label="Add to Wishlist"
        >
          <FiHeart size={14} className={`sm:w-4 sm:h-4 transition-transform active:scale-75 ${isInWishlist ? 'fill-current text-red-500' : ''}`} />
        </button>

        {/* Image Container */}
        <div className="w-full h-32 sm:h-52 md:h-64 bg-transparent sm:bg-slate-50/60 rounded-lg sm:rounded-2xl overflow-hidden mb-2 sm:mb-4 relative p-2 sm:p-4 flex items-center justify-center mix-blend-multiply transition-colors group-hover:bg-slate-50">
          <img 
            src={imgError ? "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%23cbd5e1' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><rect x='3' y='3' width='18' height='18' rx='2' ry='2'/><circle cx='8.5' cy='8.5' r='1.5'/><polyline points='21 15 16 10 5 21'/></svg>" : getOptimizedImageUrl(rawImg, 320)} 
            alt={product.title} 
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
            className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-500 ease-out will-change-transform" 
          />
          
          {/* Desktop Hover Quick Add & Compare Buttons */}
          <div className="absolute bottom-0 left-0 w-full p-2 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out hidden md:flex gap-1">
            <button 
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); addToCart(product); }}
              className="flex-1 bg-slate-900/95 backdrop-blur-sm text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-1 hover:bg-[#FF4500] transition-all shadow-lg text-xs"
              aria-label={`Quick add ${product.title} to cart`}
            >
              <FiShoppingCart size={14} /> Add
            </button>
            <button 
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); addToCompare(product); }}
              className="bg-white/95 backdrop-blur-sm text-slate-900 font-bold px-3 py-2.5 rounded-xl hover:bg-slate-900 hover:text-white transition-colors shadow-lg text-xs"
              aria-label={`Compare ${product.title}`}
            >
              Compare
            </button>
          </div>
        </div>

        {/* Contextual Product Metadata */}
        <div className="flex flex-col flex-grow px-0.5 sm:px-1">
          <div className="flex items-center space-x-1 mb-1 sm:mb-2">
            <FiStar className="text-yellow-400 fill-yellow-400" size={10} />
            <span className="text-[10px] sm:text-[11px] font-black text-slate-700">{product.rating || "0.0"}</span>
            <span className="text-[9px] sm:text-[11px] text-slate-400 font-medium hidden sm:inline">
              {product.reviews ? `(${product.reviews})` : '(No reviews)'}
            </span>
          </div>
          
          <h3 className="text-xs sm:text-sm font-bold text-slate-800 line-clamp-2 mb-1 sm:mb-3 leading-snug group-hover:text-[#FF4500] transition-colors duration-200">
            {product.title}
          </h3>
          
          <div className="mt-auto flex items-end justify-between pt-1">
            <div className="flex flex-col">
              {productMrpPaise > productPricePaise && (
                <span className="text-[10px] sm:text-xs text-slate-400 line-through font-medium leading-none mb-0.5 sm:mb-1">{formatCurrency(productMrpPaise)}</span>
              )}
              <span className="text-sm sm:text-lg font-black text-slate-900 leading-none tracking-tight">{formatCurrency(productPricePaise)}</span>
            </div>
            
            {/* Mobile Actions */}
            <div className="flex gap-1 md:hidden">
              <button 
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); addToCompare(product); }}
                className="bg-slate-100 text-slate-700 hover:bg-slate-900 hover:text-white p-2 rounded-xl transition-colors text-[10px] font-bold"
                aria-label={`Compare ${product.title}`}
              >
                Comp
              </button>
              <button 
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); addToCart(product); }}
                className="p-1.5 sm:p-2.5 bg-slate-100 text-slate-900 hover:bg-[#FF4500] hover:text-white rounded-lg sm:rounded-xl transition-colors outline-none"
                aria-label={`Add ${product.title} to cart`}
              >
                <FiShoppingCart size={14} className="sm:w-[18px] sm:h-[18px]" />
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
  <div className="bg-white rounded-xl sm:rounded-3xl p-2 sm:p-3 shadow-sm border border-slate-100 flex flex-col h-full min-h-[220px] sm:min-h-[380px] animate-pulse">
    <div className="w-full h-32 sm:h-52 bg-slate-100 rounded-lg sm:rounded-2xl mb-2 sm:mb-4"></div>
    <div className="w-full h-3 sm:h-4 bg-slate-100 rounded mb-1.5 sm:mb-2"></div>
    <div className="w-2/3 h-3 sm:h-4 bg-slate-100 rounded mb-3 sm:mb-4"></div>
    <div className="mt-auto flex justify-between items-end">
      <div className="flex flex-col gap-1 w-1/2">
        <div className="w-1/2 h-2 sm:h-3 bg-slate-100 rounded"></div>
        <div className="w-full h-4 sm:h-6 bg-slate-100 rounded"></div>
      </div>
      <div className="w-6 h-6 sm:w-10 sm:h-10 bg-slate-100 rounded-lg sm:rounded-xl"></div>
    </div>
  </div>
));
ProductSkeleton.displayName = "ProductSkeleton";

// --- Main Page Pipeline ---
const Home = ({ isLoggedIn, setIsLoggedIn }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [trendingProducts, setTrendingProducts] = useState([]);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false); // 🔥 Modal State
  
  const userContext = useUser();
  const recentlyViewed = userContext?.recentlyViewed || []; 
  
  const productContext = useProducts();
  const products = productContext?.products || [];
  const { compareList } = useCompare(); // 🔥 Compare Context hook

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  const dealOfTheDayProducts = useMemo(() => {
    if (!products || products.length === 0) return [];
    return [...products]
      // 🔥 FIX: Check both structures for deal of the day filtering
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

  useEffect(() => {
    const controller = new AbortController();

    const fetchTrending = async () => {
      try {
        setLoadingTrending(true);
        const res = await fetch(`${API_URL}/products/trending/top`, { 
          signal: controller.signal,
          headers: { 'Accept': 'application/json' }
        });
        if (!res.ok) throw new Error("API Failure");
        const data = await res.json();
        if (Array.isArray(data)) {
          setTrendingProducts(data);
        } else {
          throw new Error("Invalid structure returned");
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn("Fallback sequence initiated due to telemetry/API breakdown.", err);
          setTrendingProducts(products.slice(0, 8));
        }
      } finally {
        setLoadingTrending(false);
      }
    };

    fetchTrending();

    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev === BANNERS.length - 1 ? 0 : prev + 1));
    }, 6000);

    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [products, API_URL]);

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-sans selection:bg-[#FF4500] selection:text-white text-slate-900 antialiased overflow-x-hidden">
      <Navbar isLoggedIn={isLoggedIn} setIsLoggedIn={setIsLoggedIn} />

      <main className="max-w-[1440px] mx-auto pb-24 px-2 sm:px-4 md:px-6 outline-none" tabIndex="-1">
        
        {/* Categories Navigation */}
        <nav className="mt-3 md:mt-6 border-b border-slate-200/60 pb-3 md:pb-4" aria-label="Product Categories Pipeline">
          <div className="flex space-x-3 md:space-x-5 overflow-x-auto scrollbar-hide py-1 snap-x scroll-smooth">
            {CATEGORIES.map((cat, index) => {
              const IconComponent = cat.icon;
              return (
                <Link 
                  to={cat.path} 
                  key={index} 
                  className="flex flex-col items-center cursor-pointer min-w-[64px] sm:min-w-[84px] group snap-start outline-none"
                >
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white rounded-full sm:rounded-2xl flex items-center justify-center text-slate-600 shadow-sm border border-slate-200/80 mb-1.5 sm:mb-2.5 group-hover:border-[#FF4500] group-hover:text-[#FF4500] group-hover:shadow-md transition-all duration-200">
                    <IconComponent size={20} className="sm:w-6 sm:h-6 stroke-[1.5] sm:stroke-[1.75]" />
                  </div>
                  <span className="text-[10px] sm:text-xs font-bold text-slate-600 group-hover:text-slate-900 transition-colors tracking-wide">
                    {cat.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Hero Banner */}
        <section className="mt-4 md:mt-6 relative h-[160px] sm:h-[280px] md:h-[400px] lg:h-[480px] rounded-2xl md:rounded-[2rem] overflow-hidden shadow-md group border border-slate-200/40">
          <AnimatePresence mode="wait">
            <motion.img 
              key={currentSlide} 
              src={getOptimizedImageUrl(BANNERS[currentSlide], 1200)} 
              initial={{ opacity: 0, scale: 1.02 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0 }} 
              transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }} 
              className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none" 
              alt="ECommerce Spotlight Promotion" 
              fetchPriority="high"
            />
          </AnimatePresence>

          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-slate-900/30 to-transparent flex flex-col justify-center px-4 sm:px-12 md:px-20 pointer-events-none">
            <motion.div initial={{ y: 15, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="inline-block px-2 py-1 bg-white/10 backdrop-blur-md rounded-full mb-2 md:mb-4 w-max border border-white/20">
              <span className="text-white font-black tracking-widest uppercase text-[8px] sm:text-[10px] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF4500] animate-pulse"></span> Mega Sale
              </span>
            </motion.div>
            
            <motion.h2 initial={{ y: 15, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.35 }} className="text-white text-xl sm:text-4xl md:text-5xl lg:text-6xl font-black max-w-2xl leading-[1.1] tracking-tight">
              Upgrade Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF4500] to-amber-400">Lifestyle.</span>
            </motion.h2>
            
            <motion.div initial={{ y: 15, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.55 }} className="mt-4 md:mt-8 flex items-center gap-4 pointer-events-auto">
              <Link to="/shop" className="bg-[#FF4500] hover:bg-[#e03d00] text-white px-4 sm:px-8 py-2 sm:py-4 rounded-full font-black shadow-lg shadow-orange-600/20 active:scale-95 transition-all flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-sm tracking-wide">
                SHOP NOW <FiArrowRight size={14} className="sm:w-4 sm:h-4" />
              </Link>
            </motion.div>
          </div>

          <div className="absolute bottom-2 sm:bottom-6 left-1/2 -translate-x-1/2 flex space-x-1.5 sm:space-x-2 z-20 pointer-events-auto">
            {BANNERS.map((_, idx) => (
              <button 
                key={idx} 
                onClick={() => setCurrentSlide(idx)} 
                className={`h-1 sm:h-1.5 rounded-full transition-all duration-300 ${currentSlide === idx ? 'w-6 sm:w-8 bg-white' : 'w-1.5 sm:w-2 bg-white/40 hover:bg-white/60'}`} 
              />
            ))}
          </div>
        </section>

        {/* Value Proposition Metrics */}
        <section className="hidden md:grid mt-8 grid-cols-3 gap-4 bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200/60">
          <div className="flex items-center justify-center text-left gap-4 p-2 transition-transform duration-200 hover:scale-[1.01]">
            <div className="w-12 h-12 bg-indigo-50/70 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0"><FiTruck size={22} className="stroke-[1.75]" /></div>
            <div>
              <p className="font-bold text-slate-900 text-base tracking-tight">Free Premium Delivery</p>
              <p className="text-xs text-slate-500 font-medium mt-0.5">On all prepaid orders over ₹99</p>
            </div>
          </div>
          <div className="flex items-center justify-center text-left gap-4 border-x border-slate-100 p-2 transition-transform duration-200 hover:scale-[1.01]">
            <div className="w-12 h-12 bg-emerald-50/70 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0"><FiShield size={22} className="stroke-[1.75]" /></div>
            <div>
              <p className="font-bold text-slate-900 text-base tracking-tight">Secure Payment Protection</p>
              <p className="text-xs text-slate-500 font-medium mt-0.5">100% encrypted gateway compliance</p>
            </div>
          </div>
          <div className="flex items-center justify-center text-left gap-4 p-2 transition-transform duration-200 hover:scale-[1.01]">
            <div className="w-12 h-12 bg-orange-50/70 text-orange-600 rounded-2xl flex items-center justify-center shrink-0"><FiRefreshCcw size={22} className="stroke-[1.75]" /></div>
            <div>
              <p className="font-bold text-slate-900 text-base tracking-tight">Easy Returns Assurance</p>
              <p className="text-xs text-slate-500 font-medium mt-0.5">No questions asked 7-day window</p>
            </div>
          </div>
        </section>

        {/* Deal of the Day */}
        {dealOfTheDayProducts.length > 0 && (
          <section className="mt-8 md:mt-16 bg-white rounded-2xl md:rounded-[2rem] p-4 sm:p-8 md:p-10 shadow-sm border border-slate-200/60">
            <div className="flex flex-row items-end justify-between mb-4 md:mb-8 gap-2">
              <div>
                <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
                  <span className="bg-red-50 text-red-600 text-[8px] sm:text-[9px] font-black px-1.5 sm:px-2 py-0.5 sm:py-1 rounded uppercase tracking-wider flex items-center gap-1 border border-red-100">
                    <FiClock size={10} /> Limited Time
                  </span>
                </div>
                <h3 className="text-lg sm:text-3xl md:text-4xl font-black tracking-tight text-slate-900">Deal of the Day</h3>
              </div>
              <Link to="/shop" className="text-slate-600 font-bold text-[10px] sm:text-sm hover:text-[#FF4500] transition-colors flex items-center gap-1 bg-slate-50 px-2 sm:px-4 py-1.5 sm:py-2 rounded-full border border-slate-200 duration-200 whitespace-nowrap">
                View All <FiArrowRight size={12} className="sm:w-4 sm:h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 md:gap-5">
              {dealOfTheDayProducts.map((product, index) => (
                <ProductCard key={product.id || product._id ? `deal-${product.id || product._id}` : `deal-fallback-${index}`} product={product} />
              ))}
            </div>
          </section>
        )}

        {/* Trending Now */}
        <section className="mt-8 md:mt-16">
          <div className="flex flex-row items-end justify-between mb-4 md:mb-8 gap-2">
            <div>
              <h3 className="text-lg sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight flex items-center gap-1 sm:gap-2">
                Trending Now <span className="text-lg sm:text-3xl pointer-events-none">🔥</span>
              </h3>
            </div>
            <Link to="/shop" className="text-slate-600 font-bold text-[10px] sm:text-sm hover:text-[#FF4500] transition-colors flex items-center gap-1 bg-white px-2 sm:px-4 py-1.5 sm:py-2 rounded-full border border-slate-200 shadow-sm duration-200 whitespace-nowrap">
              Explore All <FiArrowRight size={12} className="sm:w-4 sm:h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4 md:gap-6">
            {loadingTrending ? (
              Array(8).fill(0).map((_, i) => <ProductSkeleton key={i} />)
            ) : trendingProducts.length > 0 ? (
              trendingProducts.map((product, index) => <ProductCard key={product.id || product._id ? `trend-${product.id || product._id}` : `trend-fallback-${index}`} product={product} />)
            ) : (
              <div className="col-span-full py-10 md:py-16 text-center bg-white rounded-2xl md:rounded-3xl border border-slate-100">
                <p className="text-slate-400 font-medium text-xs md:text-sm">Populating recommendations...</p>
              </div>
            )}
          </div>
        </section>

        {/* New Arrivals */}
        {newArrivals.length > 0 && (
          <section className="mt-8 md:mt-16 border-t border-slate-200/60 pt-8 md:pt-16">
            <div className="flex flex-row items-end justify-between mb-4 md:mb-8 gap-2">
              <div>
                <h3 className="text-lg sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight flex items-center gap-1 sm:gap-2">
                  New Arrivals ✨
                </h3>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4 md:gap-6">
              {newArrivals.map((product, index) => (
                <ProductCard key={product.id || product._id ? `new-${product.id || product._id}` : `new-fallback-${index}`} product={product} />
              ))}
            </div>
          </section>
        )}

        {/* Recently Viewed */}
        {recentlyViewed.length > 0 && (
          <section className="mt-8 md:mt-16 border-t border-slate-200/60 pt-8 md:pt-16">
            <h3 className="text-lg sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight mb-4 md:mb-8">Recently Viewed</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4 md:gap-6">
              {recentlyViewed.slice(0, 4).map((product, index) => (
                <ProductCard key={product.id || product._id ? `recent-${product.id || product._id}` : `recent-fallback-${index}`} product={product} />
              ))}
            </div>
          </section>
        )}

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

export default Home;