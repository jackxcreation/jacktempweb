// jack-frontend/src/pages/ProductDetails.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom'; 
import { motion, AnimatePresence } from 'framer-motion';
import { FiStar, FiShoppingCart, FiZap, FiTruck, FiShield, FiRotateCcw, FiBox, FiMapPin, FiCheckCircle, FiHeart, FiShare2, FiEye, FiMessageCircle, FiXCircle, FiCheck, FiX, FiHelpCircle, FiBell } from 'react-icons/fi';
import { useCart } from '../context/CartContext';
import { useProducts } from '../context/ProductContext'; 
import { useUser } from '../context/UserContext'; 
import { useCompare } from '../context/CompareContext';
import { io } from 'socket.io-client';
import { getOptimizedImageUrl } from '../utils/imageOptimizer';
// 🔥 PHASE 1 FIX: Use canonical axiosInstance for ALL backend calls
import axiosInstance from '../api/axiosInstance'; 
import { ProductInternalGraph } from '../components/ProductInternalGraph';
import SmartImage from '../components/SmartImage'; // 🔥 TASK #58: Universal Broken-Image Fallback Component
import ProductImage from '../components/ProductImage'; // 🔥 TASK #57: WebP/AVIF Responsive Optimized Images
import SEOManager from '../components/SEOManager'; // 🔥 TASK #54: Dynamic SEO Manager
import ProductSchema from '../components/ProductSchema'; // 🔥 TASK #55: Google-friendly Structured Data Schema

// 🔥 CANONICAL CURRENCY FORMATTER UTILITY
const formatCurrency = (paise) => {
  if (typeof paise !== 'number') return '₹0.00';
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const SimilarProductCard = ({ product }) => {
  const { addToCart } = useCart();
  const { addToCompare } = useCompare();
  if (!product) return null;

  const productPricePaise = product.pricePaise || (product.price ? product.price * 100 : 0);

  return (
    <Link to={`/product/${product.id || product._id}`} className="block h-full outline-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        whileHover={{ y: -4 }}
        className="bg-white rounded-3xl p-3 shadow-sm hover:shadow-xl transition-shadow duration-300 border border-slate-100 group relative flex flex-col h-full overflow-hidden"
      >
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-1.5">
          {(product.isTrending || product.views > 50) && <span className="bg-red-500 text-white text-[9px] font-black px-2.5 py-1 rounded-sm uppercase tracking-widest animate-pulse shadow-md shadow-red-500/30">🔥 Trending</span>}
          {product.discount && <span className="bg-[#FF4500] text-white text-[9px] font-black px-2.5 py-1 rounded-sm uppercase tracking-widest">{product.discount}</span>}
        </div>
        <div className="w-full h-40 bg-slate-50/50 rounded-2xl overflow-hidden mb-4 relative p-3 flex items-center justify-center">
          <ProductImage 
            src={product.image} 
            alt={product.title} 
            width={320}
            height={160}
            className="max-w-full max-h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-500" 
          />
        </div>
        <div className="flex flex-col flex-grow px-1">
          <h3 className="text-sm font-bold text-slate-800 line-clamp-2 mb-3 leading-snug group-hover:text-[#FF4500] transition-colors">{product.title}</h3>
          <div className="mt-auto flex items-end justify-between">
            <span className="text-lg font-black text-slate-900 leading-none">{formatCurrency(productPricePaise)}</span>
            <div className="flex gap-1">
              <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); addToCompare(product); }} className="bg-slate-100 text-slate-700 hover:bg-slate-900 hover:text-white px-2.5 py-2 rounded-xl transition-colors text-[10px] font-bold cursor-pointer">
                Comp
              </button>
              <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); addToCart(product); }} className="bg-slate-100 text-slate-900 hover:bg-[#FF4500] hover:text-white p-2 rounded-xl transition-colors cursor-pointer" aria-label="Add to cart">
                <FiShoppingCart size={16} />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
};

// ==========================================
// 🔔 NOTIFY ME BUTTON COMPONENT (BACK-IN-STOCK)
// ==========================================
const NotifyMeButton = ({ productId }) => {
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  const handleNotify = async () => {
    if (!productId || loading || subscribed) return;
    setLoading(true);
    try {
      // 🔥 FIX: Added withCredentials to send auth cookie
      const res = await axiosInstance.post('/stock-alerts/subscribe', { productId }, { withCredentials: true });
      if (res?.data?.success) {
        setSubscribed(true);
        alert(res.data.message || "You will be notified when available!");
      }
    } catch (err) {
      alert(err.response?.data?.message || "Please login to set back-in-stock alerts.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.button 
      whileTap={{ scale: 0.97 }}
      onClick={handleNotify}
      disabled={loading || subscribed}
      className={`w-full py-4 rounded-2xl font-black text-sm md:text-lg flex justify-center items-center gap-2 transition-all shadow-md cursor-pointer ${subscribed ? 'bg-emerald-600 text-white cursor-default' : 'bg-slate-900 hover:bg-[#FF4500] text-white'}`}
    >
      <FiBell size={20} className={loading ? "animate-bounce" : ""} />
      <span>{loading ? "PROCESSING..." : subscribed ? "YOU WILL BE NOTIFIED" : "NOTIFY ME WHEN AVAILABLE"}</span>
    </motion.button>
  );
};

// ==========================================
// 📝 ADD REVIEW MODAL COMPONENT
// ==========================================
const AddReviewModal = ({ isOpen, onClose, productId, onReviewAdded }) => {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0); // NEW: visual-only star hover preview
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');

    try {
      // 🔥 FIX: Added withCredentials to authenticate review post
      const res = await axiosInstance.post(`/products/${productId}/reviews`, {
        rating,
        title,
        comment
      }, { withCredentials: true });
      
      if (res.status === 201 || res.status === 200 || res.data?.success) {
        if (onReviewAdded) onReviewAdded();
        onClose();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to submit review. Make sure you are logged in.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
        <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ type: 'spring', stiffness: 320, damping: 30 }} className="bg-white rounded-[2rem] max-w-lg w-full p-6 shadow-2xl">
          <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
            <h3 className="text-xl font-black text-slate-900">Write a Review</h3>
            <button onClick={onClose} aria-label="Close" className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 cursor-pointer"><FiX size={18}/></button>
          </div>

          {errorMsg && <p className="bg-red-50 text-red-600 text-xs font-bold p-3 rounded-xl mb-4 border border-red-100">{errorMsg}</p>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Rating</label>
              <div className="flex gap-2" onMouseLeave={() => setHoverRating(0)}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    type="button"
                    key={star}
                    onMouseEnter={() => setHoverRating(star)}
                    onClick={() => setRating(star)}
                    className={`text-3xl leading-none transition-colors cursor-pointer ${(hoverRating || rating) >= star ? 'text-amber-400' : 'text-slate-200'}`}
                  >★</button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Review Title</label>
              <input type="text" placeholder="e.g., Excellent product!" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none focus:border-slate-900 transition-colors" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Detailed Review</label>
              <textarea rows="4" placeholder="Write your experience..." value={comment} onChange={(e) => setComment(e.target.value)} required className="w-full border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none focus:border-slate-900 resize-none transition-colors"></textarea>
            </div>

            <button type="submit" disabled={submitting} className="w-full bg-slate-900 hover:bg-[#FF4500] text-white font-black py-3.5 rounded-xl transition-all shadow-md active:scale-95 disabled:bg-slate-300 cursor-pointer">
              {submitting ? 'Submitting...' : 'Post Review'}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

const ProductDetails = ({ isLoggedIn, setIsLoggedIn }) => {
  const { id } = useParams(); 
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { products } = useProducts();
  const { user, addRecentlyViewed } = useUser(); 
  const { addToCompare } = useCompare();

  const product = products.find(p => String(p.id || p._id) === String(id));
  const productIdSafeguard = product?.id || product?._id; 

  const [mainImage, setMainImage] = useState('');
  const [pincode, setPincode] = useState('');
  
  const [deliveryStatus, setDeliveryStatus] = useState(null); 
  const [deliveryInfo, setDeliveryInfo] = useState(null); 
  const [isEditingPincode, setIsEditingPincode] = useState(false); 
  
  const pincodeCache = useRef({});
  const hasFetchedAPIs = useRef(null);

  const [showStickyBar, setShowStickyBar] = useState(false);
  const [viewers] = useState(Math.floor(Math.random() * 20) + 12); 

  const [similarProducts, setSimilarProducts] = useState([]);
  const [productReviews, setProductReviews] = useState([]);
  const [questionsList, setQuestionsList] = useState([]);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [replyingToQId, setReplyingToQId] = useState(null);
  const [answerText, setAnswerText] = useState('');

  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isLoadingSimilar, setIsLoadingSimilar] = useState(true);

  // NEW (presentational/UI-only state — no backend contract changes)
  const [quantity, setQuantity] = useState(1);
  const [activeInfoTab, setActiveInfoTab] = useState('details');

  // 🔥 Extracted WebSocket URL logically
  const socketURL = import.meta.env.VITE_API_URL 
      ? import.meta.env.VITE_API_URL.replace(/\/api$/, '') 
      : 'https://ecom-project-nx15.onrender.com';

  const fetchProductReviews = () => {
    if (!productIdSafeguard) return;
    axiosInstance.get(`/products/${productIdSafeguard}/reviews`)
      .then(res => {
        // 🔥 SMART EXTRACTOR FOR REVIEWS
        const payload = res.data?.data || res.data;
        const reviewsArray = Array.isArray(payload) ? payload : (payload?.reviews || []);
        setProductReviews(reviewsArray);
      })
      .catch(err => console.log("Failed to load reviews"));
  };

  const fetchQuestions = () => {
    if (!productIdSafeguard) return;
    axiosInstance.get(`/products/${productIdSafeguard}/questions`)
      .then(res => {
        // 🔥 SMART EXTRACTOR FOR QUESTIONS
        const payload = res.data?.data || res.data;
        const questionsArray = Array.isArray(payload) ? payload : (payload?.questions || []);
        setQuestionsList(questionsArray);
      })
      .catch(err => console.log("Failed to load questions"));
  };

  useEffect(() => {
    window.scrollTo(0, 0);

    if (hasFetchedAPIs.current === productIdSafeguard) return;

    if (product && productIdSafeguard) {
      hasFetchedAPIs.current = productIdSafeguard; 

      addRecentlyViewed(product);
      setMainImage((product.images && product.images.length > 0) ? product.images[0] : product.image);
      setQuantity(1); // reset quantity when a new product loads

      axiosInstance.get(`/products/${productIdSafeguard}`).catch(err => console.log("View tracking failed"));

      fetchProductReviews();
      fetchQuestions();

      axiosInstance.get(`/products/similar/${productIdSafeguard}`)
        .then(res => {
          // 🔥 SMART EXTRACTOR FOR SIMILAR PRODUCTS
          const payload = res.data?.data || res.data;
          const similarArray = Array.isArray(payload) ? payload : (payload?.products || []);
          setSimilarProducts(similarArray);
          setIsLoadingSimilar(false);
        })
        .catch(err => {
          console.error("Similar fetch error:", err);
          setIsLoadingSimilar(false);
        });
    }
  }, [productIdSafeguard, product, addRecentlyViewed]); 

  // 🔥 Robust Token Check for Sockets supporting multi-storage keys (Kept fallback for socket auth, but HTTP-only works natively)
  useEffect(() => {
    let socket;
    const token = localStorage.getItem('token') || 
                  localStorage.getItem('jack_token') || 
                  localStorage.getItem('adminToken');
    
    if (productIdSafeguard) {
      socket = io(socketURL, { 
        withCredentials: true,
        auth: { token } // Kept as fallback, socket.io will prefer cookie if server configured
      });

      socket.on(`new_question_${productIdSafeguard}`, (newQ) => {
        setQuestionsList(prev => [newQ, ...prev]);
      });

      socket.on(`new_answer_${productIdSafeguard}`, (updatedQ) => {
        setQuestionsList(prev => prev.map(q => q._id === updatedQ._id ? updatedQ : q));
      });
    }

    return () => {
      if (socket) socket.disconnect();
    };
  }, [productIdSafeguard, socketURL]);

  // 🔥 Robust Visitor Socket
  useEffect(() => {
    let socketVisitor;
    const token = localStorage.getItem('token') || 
                  localStorage.getItem('jack_token') || 
                  localStorage.getItem('adminToken');

    if (productIdSafeguard) {
      socketVisitor = io(socketURL, { 
        withCredentials: true,
        auth: { token }
      });

      socketVisitor.on('connect', () => {
        socketVisitor.emit('join_product_page', {
          productId: productIdSafeguard,
          productName: product?.title || 'Product',
          user: user?.name || 'Anonymous Guest',
          device: /Mobi|Android/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop'
        });
      });
    }

    return () => {
      if (socketVisitor) {
        socketVisitor.emit('leave_product_page');
        socketVisitor.disconnect();
      }
    };
  }, [productIdSafeguard, user?.name, socketURL, product?.title]);

  useEffect(() => {
    const handleScroll = () => {
      setShowStickyBar(window.scrollY > 500);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const verifyPincode = async (pinCodeToCheck) => {
    if (!pinCodeToCheck || pinCodeToCheck.length !== 6) return;

    if (pincodeCache.current[pinCodeToCheck]) {
      const cachedData = pincodeCache.current[pinCodeToCheck];
      if (cachedData.success && cachedData.isServiceable) {
        setDeliveryInfo(cachedData);
        setDeliveryStatus('success');
        setIsEditingPincode(false);
      } else {
        setDeliveryInfo(cachedData);
        setDeliveryStatus('error');
      }
      return;
    }

    setDeliveryStatus('checking');
    try {
      const res = await axiosInstance.get(`/delivery-check?pincode=${pinCodeToCheck}`);
      
      // 🔥 SMART EXTRACTOR FOR PINCODE
      const responseBody = res.data;
      const payload = responseBody?.data || responseBody;
      const mergedData = { ...responseBody, ...payload }; // Normalize to support old structure
      
      pincodeCache.current[pinCodeToCheck] = mergedData;
      
      if (mergedData.success !== false && mergedData.isServiceable) {
        setDeliveryInfo(mergedData);
        setDeliveryStatus('success');
        setIsEditingPincode(false); 
      } else {
        setDeliveryInfo(mergedData);
        setDeliveryStatus('error');
      }
    } catch (error) {
      if (error.response?.status === 429) {
         setDeliveryInfo({ message: "Checking too fast! Please wait a minute." });
      } else {
         setDeliveryInfo({ message: "Network error. Please try again." });
      }
      setDeliveryStatus('error');
    }
  };

  useEffect(() => {
    if (user && user.addresses && user.addresses.length > 0 && !deliveryStatus) {
      const defaultAddress = user.addresses.find(a => a.isDefault) || user.addresses[0]; 
      setPincode(defaultAddress.pincode);
      verifyPincode(defaultAddress.pincode); 
    }
  }, [user]);

  const handlePostQuestion = async (e) => {
    e.preventDefault();
    if (!newQuestionText.trim()) return;
    try {
      // 🔥 FIX: Added withCredentials for authenticated post
      await axiosInstance.post(`/products/${productIdSafeguard}/questions`, { question: newQuestionText }, { withCredentials: true });
      setNewQuestionText('');
      fetchQuestions();
    } catch (err) {
      alert("Please login to ask a question.");
    }
  };

  const handlePostAnswer = async (qId) => {
    if (!answerText.trim()) return;
    try {
      // 🔥 FIX: Added withCredentials for authenticated post
      await axiosInstance.post(`/questions/${qId}/answers`, { answer: answerText }, { withCredentials: true });
      setAnswerText('');
      setReplyingToQId(null);
      fetchQuestions();
    } catch (err) {
      alert("Please login to answer.");
    }
  };

  if (!product) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center flex-col">
        <div className="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center mb-6"><FiBox size={40} className="text-slate-400" /></div>
        <h2 className="text-2xl font-black mb-4 text-slate-900">Product Not Found</h2>
        <p className="text-slate-500 mb-8 font-medium">This item might have been removed or is out of stock.</p>
        <button onClick={() => navigate('/shop')} className="bg-slate-900 hover:bg-[#FF4500] text-white px-10 py-4 rounded-xl font-black transition-all shadow-lg active:scale-95 cursor-pointer">RETURN TO SHOP</button>
      </div>
    );
  }

  const productPricePaise = product.pricePaise || (product.price ? product.price * 100 : 0);
  const productMrpPaise = product.mrpPaise || (product.mrp ? product.mrp * 100 : 0);
  const productImages = (product.images && product.images.length > 0) ? product.images : [product.image];

  const seoTitle = `${product.title} | Jack Essentials`;
  const seoDescription = product.description ? product.description.substring(0, 160) : `Buy ${product.title} at best price on Jack Essentials. Free delivery & secure payments.`;
  const seoCanonical = typeof window !== 'undefined' ? window.location.href : `https://thejackessentials.com/product/${product.id || product._id}`;
  const seoOgImage = productImages[0] || "https://thejackessentials.com/og-banner.jpg";

  // NEW: quantity is UI-only state; cart mutation still goes exclusively through the
  // original addToCart(product) contract — called `quantity` times so nothing about
  // CartContext itself is touched.
  const incrementQty = () => setQuantity(q => Math.min(q + 1, parseInt(product.inventory) || 99));
  const decrementQty = () => setQuantity(q => Math.max(1, q - 1));
  const handleAddToCart = () => { for (let i = 0; i < quantity; i++) addToCart(product); };
  const handleBuyNow = () => { for (let i = 0; i < quantity; i++) addToCart(product); navigate('/checkout'); };

  const infoTabs = [
    { key: 'details', label: 'Details' },
    { key: 'shipping', label: 'Shipping & Returns' },
    { key: 'reviews', label: `Reviews (${productReviews.length || product.reviews || 0})` },
    { key: 'qna', label: `Q&A (${questionsList.length})` },
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-24 md:pb-20 relative">
      {/* 🔥 TASK #54: Dynamic SEO Manager integration */}
      <SEOManager 
        title={seoTitle}
        description={seoDescription}
        canonicalUrl={seoCanonical}
        ogImage={seoOgImage}
        ogType="product"
      />

      {/* 🔥 TASK #55: Google-friendly Product Structured Data Schema Component */}
      <ProductSchema product={product} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 md:mt-10">
        
        <div className="text-xs md:text-sm text-slate-500 mb-6 flex items-center space-x-2 font-medium">
          <span onClick={() => navigate('/')} className="hover:text-slate-900 cursor-pointer transition-colors">Home</span> <span>/</span>
          <span onClick={() => navigate('/shop')} className="hover:text-slate-900 cursor-pointer transition-colors">{product.category || 'Category'}</span> <span>/</span>
          <span className="text-slate-800 font-bold truncate">{product.title}</span>
        </div>

        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-4 md:p-8 lg:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 mb-8">
          
          <div className="lg:col-span-5 xl:col-span-5 flex flex-col-reverse md:flex-row gap-4 md:gap-6 h-max relative lg:sticky lg:top-24">
            
            {productImages.length > 1 && (
              <div className="flex md:flex-col gap-3 overflow-x-auto scrollbar-hide w-full md:w-20 flex-shrink-0">
                {productImages.map((img, idx) => (
                  <motion.button 
                    key={idx} 
                    onClick={() => setMainImage(img)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    aria-label={`View image ${idx + 1}`}
                    className={`w-16 h-16 md:w-20 md:h-20 rounded-xl overflow-hidden border-2 transition-colors flex-shrink-0 bg-slate-50 cursor-pointer ${mainImage === img ? 'border-slate-900 ring-2 ring-slate-900/10' : 'border-transparent hover:border-slate-300'}`}
                  >
                    <ProductImage 
                      src={img} 
                      alt={`thumbnail-${idx}`} 
                      width={80}
                      height={80}
                      className="w-full h-full object-contain mix-blend-multiply p-1" 
                    />
                  </motion.button>
                ))}
              </div>
            )}

            <div className="w-full flex-1 bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl overflow-hidden flex items-center justify-center p-6 md:p-10 relative group border border-slate-100 aspect-square md:aspect-auto cursor-zoom-in">
              
              <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                {(product.isTrending || product.views > 50) && <span className="bg-red-500 text-white text-[10px] font-black px-3 py-1.5 rounded uppercase tracking-widest shadow-sm animate-pulse">🔥 Trending</span>}
                {product.discount && <span className="bg-[#FF4500] text-white text-[10px] font-black px-3 py-1.5 rounded uppercase tracking-widest shadow-sm">{product.discount}</span>}
                {product.badge && <span className="bg-slate-900 text-white text-[10px] font-black px-3 py-1.5 rounded uppercase tracking-widest shadow-sm">{product.badge}</span>}
              </div>

              <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
                <motion.button whileTap={{ scale: 0.9 }} aria-label="Add to Wishlist" className="bg-white/80 backdrop-blur-md p-3 rounded-full shadow-sm text-slate-500 hover:text-red-500 hover:bg-white transition-colors cursor-pointer"><FiHeart size={20} /></motion.button>
                <motion.button whileTap={{ scale: 0.9 }} aria-label="Share" className="bg-white/80 backdrop-blur-md p-3 rounded-full shadow-sm text-slate-500 hover:text-indigo-600 hover:bg-white transition-colors cursor-pointer"><FiShare2 size={20} /></motion.button>
              </div>

              <AnimatePresence mode="wait">
                {mainImage ? (
                  <motion.div 
                    key={mainImage}
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
                    className="w-full h-full flex items-center justify-center"
                  >
                    <ProductImage 
                      src={mainImage} 
                      alt={product.title} 
                      width={600}
                      height={600}
                      priority={true}
                      className="w-full h-full object-contain mix-blend-multiply group-hover:scale-110 transition-transform duration-700 ease-out"
                    />
                  </motion.div>
                ) : (
                  <motion.div 
                    key="loading"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="w-full h-full flex items-center justify-center text-slate-400 font-bold tracking-widest uppercase text-xs animate-pulse"
                  >
                    Loading Image...
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="lg:col-span-7 xl:col-span-7 flex flex-col">
            
            <div className="flex items-center gap-2 text-[#FF4500] bg-orange-50 px-3 py-1.5 rounded-lg w-max mb-4">
              <FiEye className="animate-pulse" />
              <span className="text-xs font-bold">{viewers} people are viewing this right now</span>
            </div>

            {product.brand && <h3 className="text-indigo-600 font-black tracking-widest uppercase text-xs mb-2">{product.brand}</h3>}
            <h1 className="text-2xl md:text-4xl font-black text-slate-900 leading-[1.2] mb-4 tracking-tight">
              {product.title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 mb-6">
              <div className="flex items-center bg-slate-900 px-3 py-1 rounded-full cursor-pointer hover:bg-slate-800 transition-colors">
                <span className="text-white font-bold text-sm mr-1.5">{product.rating || "4.8"}</span>
                <FiStar className="text-yellow-400 fill-yellow-400" size={14} />
              </div>
              <span onClick={() => setActiveInfoTab('reviews')} className="text-indigo-600 hover:underline cursor-pointer text-sm font-bold">Read {product.reviews || "124"} Reviews</span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-500 text-sm font-medium">SKU: {product.sku || `JCK-${String(productIdSafeguard).slice(-6).toUpperCase()}`}</span>
            </div>

            {(product.color || product.size) && (
              <div className="flex flex-wrap gap-2 mb-6">
                {product.color && (
                  <span className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">Color: {product.color}</span>
                )}
                {product.size && (
                  <span className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">Size: {product.size}</span>
                )}
              </div>
            )}

            <div className="w-full h-px bg-slate-100 mb-6"></div>

            <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <div className="flex items-end space-x-3 mb-1">
                  <span className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">{formatCurrency(productPricePaise)}</span>
                  {productMrpPaise > productPricePaise && <span className="text-xl text-slate-400 line-through mb-1.5 font-medium">{formatCurrency(productMrpPaise)}</span>}
                </div>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Inclusive of all taxes</p>
              </div>
              {parseInt(product.inventory) === 0 ? (
                <div className="text-right">
                  <span className="text-red-600 font-black text-sm uppercase tracking-widest bg-red-50 px-3 py-1 rounded-md border border-red-200">Out of Stock</span>
                </div>
              ) : parseInt(product.inventory) < 10 && (
                <div className="text-right">
                  <span className="text-red-500 font-black text-sm uppercase tracking-widest bg-red-50 px-3 py-1 rounded-md">Only {product.inventory} Left!</span>
                </div>
              )}
            </div>

            {/* Smart Delivery Options */}
            <div className="mb-8 bg-slate-50/50 border border-slate-200 rounded-2xl p-5 md:p-6">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center"><FiTruck className="mr-2" size={16}/> Delivery & Services</h4>
              
              <AnimatePresence mode="wait">
                {deliveryStatus === 'success' && deliveryInfo && !isEditingPincode ? (
                  <motion.div key="success" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }} className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
                    <div className="flex items-start gap-3">
                      <FiMapPin className="text-indigo-600 mt-1 flex-shrink-0" size={20}/>
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          Deliver to {user?.name ? user.name.split(' ')[0] : 'Customer'} - <span className="font-black text-[#FF4500]">{pincode}</span>
                        </p>
                        <p className="text-sm text-green-600 font-bold mt-0.5">
                          Free Delivery by {deliveryInfo.estimatedDate}
                        </p>
                        <p className="text-xs text-slate-500 mt-1 font-medium">
                          {deliveryInfo.codAvailable ? '💸 Cash on Delivery available' : '💳 Prepaid orders only for this location'}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setIsEditingPincode(true)} 
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-4 py-2 rounded-lg transition-colors w-max cursor-pointer"
                    >
                      Change
                    </button>
                  </motion.div>
                ) : (
                  <motion.div key="form" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="relative flex-1">
                        <FiMapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                          type="text" 
                          maxLength={6} 
                          placeholder="Enter Pincode" 
                          value={pincode} 
                          onChange={(e) => setPincode(e.target.value.replace(/[^0-9]/g, ''))}
                          className="w-full border border-slate-300 rounded-xl py-3.5 pl-11 pr-4 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 font-bold tracking-widest text-slate-800 transition-all bg-white shadow-sm"
                        />
                      </div>
                      <button 
                        onClick={() => verifyPincode(pincode)} 
                        disabled={pincode.length !== 6 || deliveryStatus === 'checking'} 
                        className="bg-slate-900 disabled:bg-slate-300 text-white font-black text-sm px-8 py-3.5 rounded-xl hover:bg-slate-800 transition-colors shadow-md cursor-pointer flex items-center justify-center gap-2 min-w-[96px]"
                      >
                        {deliveryStatus === 'checking' ? (
                          <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                        ) : 'CHECK'}
                      </button>
                    </div>
                    
                    <AnimatePresence>
                      {deliveryStatus === 'error' && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                          className={`text-xs mt-4 font-bold flex items-center p-3 rounded-xl border overflow-hidden ${deliveryInfo?.message?.includes('fast') ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-red-500 bg-red-50 border-red-100'}`}
                        >
                          <FiXCircle className="mr-2 flex-shrink-0" size={16}/> 
                          {deliveryInfo?.message || "Invalid pincode or unserviceable area."}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 🔥 CONDITIONAL RENDER: NOTIFY ME WHEN AVAILABLE OR BUY BUTTONS */}
            {parseInt(product.inventory) === 0 ? (
              <div className="mt-auto">
                <NotifyMeButton productId={productIdSafeguard} />
              </div>
            ) : (
              <div className="mt-auto">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-white shrink-0">
                    <button onClick={decrementQty} disabled={quantity <= 1} className="w-11 h-12 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white transition-colors cursor-pointer text-lg font-bold">−</button>
                    <span className="w-10 text-center font-black text-slate-900 text-sm tabular-nums">{quantity}</span>
                    <button onClick={incrementQty} disabled={quantity >= (parseInt(product.inventory) || 99)} className="w-11 h-12 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white transition-colors cursor-pointer text-lg font-bold">+</button>
                  </div>
                  <p className="text-xs text-slate-400 font-semibold">
                    {parseInt(product.inventory) > 0 && parseInt(product.inventory) < 10 ? `Only ${product.inventory} left in stock` : 'In stock, ready to ship'}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <motion.button whileTap={{ scale: 0.97 }} onClick={handleAddToCart} className="flex-1 bg-white border-2 border-slate-900 text-slate-900 hover:bg-slate-900 hover:text-white py-4 px-2 rounded-2xl font-black text-sm md:text-lg flex justify-center items-center gap-2 transition-colors cursor-pointer">
                    <FiShoppingCart size={20} /><span>ADD TO BAG</span>
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={() => addToCompare(product)} className="bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-900 py-4 px-6 rounded-2xl font-black text-sm md:text-lg flex justify-center items-center gap-2 transition-colors cursor-pointer">
                    Compare
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    whileHover={{ boxShadow: '0 16px 30px -10px rgba(255,69,0,0.55)' }}
                    onClick={handleBuyNow}
                    className="flex-1 bg-gradient-to-r from-[#FF4500] to-orange-600 hover:from-[#E8004C] hover:to-red-600 text-white py-4 px-2 rounded-2xl font-black text-sm md:text-lg flex justify-center items-center gap-2 shadow-[0_10px_20px_-10px_rgba(255,69,0,0.6)] transition-colors cursor-pointer"
                  >
                    <FiZap size={20} className="animate-pulse" /><span>BUY IT NOW</span>
                  </motion.button>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-3 gap-2 mt-8 pt-6 border-t border-slate-100">
              <div className="flex flex-col items-center text-slate-600 bg-slate-50 py-3 rounded-xl">
                <FiRotateCcw size={20} className="mb-1.5 text-indigo-500" />
                <span className="text-[10px] font-bold text-center uppercase tracking-widest">7 Days<br/>Return</span>
              </div>
              <div className="flex flex-col items-center text-slate-600 bg-slate-50 py-3 rounded-xl">
                <FiTruck size={20} className="mb-1.5 text-indigo-500" />
                <span className="text-[10px] font-bold text-center uppercase tracking-widest">Free<br/>Shipping</span>
              </div>
              <div className="flex flex-col items-center text-slate-600 bg-slate-50 py-3 rounded-xl">
                <FiShield size={20} className="mb-1.5 text-indigo-500" />
                <span className="text-[10px] font-bold text-center uppercase tracking-widest">1 Year<br/>Warranty</span>
              </div>
            </div>

          </div>
        </div>

        {/* --- Internal Linking Architecture Graph Component --- */}
        <ProductInternalGraph product={product} />

        {/* 🔥 UNIFIED INFO TABS: Details / Shipping / Reviews / Q&A */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 mb-12 overflow-hidden">
          <div className="flex overflow-x-auto scrollbar-hide border-b border-slate-100 px-4 md:px-8">
            {infoTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveInfoTab(tab.key)}
                className={`relative px-4 md:px-5 py-5 text-sm font-bold whitespace-nowrap transition-colors outline-none cursor-pointer ${activeInfoTab === tab.key ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {tab.label}
                {activeInfoTab === tab.key && (
                  <motion.span layoutId="infoTabLine" className="absolute left-0 right-0 -bottom-[1px] h-[2.5px] bg-[#FF4500] rounded-full" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />
                )}
              </button>
            ))}
          </div>

          <div className="p-6 md:p-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeInfoTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                {activeInfoTab === 'details' && (
                  <div>
                    <h2 className="text-lg font-black text-slate-900 mb-5 flex items-center"><FiBox className="mr-2.5 text-[#FF4500]" /> Product Specifications</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10">
                      <div className="flex justify-between border-b border-slate-50 py-4"><span className="text-slate-500 font-medium text-sm">Brand</span><span className="font-bold text-slate-900 text-right text-sm">{product.brand || 'Generic'}</span></div>
                      <div className="flex justify-between border-b border-slate-50 py-4"><span className="text-slate-500 font-medium text-sm">Color</span><span className="font-bold text-slate-900 text-right text-sm">{product.color || 'Standard'}</span></div>
                      <div className="flex justify-between border-b border-slate-50 py-4"><span className="text-slate-500 font-medium text-sm">Size</span><span className="font-bold text-slate-900 text-right text-sm">{product.size || 'Free Size'}</span></div>
                      <div className="flex justify-between border-b border-slate-50 py-4"><span className="text-slate-500 font-medium text-sm">Weight</span><span className="font-bold text-slate-900 text-right text-sm">{product.weight ? `${product.weight} gms` : 'N/A'}</span></div>
                    </div>

                    {product.description && (
                      <div className="mt-8 pt-6 border-t border-slate-100">
                        <h3 className="text-xs font-black text-slate-400 mb-4 uppercase tracking-widest">About this item</h3>
                        <p className="text-sm text-slate-700 leading-loose whitespace-pre-line font-medium">{product.description}</p>
                      </div>
                    )}
                  </div>
                )}

                {activeInfoTab === 'shipping' && (
                  <div>
                    <h2 className="text-lg font-black text-slate-900 mb-5 flex items-center"><FiTruck className="mr-2.5 text-[#FF4500]" /> Shipping & Returns</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="flex flex-col items-start gap-2 p-5 bg-slate-50 rounded-2xl border border-slate-100">
                        <FiTruck size={22} className="text-indigo-500" />
                        <p className="text-sm font-bold text-slate-900">Free shipping</p>
                        <p className="text-xs text-slate-500 leading-relaxed">Orders are dispatched within 24–48 hours and delivered pan-India at no extra cost.</p>
                      </div>
                      <div className="flex flex-col items-start gap-2 p-5 bg-slate-50 rounded-2xl border border-slate-100">
                        <FiRotateCcw size={22} className="text-indigo-500" />
                        <p className="text-sm font-bold text-slate-900">7-day returns</p>
                        <p className="text-xs text-slate-500 leading-relaxed">Not the right fit? Start a return within 7 days of delivery for a full refund.</p>
                      </div>
                      <div className="flex flex-col items-start gap-2 p-5 bg-slate-50 rounded-2xl border border-slate-100">
                        <FiShield size={22} className="text-indigo-500" />
                        <p className="text-sm font-bold text-slate-900">1-year warranty</p>
                        <p className="text-xs text-slate-500 leading-relaxed">Covered against manufacturing defects for twelve months from purchase.</p>
                      </div>
                    </div>
                    {deliveryInfo && deliveryStatus === 'success' && (
                      <p className="text-xs font-semibold text-slate-500 mt-6">
                        Estimated delivery to <span className="text-slate-800 font-bold">{pincode}</span>: {deliveryInfo.estimatedDate}
                      </p>
                    )}
                  </div>
                )}

                {activeInfoTab === 'reviews' && (
                  <div>
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-lg font-black text-slate-900 flex items-center"><FiMessageCircle className="mr-2.5 text-indigo-500" /> Ratings & Reviews</h2>
                      <button onClick={() => setIsReviewModalOpen(true)} className="bg-slate-900 hover:bg-[#FF4500] text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors shadow-sm cursor-pointer">
                        Write Review
                      </button>
                    </div>

                    <div className="flex items-center gap-4 mb-8">
                      <div className="text-5xl font-black text-slate-900">{product.rating || "4.8"}</div>
                      <div>
                        <div className="flex text-yellow-400 mb-1"><FiStar fill="currentColor"/><FiStar fill="currentColor"/><FiStar fill="currentColor"/><FiStar fill="currentColor"/><FiStar fill="currentColor" className="text-slate-200"/></div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{product.reviews || productReviews.length} Buyers</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {productReviews.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-6 sm:col-span-2">No reviews yet. Be the first to review this product!</p>
                      ) : (
                        productReviews.map((rev) => (
                          <div key={rev._id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full flex justify-center items-center text-xs font-bold">{rev.userName?.charAt(0) || 'U'}</div>
                                <span className="text-xs font-bold text-slate-800">{rev.userName}</span>
                              </div>
                              {rev.isVerifiedPurchase && (
                                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                                  <FiCheckCircle size={10} /> Verified Buyer
                                </span>
                              )}
                            </div>
                            <div className="flex text-yellow-400 text-[10px] mb-1.5">
                              {[...Array(5)].map((_, i) => (
                                <FiStar key={i} fill={i < rev.rating ? "currentColor" : "none"} className={i >= rev.rating ? "text-slate-300" : ""} />
                              ))}
                            </div>
                            {rev.title && <p className="text-xs font-bold text-slate-900 mb-1">{rev.title}</p>}
                            <p className="text-xs text-slate-600 font-medium">{rev.comment}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {activeInfoTab === 'qna' && (
                  <div>
                    <h2 className="text-lg font-black text-slate-900 mb-6 flex items-center"><FiHelpCircle className="mr-2.5 text-[#FF4500]" /> Questions & Answers</h2>

                    <form onSubmit={handlePostQuestion} className="flex gap-3 mb-8">
                      <input type="text" placeholder="Have a question? Ask seller, support, or buyers..." value={newQuestionText} onChange={(e) => setNewQuestionText(e.target.value)} className="flex-1 border border-slate-200 rounded-xl p-3.5 text-sm font-medium outline-none focus:border-slate-900 transition-colors" />
                      <button type="submit" className="bg-slate-900 text-white font-bold px-6 py-3.5 rounded-xl hover:bg-[#FF4500] transition-colors cursor-pointer">Ask Question</button>
                    </form>

                    <div className="space-y-6">
                      {questionsList.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-4">No questions asked yet. Be the first to ask!</p>
                      ) : (
                        questionsList.map((q) => (
                          <div key={q._id} className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-3">
                            <div>
                              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Q: {q.question}</p>
                              <p className="text-[10px] text-slate-500 font-medium">Asked by {q.userName}</p>
                            </div>

                            <div className="space-y-2 pl-4 border-l-2 border-indigo-200">
                              {q.answers.map((ans, idx) => (
                                <div key={idx} className="bg-white p-3 rounded-xl border border-slate-100">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-bold text-slate-800">{ans.userName}</span>
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${ans.role === 'seller' ? 'bg-amber-100 text-amber-800' : ans.role === 'support' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-700'}`}>
                                      {ans.role}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-600 font-medium">{ans.answer}</p>
                                </div>
                              ))}
                            </div>

                            {replyingToQId === q._id ? (
                              <div className="flex gap-2 pt-2">
                                <input type="text" placeholder="Type your answer..." value={answerText} onChange={(e) => setAnswerText(e.target.value)} className="flex-1 border border-slate-200 rounded-xl p-2.5 text-xs outline-none bg-white" />
                                <button onClick={() => handlePostAnswer(q._id)} className="bg-indigo-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer">Send</button>
                                <button onClick={() => setReplyingToQId(null)} className="text-xs text-slate-500 px-2 font-bold cursor-pointer">Cancel</button>
                              </div>
                            ) : (
                              <button onClick={() => setReplyingToQId(q._id)} className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer">Answer this question</button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {isLoadingSimilar ? (
          <div className="mt-16 pt-12 border-t border-slate-200">
            <div className="h-8 w-64 bg-slate-100 rounded-lg animate-pulse mb-8" />
            <div className="flex gap-4 md:gap-6 overflow-hidden">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="shrink-0 w-[46%] sm:w-[30%] md:w-[23%] lg:w-[19%] h-64 bg-slate-100 rounded-3xl animate-pulse" />
              ))}
            </div>
          </div>
        ) : similarProducts.length > 0 && (
          <div className="mt-16 pt-12 border-t border-slate-200">
            <div className="flex items-end justify-between mb-8">
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">You Might Also Like</h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest hidden sm:block">Swipe to explore →</p>
            </div>
            <div className="flex gap-4 md:gap-6 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
              {similarProducts.map((p) => (
                <div key={p.id || p._id} className="snap-start shrink-0 w-[46%] sm:w-[30%] md:w-[23%] lg:w-[19%]">
                  <SimilarProductCard product={p} />
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      <AddReviewModal 
        isOpen={isReviewModalOpen} 
        onClose={() => setIsReviewModalOpen(false)} 
        productId={productIdSafeguard} 
        onReviewAdded={fetchProductReviews} 
      />

      <AnimatePresence>
        {showStickyBar && (
          <motion.div 
            initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-md border-t border-slate-200 p-3 px-4 z-40 md:hidden shadow-[0_-10px_20px_rgba(0,0,0,0.05)] flex items-center justify-between gap-3"
          >
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate">{product.title}</span>
              <span className="text-lg font-black text-slate-900 leading-none mt-0.5">{formatCurrency(productPricePaise)}</span>
            </div>
            {parseInt(product.inventory) === 0 ? (
              <button 
                onClick={() => {
                  window.scrollTo({ top: 400, behavior: 'smooth' });
                }} 
                className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-md active:scale-95 cursor-pointer flex-shrink-0"
              >
                Notify Me
              </button>
            ) : (
              <button 
                onClick={handleAddToCart} 
                className="bg-slate-900 hover:bg-[#FF4500] text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-md active:scale-95 cursor-pointer flex-shrink-0 transition-colors"
              >
                Add to Bag
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default ProductDetails;