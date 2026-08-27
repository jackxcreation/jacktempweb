import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom'; 
import { motion, AnimatePresence } from 'framer-motion';
import { FiStar, FiShoppingCart, FiZap, FiTruck, FiShield, FiRotateCcw, FiBox, FiMapPin, FiCheckCircle, FiHeart, FiShare2, FiEye, FiMessageCircle, FiXCircle, FiCheck, FiX, FiHelpCircle, FiBell } from 'react-icons/fi';
import Navbar from '../components/Navbar';
import { useCart } from '../context/CartContext';
import { useProducts } from '../context/ProductContext'; 
import { useUser } from '../context/UserContext'; 
import { useCompare } from '../context/CompareContext';
import { io } from 'socket.io-client';
import { getOptimizedImageUrl } from '../utils/imageOptimizer';
// 🔥 PHASE 1 FIX: Use canonical axiosInstance for ALL backend calls
import axiosInstance from '../api/axiosInstance'; 
import { ProductInternalGraph } from '../components/ProductInternalGraph';

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
      <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="bg-white rounded-3xl p-3 shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 group relative flex flex-col h-full overflow-hidden">
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-1.5">
          {(product.isTrending || product.views > 50) && <span className="bg-red-500 text-white text-[9px] font-black px-2.5 py-1 rounded-sm uppercase tracking-widest animate-pulse shadow-md shadow-red-500/30">🔥 Trending</span>}
          {product.discount && <span className="bg-[#FF4500] text-white text-[9px] font-black px-2.5 py-1 rounded-sm uppercase tracking-widest">{product.discount}</span>}
        </div>
        <div className="w-full h-40 bg-slate-50/50 rounded-2xl overflow-hidden mb-4 relative p-3 flex items-center justify-center">
          <img 
            src={getOptimizedImageUrl(product.image, 320)} 
            alt={product.title} 
            loading="lazy"
            className="max-w-full max-h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-500" 
          />
        </div>
        <div className="flex flex-col flex-grow px-1">
          <h3 className="text-sm font-bold text-slate-800 line-clamp-2 mb-3 leading-snug group-hover:text-[#FF4500] transition-colors">{product.title}</h3>
          <div className="mt-auto flex items-end justify-between">
            <span className="text-lg font-black text-slate-900 leading-none">{formatCurrency(productPricePaise)}</span>
            <div className="flex gap-1">
              <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); addToCompare(product); }} className="bg-slate-100 text-slate-700 hover:bg-slate-900 hover:text-white px-2.5 py-2 rounded-xl transition-colors text-[10px] font-bold">
                Comp
              </button>
              <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); addToCart(product); }} className="bg-slate-100 text-slate-900 hover:bg-[#FF4500] hover:text-white p-2 rounded-xl transition-colors">
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
    setLoading(true);
    try {
      // 🔥 PHASE 1 FIX: Removed `/api` prefix because axiosInstance already maps to /api
      const res = await axiosInstance.post('/stock-alerts/subscribe', { productId });
      if (res.data.success) {
        setSubscribed(true);
        alert(res.data.message);
      }
    } catch (err) {
      alert(err.response?.data?.message || "Please login to set back-in-stock alerts.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={handleNotify}
      disabled={loading || subscribed}
      className={`w-full py-4 rounded-2xl font-black text-sm md:text-lg flex justify-center items-center gap-2 transition-all shadow-md ${subscribed ? 'bg-emerald-600 text-white cursor-default' : 'bg-slate-900 hover:bg-[#FF4500] text-white active:scale-95'}`}
    >
      <FiBell size={20} />
      <span>{subscribed ? "YOU WILL BE NOTIFIED" : "NOTIFY ME WHEN AVAILABLE"}</span>
    </button>
  );
};

// ==========================================
// 📝 ADD REVIEW MODAL COMPONENT
// ==========================================
const AddReviewModal = ({ isOpen, onClose, productId, onReviewAdded }) => {
  const [rating, setRating] = useState(5);
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
      const res = await axiosInstance.post(`/products/${productId}/reviews`, {
        rating,
        title,
        comment
      });
      if (res.status === 201) {
        onReviewAdded();
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
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-[2rem] max-w-lg w-full p-6 shadow-2xl">
          <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
            <h3 className="text-xl font-black text-slate-900">Write a Review</h3>
            <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200"><FiX size={18}/></button>
          </div>

          {errorMsg && <p className="bg-red-50 text-red-600 text-xs font-bold p-3 rounded-xl mb-4 border border-red-100">{errorMsg}</p>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Rating</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button type="button" key={star} onClick={() => setRating(star)} className={`text-2xl ${rating >= star ? 'text-yellow-400' : 'text-slate-300'}`}>★</button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Review Title</label>
              <input type="text" placeholder="e.g., Excellent product!" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none focus:border-slate-900" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Detailed Review</label>
              <textarea rows="4" placeholder="Write your experience..." value={comment} onChange={(e) => setComment(e.target.value)} required className="w-full border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none focus:border-slate-900 resize-none"></textarea>
            </div>

            <button type="submit" disabled={submitting} className="w-full bg-slate-900 hover:bg-[#FF4500] text-white font-black py-3.5 rounded-xl transition-all shadow-md active:scale-95 disabled:bg-slate-300">
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

  const product = products.find(p => String(p.id) === String(id) || String(p._id) === String(id));
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

  // 🔥 PHASE 1 FIX: Extracted WebSocket URL logically
  const socketURL = import.meta.env.VITE_API_URL 
      ? import.meta.env.VITE_API_URL.replace(/\/api$/, '') 
      : 'https://ecom-project-lwt4.onrender.com';

  const fetchProductReviews = () => {
    if (!productIdSafeguard) return;
    axiosInstance.get(`/products/${productIdSafeguard}/reviews`)
      .then(res => setProductReviews(res.data))
      .catch(err => console.log("Failed to load reviews"));
  };

  const fetchQuestions = () => {
    if (!productIdSafeguard) return;
    axiosInstance.get(`/products/${productIdSafeguard}/questions`)
      .then(res => setQuestionsList(res.data))
      .catch(err => console.log("Failed to load questions"));
  };

  useEffect(() => {
    window.scrollTo(0, 0);

    if (hasFetchedAPIs.current === productIdSafeguard) return;

    if (product && productIdSafeguard) {
      hasFetchedAPIs.current = productIdSafeguard; 

      addRecentlyViewed(product);
      setMainImage((product.images && product.images.length > 0) ? product.images[0] : product.image);
      
      const currentTitle = `${product.title} | Jack Essentials`;
      const currentDesc = product.description ? product.description.substring(0, 160) : `Buy ${product.title} at best price on Jack Essentials. Free delivery & secure payments.`;
      
      document.title = currentTitle;

      let metaDesc = document.querySelector("meta[name='description']");
      if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.name = 'description';
        document.head.appendChild(metaDesc);
      }
      metaDesc.content = currentDesc;

      let canonicalLink = document.querySelector("link[rel='canonical']");
      if (!canonicalLink) {
        canonicalLink = document.createElement('link');
        canonicalLink.rel = 'canonical';
        document.head.appendChild(canonicalLink);
      }
      canonicalLink.href = window.location.href;

      const productPriceNum = product.pricePaise ? product.pricePaise / 100 : (product.price || 0);
      const skuCode = product.sku || `JCK-${String(productIdSafeguard).slice(-6).toUpperCase()}`;

      const jsonLdData = {
        "@context": "https://schema.org/",
        "@type": "Product",
        "name": product.title,
        "image": product.images || [product.image],
        "description": currentDesc,
        "sku": skuCode,
        "brand": {
          "@type": "Brand",
          "name": product.brand || "Jack Essentials"
        },
        "offers": {
          "@type": "Offer",
          "url": window.location.href,
          "priceCurrency": "INR",
          "price": productPriceNum,
          "priceValidUntil": "2027-12-31",
          "itemCondition": "https://schema.org/NewCondition",
          "availability": parseInt(product.inventory) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          "seller": {
            "@type": "Organization",
            "name": "Jack Essentials"
          }
        },
        "aggregateRating": {
          "@type": "AggregateRating",
          "ratingValue": product.rating || "4.8",
          "reviewCount": product.reviews || "124"
        }
      };

      let scriptTag = document.querySelector("#product-jsonld-schema");
      if (!scriptTag) {
        scriptTag = document.createElement('script');
        scriptTag.id = "product-jsonld-schema";
        scriptTag.type = 'application/ld+json';
        document.head.appendChild(scriptTag);
      }
      scriptTag.text = JSON.stringify(jsonLdData);

      axiosInstance.get(`/products/${productIdSafeguard}`).catch(err => console.log("View tracking failed"));

      fetchProductReviews();
      fetchQuestions();

      axiosInstance.get(`/products/similar/${productIdSafeguard}`)
        .then(res => {
          setSimilarProducts(res.data);
          setIsLoadingSimilar(false);
        })
        .catch(err => {
          console.error("Similar fetch error:", err);
          setIsLoadingSimilar(false);
        });
    }

    return () => {
      const scriptTag = document.querySelector("#product-jsonld-schema");
      if (scriptTag) scriptTag.remove();
    };
  }, [productIdSafeguard, product, addRecentlyViewed]); 

  // 🔥 FIX: Added strictly token check for sockets
  useEffect(() => {
    let socket;
    const token = localStorage.getItem('token');
    
    if (productIdSafeguard && token) {
      socket = io(socketURL, { 
        withCredentials: true,
        auth: { token }
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

  // 🔥 FIX: Added strictly token check for visitor socket
  useEffect(() => {
    let socketVisitor;
    const token = localStorage.getItem('token');

    if (productIdSafeguard && token) {
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
      // 🔥 PHASE 1 FIX: Using axiosInstance instead of fetch
      const res = await axiosInstance.get(`/delivery-check?pincode=${pinCodeToCheck}`);
      const data = res.data;
      
      pincodeCache.current[pinCodeToCheck] = data;
      
      if (data.success && data.isServiceable) {
        setDeliveryInfo(data);
        setDeliveryStatus('success');
        setIsEditingPincode(false); 
      } else {
        setDeliveryInfo(data);
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
      await axiosInstance.post(`/products/${productIdSafeguard}/questions`, { question: newQuestionText });
      setNewQuestionText('');
      fetchQuestions();
    } catch (err) {
      alert("Please login to ask a question.");
    }
  };

  const handlePostAnswer = async (qId) => {
    if (!answerText.trim()) return;
    try {
      await axiosInstance.post(`/questions/${qId}/answers`, { answer: answerText });
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
        <button onClick={() => navigate('/shop')} className="bg-slate-900 hover:bg-[#FF4500] text-white px-10 py-4 rounded-xl font-black transition-all shadow-lg active:scale-95">RETURN TO SHOP</button>
      </div>
    );
  }

  const productPricePaise = product.pricePaise || (product.price ? product.price * 100 : 0);
  const productMrpPaise = product.mrpPaise || (product.mrp ? product.mrp * 100 : 0);
  const productImages = (product.images && product.images.length > 0) ? product.images : [product.image];

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-24 md:pb-20 relative">
      <Navbar isLoggedIn={isLoggedIn} setIsLoggedIn={setIsLoggedIn} />

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
                  <button 
                    key={idx} 
                    onClick={() => setMainImage(img)}
                    className={`w-16 h-16 md:w-20 md:h-20 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 bg-slate-50 ${mainImage === img ? 'border-slate-900 ring-2 ring-slate-900/10' : 'border-transparent hover:border-slate-300'}`}
                  >
                    <img 
                      src={getOptimizedImageUrl(img, 100)} 
                      alt={`thumbnail-${idx}`} 
                      loading="lazy"
                      className="w-full h-full object-contain mix-blend-multiply p-1" 
                    />
                  </button>
                ))}
              </div>
            )}

            <div className="w-full flex-1 bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl overflow-hidden flex items-center justify-center p-6 md:p-10 relative group border border-slate-100 aspect-square md:aspect-auto">
              
              <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                {(product.isTrending || product.views > 50) && <span className="bg-red-500 text-white text-[10px] font-black px-3 py-1.5 rounded uppercase tracking-widest shadow-sm animate-pulse">🔥 Trending</span>}
                {product.discount && <span className="bg-[#FF4500] text-white text-[10px] font-black px-3 py-1.5 rounded uppercase tracking-widest shadow-sm">{product.discount}</span>}
                {product.badge && <span className="bg-slate-900 text-white text-[10px] font-black px-3 py-1.5 rounded uppercase tracking-widest shadow-sm">{product.badge}</span>}
              </div>

              <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
                <button className="bg-white/80 backdrop-blur-md p-3 rounded-full shadow-sm text-slate-500 hover:text-red-500 hover:bg-white transition-all"><FiHeart size={20} /></button>
                <button className="bg-white/80 backdrop-blur-md p-3 rounded-full shadow-sm text-slate-500 hover:text-indigo-600 hover:bg-white transition-all"><FiShare2 size={20} /></button>
              </div>

              <AnimatePresence mode="wait">
                {mainImage ? (
                  <motion.img 
                    key={mainImage}
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
                    src={getOptimizedImageUrl(mainImage, 800)} 
                    alt={product.title} 
                    className="w-full h-full object-contain mix-blend-multiply group-hover:scale-110 transition-transform duration-700 ease-out"
                  />
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
              <span className="text-indigo-600 hover:underline cursor-pointer text-sm font-bold">Read {product.reviews || "124"} Reviews</span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-500 text-sm font-medium">SKU: {product.sku || `JCK-${String(productIdSafeguard).slice(-6).toUpperCase()}`}</span>
            </div>

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
              
              {deliveryStatus === 'success' && deliveryInfo && !isEditingPincode ? (
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
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
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-4 py-2 rounded-lg transition-colors w-max"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div>
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
                      className="bg-slate-900 disabled:bg-slate-300 text-white font-black text-sm px-8 py-3.5 rounded-xl hover:bg-slate-800 transition-colors shadow-md"
                    >
                      {deliveryStatus === 'checking' ? '...' : 'CHECK'}
                    </button>
                  </div>
                  
                  {deliveryStatus === 'error' && (
                    <p className={`text-xs mt-4 font-bold flex items-center p-3 rounded-xl border ${deliveryInfo?.message?.includes('fast') ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-red-500 bg-red-50 border-red-100'}`}>
                      <FiXCircle className="mr-2" size={16}/> 
                      {deliveryInfo?.message || "Invalid pincode or unserviceable area."}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* 🔥 CONDITIONAL RENDER: NOTIFY ME WHEN AVAILABLE OR BUY BUTTONS */}
            {parseInt(product.inventory) === 0 ? (
              <div className="mt-auto">
                <NotifyMeButton productId={productIdSafeguard} />
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4 mt-auto">
                <button 
                  onClick={() => addToCart(product)} 
                  className="flex-1 bg-white border-2 border-slate-900 text-slate-900 hover:bg-slate-900 hover:text-white py-4 px-2 rounded-2xl font-black text-sm md:text-lg flex justify-center items-center gap-2 active:scale-95 transition-all"
                >
                  <FiShoppingCart size={20} /><span>ADD TO BAG</span>
                </button>
                <button 
                  onClick={() => addToCompare(product)} 
                  className="bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-900 py-4 px-6 rounded-2xl font-black text-sm md:text-lg flex justify-center items-center gap-2 transition-all active:scale-95"
                >
                  Compare
                </button>
                <button 
                  onClick={() => { addToCart(product); navigate('/checkout'); }} 
                  className="flex-1 bg-gradient-to-r from-[#FF4500] to-orange-600 hover:from-[#E8004C] hover:to-red-600 text-white py-4 px-2 rounded-2xl font-black text-sm md:text-lg flex justify-center items-center gap-2 shadow-[0_10px_20px_-10px_rgba(255,69,0,0.6)] active:scale-95 transition-all"
                >
                  <FiZap size={20} className="animate-pulse" /><span>BUY IT NOW</span>
                </button>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-100 p-6 md:p-10">
            <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center border-b border-slate-100 pb-4"><FiBox className="mr-3 text-[#FF4500]" /> Product Specifications</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0 text-sm">
              <div className="flex justify-between border-b border-slate-50 py-4"><span className="text-slate-500 font-medium">Brand</span><span className="font-bold text-slate-900 text-right">{product.brand || 'Generic'}</span></div>
              <div className="flex justify-between border-b border-slate-50 py-4"><span className="text-slate-500 font-medium">Color</span><span className="font-bold text-slate-900 text-right">{product.color || 'Standard'}</span></div>
              <div className="flex justify-between border-b border-slate-50 py-4"><span className="text-slate-500 font-medium">Size</span><span className="font-bold text-slate-900 text-right">{product.size || 'Free Size'}</span></div>
              <div className="flex justify-between border-b border-slate-50 py-4"><span className="text-slate-500 font-medium">Weight</span><span className="font-bold text-slate-900 text-right">{product.weight ? `${product.weight} gms` : 'N/A'}</span></div>
            </div>
            
            {product.description && (
              <div className="mt-8 pt-6 border-t border-slate-100">
                <h3 className="text-xs font-black text-slate-400 mb-4 uppercase tracking-widest">About this item</h3>
                <p className="text-sm text-slate-700 leading-loose whitespace-pre-line font-medium">{product.description}</p>
              </div>
            )}
          </div>

          {/* 🔥 REAL VERIFIED PURCHASE REVIEWS SECTION */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 md:p-8 flex flex-col">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
              <h2 className="text-lg font-black text-slate-900 flex items-center"><FiMessageCircle className="mr-2 text-indigo-500" /> Ratings & Reviews</h2>
              <button onClick={() => setIsReviewModalOpen(true)} className="bg-slate-900 hover:bg-[#FF4500] text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors shadow-sm">
                Write Review
              </button>
            </div>
            
            <div className="flex items-center gap-4 mb-6">
              <div className="text-5xl font-black text-slate-900">{product.rating || "4.8"}</div>
              <div>
                <div className="flex text-yellow-400 mb-1"><FiStar fill="currentColor"/><FiStar fill="currentColor"/><FiStar fill="currentColor"/><FiStar fill="currentColor"/><FiStar fill="currentColor" className="text-slate-200"/></div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{product.reviews || productReviews.length} Buyers</p>
              </div>
            </div>
            
            <div className="space-y-4 flex-1 overflow-y-auto max-h-[350px]">
              {productReviews.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">No reviews yet. Be the first to review this product!</p>
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

        </div>

        {/* 🔥 REAL-TIME Q&A SECTION 🔥 */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 md:p-10 mb-12">
          <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center"><FiHelpCircle className="mr-2 text-[#FF4500]" /> Questions & Answers</h2>
          
          <form onSubmit={handlePostQuestion} className="flex gap-3 mb-8">
            <input type="text" placeholder="Have a question? Ask seller, support, or buyers..." value={newQuestionText} onChange={(e) => setNewQuestionText(e.target.value)} className="flex-1 border border-slate-200 rounded-xl p-3.5 text-sm font-medium outline-none focus:border-slate-900" />
            <button type="submit" className="bg-slate-900 text-white font-bold px-6 py-3.5 rounded-xl hover:bg-[#FF4500] transition-colors">Ask Question</button>
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
                      <button onClick={() => handlePostAnswer(q._id)} className="bg-indigo-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl">Send</button>
                      <button onClick={() => setReplyingToQId(null)} className="text-xs text-slate-500 px-2 font-bold">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setReplyingToQId(q._id)} className="text-xs font-bold text-indigo-600 hover:underline">Answer this question</button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {similarProducts.length > 0 && (
          <div className="mt-16 pt-12 border-t border-slate-200">
            <h2 className="text-3xl font-black text-slate-900 mb-8 tracking-tight">You Might Also Like</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
              {similarProducts.map((p) => (
                <SimilarProductCard key={p.id || p._id} product={p} />
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
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest line-clamp-1">{product.title}</span>
              <span className="text-lg font-black text-slate-900 leading-none mt-0.5">{formatCurrency(productPricePaise)}</span>
            </div>
            {parseInt(product.inventory) === 0 ? (
              <button 
                onClick={() => {}} 
                className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-md active:scale-95"
              >
                Notify Me
              </button>
            ) : (
              <button 
                onClick={() => addToCart(product)} 
                className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-md active:scale-95"
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