import React, { useState, useMemo, memo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom'; // 🔥 FIX: useNavigate aur useLocation add kiya
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiTrash2, FiMinus, FiPlus, FiArrowRight, FiShoppingBag, 
  FiShield, FiTruck, FiTag, FiCheckCircle, FiAlertCircle, FiInfo 
} from 'react-icons/fi';
import Navbar from '../components/Navbar';
import { useCart } from '../context/CartContext';
import { useUser } from '../context/UserContext'; // 🔥 FIX: User context import kiya auth check ke liye

// Reusable Fallback Image Wrapper to prevent layout shifts and handle error metrics
const CartItemImage = memo(({ src, alt, discount }) => {
  const [imgError, setImgError] = useState(false);
  const fallbackSvg = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%23cbd5e1' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><rect x='3' y='3' width='18' height='18' rx='2' ry='2'/><circle cx='8.5' cy='8.5' r='1.5'/><polyline points='21 15 16 10 5 21'/></svg>";

  return (
    <div className="w-24 h-24 sm:w-36 sm:h-36 bg-slate-50 rounded-2xl overflow-hidden flex-shrink-0 p-2.5 border border-slate-100 flex items-center justify-center relative mix-blend-multiply select-none">
      <img 
        src={imgError ? fallbackSvg : src} 
        alt={alt || "Product Image"} 
        loading="lazy"
        decoding="async"
        onError={() => setImgError(true)}
        className="max-w-full max-h-full object-contain group-hover:scale-102 transition-transform duration-500 ease-out will-change-transform" 
      />
      {discount && (
        <span className="absolute top-2 left-2 bg-[#FF4500] text-white text-[9px] font-black px-2 py-0.5 rounded shadow-sm tracking-wider">
          {discount}
        </span>
      )}
    </div>
  );
});
CartItemImage.displayName = 'CartItemImage';

// Optimized Cart Item Component
const CartItemRow = memo(({ item, onRemove, onUpdateQuantity }) => {
  const itemImage = item.image || (item.images && item.images[0]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, x: -30, transition: { duration: 0.2 } }} 
      layout
      className="bg-white rounded-3xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-300 border border-slate-100 flex flex-row gap-4 sm:gap-6 items-start group relative"
    >
      <CartItemImage src={itemImage} alt={item.title} discount={item.discount} />
      
      <div className="flex-grow flex flex-col justify-between min-h-[96px] sm:min-h-[144px] w-full">
        <div>
          <div className="flex justify-between items-start gap-2">
            <div className="flex-grow">
              <p className="text-[9px] sm:text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-0.5 sm:mb-1">
                {item.category || 'Premium'}
              </p>
              <Link 
                to={`/product/${item.id}`} 
                className="font-bold text-slate-800 text-sm sm:text-lg leading-snug mb-1 hover:text-[#FF4500] transition-colors line-clamp-2 outline-none focus-visible:text-[#FF4500]"
              >
                {item.title}
              </Link>
              <p className="text-xs text-slate-400 font-medium">
                Size: <span className="text-slate-600 font-semibold">{item.size || 'Free Size'}</span> | Color: <span className="text-slate-600 font-semibold">{item.color || 'Standard'}</span>
              </p>
            </div>
            
            <button 
              onClick={() => onRemove(item.id)} 
              className="p-2 text-slate-400 hover:text-red-500 bg-slate-50 hover:bg-red-50 focus:bg-red-50 focus:text-red-500 rounded-xl transition-all border border-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-red-400" 
              title="Remove Item"
              aria-label={`Remove ${item.title} from shopping bag`}
            >
              <FiTrash2 size={16} className="sm:w-[18px] sm:h-[18px]" />
            </button>
          </div>

          {item.deliveryEstimate && (
            <p className="text-[11px] font-medium text-emerald-600 flex items-center gap-1 mt-1.5 bg-emerald-50/50 px-2 py-0.5 rounded w-max">
              <FiTruck size={12} /> Delivery by <span className="font-bold">{item.deliveryEstimate}</span>
            </p>
          )}
        </div>

        <div className="flex items-center justify-between mt-4 sm:mt-6 pt-3 border-t border-slate-50 gap-4">
          <div className="flex items-baseline gap-1.5">
            <span className="text-base sm:text-2xl font-black text-slate-950">
              ₹{Number(item.price).toLocaleString('en-IN')}
            </span>
            {item.mrp && Number(item.mrp) > Number(item.price) && (
              <span className="text-xs text-slate-400 font-bold line-through">
                ₹{Number(item.mrp).toLocaleString('en-IN')}
              </span>
            )}
          </div>
          
          {/* Quantity Controls Infrastructure */}
          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 shadow-sm overflow-hidden">
            <button 
              onClick={() => onUpdateQuantity(item.id, 'decrease')} 
              className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-slate-500 hover:text-slate-950 hover:bg-slate-50 rounded-lg transition-colors outline-none focus:bg-slate-50"
              aria-label={`Decrease quantity of ${item.title}`}
            >
              <FiMinus size={14} />
            </button>
            <span className="font-black text-slate-950 w-7 sm:w-8 text-center text-sm sm:text-base select-none" aria-live="polite">
              {item.quantity}
            </span>
            <button 
              onClick={() => onUpdateQuantity(item.id, 'increase')} 
              className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-slate-500 hover:text-[#FF4500] hover:bg-orange-50 rounded-lg transition-colors outline-none focus:bg-orange-50"
              aria-label={`Increase quantity of ${item.title}`}
            >
              <FiPlus size={14} />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
});
CartItemRow.displayName = 'CartItemRow';

// Core Application Interface Pipeline
const Cart = ({ isLoggedIn, setIsLoggedIn }) => {
  const { cart, removeFromCart, updateQuantity, cartTotal, cartCount } = useCart();
  const { user } = useUser(); // 🔥 FIX: User data le aao context se
  const navigate = useNavigate(); // 🔥 FIX: Navigation function
  
  const [couponCode, setCouponCode] = useState('');
  const [isCouponApplied, setIsCouponApplied] = useState(false);
  const [couponFeedback, setCouponFeedback] = useState({ message: '', isError: false });
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);

  // Memoized Advanced Financial Matrix
  const financialMetrics = useMemo(() => {
    const total = Number(cartTotal) || 0;
    const baseDiscount = total * 0.10; 
    const extraCouponDiscount = isCouponApplied ? 150 : 0; 
    const totalDiscount = baseDiscount + extraCouponDiscount;
    const finalTotal = Math.max(total - totalDiscount, 0);

    return {
      baseDiscount,
      extraCouponDiscount,
      totalDiscount,
      finalTotal
    };
  }, [cartTotal, isCouponApplied]);

  const handleApplyCoupon = (e) => {
    e.preventDefault();
    const cleanCode = couponCode.trim().toUpperCase();

    if (cleanCode === 'JACK150') {
      setIsCouponApplied(true);
      setCouponFeedback({ message: 'Coupon "JACK150" applied successfully! ₹150 saved.', isError: false });
    } else {
      setIsCouponApplied(false);
      setCouponFeedback({ message: 'Invalid Coupon Code! Try using "JACK150"', isError: true });
    }
  };

  // 🔥 MAGIC LOGIC: Smart redirect checkout handle
  const handleCheckoutSubmission = (e) => {
    e.preventDefault();
    setIsCheckoutLoading(true);
    
    // Thoda delay UX (loading spinner) dikhane ke liye
    setTimeout(() => {
      setIsCheckoutLoading(false);
      
      if (!user) {
        // Agar user login nahi hai, bhej do login page pe aur batao ki '/checkout' jana tha
        navigate('/login', { state: { from: '/checkout' } });
      } else {
        // Agar user login hai, toh direct checkout page pe le jao
        navigate('/checkout');
      }
    }, 500); 
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-sans pb-24 selection:bg-[#FF4500] selection:text-white antialiased">
      <Navbar isLoggedIn={isLoggedIn} setIsLoggedIn={setIsLoggedIn} />

      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 mt-8 outline-none" tabIndex="-1">
        
        {/* Header Branding Row */}
        <div className="flex items-baseline justify-between mb-8 border-b border-slate-200/60 pb-4">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-950 tracking-tight">
            Shopping Bag
          </h1>
          {cartCount > 0 && (
            <span className="bg-slate-900 text-white font-bold text-xs sm:text-sm px-3.5 py-1.5 rounded-full shadow-sm select-none">
              {cartCount} {cartCount === 1 ? 'Item' : 'Items'}
            </span>
          )}
        </div>

        {cart.length === 0 ? (
          /* Empty Pipeline Vector Frame Layout */
          <motion.section 
            initial={{ opacity: 0, y: 15 }} 
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-8 sm:p-16 text-center flex flex-col items-center max-w-2xl mx-auto mt-12"
          >
            <div className="w-28 h-28 sm:w-36 sm:h-36 bg-[#FF4500]/5 rounded-[2rem] flex items-center justify-center text-[#FF4500] mb-6 relative select-none">
              <div className="absolute inset-0 border-2 border-[#FF4500]/10 rounded-[2rem] animate-ping opacity-60"></div>
              <FiShoppingBag size={48} className="sm:w-[56px] sm:h-[56px] stroke-[1.5]" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2 tracking-tight">Your bag is empty</h2>
            <p className="text-slate-400 font-medium mb-8 text-sm sm:text-base max-w-md leading-relaxed">
              Looks like you haven't added any premium items yet. Explore the marketplace updates and claim active offers.
            </p>
            <Link 
              to="/" 
              className="bg-slate-950 hover:bg-[#FF4500] focus:bg-[#FF4500] text-white font-bold py-4 px-8 rounded-xl transition-all shadow-md shadow-slate-950/10 flex items-center space-x-2 active:scale-98 text-sm sm:text-base outline-none focus-visible:ring-4 focus-visible:ring-orange-300"
            >
              <span>EXPLORE LATEST ARRIVALS</span>
              <FiArrowRight size={18} />
            </Link>
          </motion.section>
        ) : (
          
          <div className="flex flex-col lg:flex-row gap-8 items-start">
            
            {/* LEFT PIPELINE GRID: CART ITEMS RECORDSET */}
            <section className="w-full lg:w-[65%] space-y-4" aria-label="Shopping Bag Items">
              <AnimatePresence mode="popLayout">
                {cart.map((item) => (
                  <CartItemRow 
                    key={item.id} 
                    item={item} 
                    onRemove={removeFromCart} 
                    onUpdateQuantity={updateQuantity} 
                  />
                ))}
              </AnimatePresence>
            </section>

            {/* RIGHT PIPELINE GRID: FINANCIAL METRICS & CONVERSION TASKS */}
            <aside className="w-full lg:w-[35%] sticky top-24 space-y-5">
              
              {/* Promotion Code Panel Block */}
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 sm:p-6">
                <h3 className="text-xs font-bold text-slate-500 mb-3 flex items-center uppercase tracking-widest">
                  <FiTag className="mr-2 text-indigo-500 stroke-[2.5]" size={14} /> Promotional Offer
                </h3>
                <form onSubmit={handleApplyCoupon} className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Promo code (Try JACK150)" 
                    value={couponCode}
                    onChange={(e) => {
                      setCouponCode(e.target.value);
                      if(couponFeedback.message) setCouponFeedback({ message: '', isError: false });
                    }}
                    disabled={isCouponApplied}
                    className="flex-1 border border-slate-200 rounded-xl px-4 py-3 text-xs sm:text-sm font-bold uppercase tracking-wider focus:border-slate-900 outline-none transition-all disabled:bg-slate-50 disabled:text-slate-400 focus:ring-4 focus:ring-slate-100"
                    aria-label="Coupon registration code field"
                  />
                  <button 
                    type="submit" 
                    disabled={isCouponApplied || !couponCode.trim()}
                    className="bg-slate-950 hover:bg-indigo-600 text-white font-bold text-xs px-5 py-3 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                  >
                    {isCouponApplied ? 'APPLIED' : 'APPLY'}
                  </button>
                </form>
                
                {couponFeedback.message && (
                  <motion.div 
                    initial={{ opacity: 0, y: -5 }} 
                    animate={{ opacity: 1, y: 0 }}
                    className={`text-xs font-bold mt-3 flex items-center gap-1.5 p-2.5 rounded-lg border ${
                      couponFeedback.isError 
                        ? 'text-red-600 bg-red-50/60 border-red-100' 
                        : 'text-emerald-600 bg-emerald-50/60 border-emerald-100'
                    }`}
                  >
                    {couponFeedback.isError ? <FiAlertCircle size={14} /> : <FiCheckCircle size={14} />}
                    <span>{couponFeedback.message}</span>
                  </motion.div>
                )}
              </div>

              {/* Order Summary Calculations Card */}
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 sm:p-8">
                <h3 className="text-lg font-black text-slate-950 mb-5 border-b border-slate-50 pb-3">Order Summary</h3>
                
                <div className="space-y-3.5 mb-5 text-xs sm:text-sm font-medium">
                  <div className="flex justify-between text-slate-500">
                    <span>Subtotal ({cartCount} {cartCount === 1 ? 'item' : 'items'})</span>
                    <span className="font-bold text-slate-900">₹{cartTotal.toLocaleString('en-IN')}</span>
                  </div>
                  
                  <div className="flex justify-between text-emerald-600 font-bold bg-emerald-50/40 px-3 py-2 rounded-xl border border-emerald-100/30">
                    <span className="flex items-center gap-1"><FiCheckCircle size={13} /> Seasonal Promo (10% Off)</span>
                    <span>- ₹{financialMetrics.baseDiscount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  </div>

                  {isCouponApplied && (
                    <div className="flex justify-between text-indigo-600 font-bold bg-indigo-50/40 px-3 py-2 rounded-xl border border-indigo-100/30">
                      <span className="flex items-center gap-1"><FiTag size={13} /> Coupon Code Applied</span>
                      <span>- ₹{financialMetrics.extraCouponDiscount.toLocaleString('en-IN')}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-slate-500 items-center pt-1">
                    <span>Shipping Fee</span>
                    <span className="text-emerald-600 font-black text-[10px] sm:text-xs bg-emerald-50 px-2.5 py-0.5 rounded-md uppercase tracking-wider border border-emerald-100">Free</span>
                  </div>

                  {/* Calculated Dynamic Customer Savings Analytics Row */}
                  <div className="flex justify-between text-slate-900 font-black pt-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-xs uppercase tracking-wide flex items-center gap-1 text-slate-600">
                      <FiInfo size={12} /> You Saved
                    </span>
                    <span className="text-sm sm:text-base text-[#FF4500]">
                      ₹{financialMetrics.totalDiscount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>

                <div className="w-full h-px bg-slate-100 mb-5"></div>

                <div className="flex justify-between items-baseline mb-6">
                  <div>
                    <span className="text-sm font-bold text-slate-800 block">Total Amount</span>
                    <span className="text-[10px] text-slate-400 font-medium">Inclusive of all local taxes</span>
                  </div>
                  <span className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
                    ₹{financialMetrics.finalTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </span>
                </div>

                {/* 🔥 FIX: <Link> ki jagah <button> use kiya taaki smart logic chal sake */}
                <button 
                  onClick={handleCheckoutSubmission}
                  disabled={isCheckoutLoading}
                  className="w-full bg-slate-950 hover:bg-[#FF4500] disabled:bg-slate-500 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-sm sm:text-base flex justify-center items-center space-x-2 shadow-md active:scale-[0.99] transition-all outline-none focus-visible:ring-4 focus-visible:ring-orange-300"
                >
                  {isCheckoutLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>PROCEED TO SECURE CHECKOUT</span>
                      <FiArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>

              {/* Verified Trust Badges Pipeline Matrix */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white p-3 rounded-2xl border border-slate-100/80 flex flex-col items-center text-center shadow-sm select-none">
                  <FiShield size={20} className="text-slate-700 mb-1.5 stroke-[1.75]" />
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider leading-tight">Secure<br/>PCI Assets</p>
                </div>
                <div className="bg-white p-3 rounded-2xl border border-slate-100/80 flex flex-col items-center text-center shadow-sm select-none">
                  <FiTruck size={20} className="text-slate-700 mb-1.5 stroke-[1.75]" />
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider leading-tight">Priority<br/>Fulfillment</p>
                </div>
                <div className="bg-white p-3 rounded-2xl border border-slate-100/80 flex flex-col items-center text-center shadow-sm select-none">
                  <FiCheckCircle size={20} className="text-slate-700 mb-1.5 stroke-[1.75]" />
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider leading-tight">100% Original<br/>Warranty</p>
                </div>
              </div>

            </aside>
          </div>
        )}
      </main>
    </div>
  );
};

export default Cart;