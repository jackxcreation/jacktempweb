import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiCheckCircle, FiCreditCard, FiSmartphone, FiShield, 
  FiMapPin, FiTruck, FiLock, FiChevronRight, FiLoader, FiCheck, FiInfo, FiAlertCircle
} from 'react-icons/fi';
import Navbar from '../components/Navbar';
import { useCart } from '../context/CartContext';
import { useUser } from '../context/UserContext';
import { API_URL } from '../config'; 
import { getOptimizedImageUrl } from '../utils/imageOptimizer';
import axiosInstance from '../api/axiosInstance'; 

// 🔥 CANONICAL CURRENCY FORMATTER UTILITY
const formatCurrency = (paise) => {
  if (typeof paise !== 'number') return '₹0.00';
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// 🔥 HELPER TO GET TOKEN
const getToken = () => localStorage.getItem('token');

// --- Reusable Components for Performance & Cleanliness ---

// Memoized Image Component with Fallback
const SummaryItemImage = memo(({ src, alt }) => {
  const [imgError, setImgError] = useState(false);
  const fallbackSvg = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%23cbd5e1' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><rect x='3' y='3' width='18' height='18' rx='2' ry='2'/><circle cx='8.5' cy='8.5' r='1.5'/><polyline points='21 15 16 10 5 21'/></svg>";

  return (
    <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center p-1.5 border border-slate-100 shadow-sm flex-shrink-0 relative overflow-hidden select-none">
      <img 
        src={imgError ? fallbackSvg : getOptimizedImageUrl(src, 120)} 
        alt={alt || "Product Image"} 
        loading="lazy"
        decoding="async"
        onError={() => setImgError(true)}
        className="max-w-full max-h-full object-contain mix-blend-multiply transition-transform duration-300 hover:scale-105" 
      />
    </div>
  );
});
SummaryItemImage.displayName = 'SummaryItemImage';


// --- Main Checkout Page Component ---

const Checkout = ({ isLoggedIn, setIsLoggedIn }) => {
  const { cart, clearCart, cartTotalPaise } = useCart();
  const navigate = useNavigate();
  const location = useLocation(); 
  const { user, placeOrder } = useUser();

  const [step, setStep] = useState(1); 
  const [paymentMethod, setPaymentMethod] = useState('online'); 
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [isAddingNew, setIsAddingNew] = useState(true);

  const [showCodAlert, setShowCodAlert] = useState(false); 
  const [isProcessing, setIsProcessing] = useState(false); 

  // 🔥 PHASE 2 FIX: codFeePaise default set to 0 to respect backend authority
  const [codIntelligence, setCodIntelligence] = useState({
    codAvailable: true,
    codFeePaise: 0, 
    riskLevel: 'LOW',
    reason: ''
  });
  
  const STORE_NAME = "Jack Essentials";
  
  // 🔥 ALIGNED WITH BACKEND ZOD SCHEMA: using primaryPhone instead of phone
  const [newAddress, setNewAddress] = useState({
    name: user?.name || '', primaryPhone: user?.phone || '', flat: '', street: '', city: '', state: '', pincode: ''
  });

  useEffect(() => {
    if (!user) {
      navigate('/login', { state: { from: location.pathname } });
    }
  }, [user, navigate, location]);

  useEffect(() => {
    if (user?.addresses && user.addresses.length > 0) {
      // 🔥 SAFETY FIX: Ensure primaryPhone is populated even on saved addresses
      const defaultAddr = {
        ...user.addresses[0],
        primaryPhone: user.addresses[0].primaryPhone || user.addresses[0].phone || user?.phone || '9999999999'
      };
      setSelectedAddress(defaultAddr);
      setIsAddingNew(false);
      if (defaultAddr.pincode) {
        checkCodIntelligence(defaultAddr.pincode);
      }
    } else {
      setIsAddingNew(true);
    }
  }, [user]);

  // 🔥 CHECK COD INTELLIGENCE VIA BACKEND API
  const checkCodIntelligence = async (pincode) => {
    if (!pincode || pincode.length !== 6) return;
    try {
      const res = await axiosInstance.get(`/delivery-check?pincode=${pincode}&cartTotal=${cartTotalPaise}&userId=${user?._id || ''}`, {
        timeout: 10000, 
        headers: { Authorization: `Bearer ${getToken()}` } 
      });
      if (res.data && res.data.success) {
        setCodIntelligence({
          codAvailable: res.data.codAvailable,
          codFeePaise: res.data.codFeePaise || 0,
          riskLevel: res.data.riskLevel || 'LOW',
          reason: res.data.message || ''
        });
      }
    } catch (err) {
      console.error("COD Intelligence Check Failed:", err);
    }
  };

  // Memoized Order Calculations (Working purely with Paise integers)
  const { cartTotalPaiseMetric, discountPaise, appliedCodFeePaise, finalTotalPaise } = useMemo(() => {
    const totalPaise = Number(cartTotalPaise) || 0;
    
    const calculatedDiscountPaise = Math.round(totalPaise * 0.10);
    const calculatedCodFeePaise = paymentMethod === 'cod' ? (codIntelligence.codFeePaise) : 0;
    const calculatedFinalTotalPaise = Math.max(totalPaise - calculatedDiscountPaise + calculatedCodFeePaise, 0);

    return {
      cartTotalPaiseMetric: totalPaise,
      discountPaise: calculatedDiscountPaise,
      appliedCodFeePaise: calculatedCodFeePaise,
      finalTotalPaise: calculatedFinalTotalPaise
    };
  }, [cartTotalPaise, paymentMethod, codIntelligence.codFeePaise]);

  const formattedDeliveryDate = useMemo(() => {
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + 4);
    return deliveryDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
  }, []);

  useEffect(() => {
    if (cart.length === 0 && step !== 3) navigate('/cart');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [cart, navigate, step]);

  const handlePincodeChange = useCallback(async (e) => {
    const pin = e.target.value.replace(/[^0-9]/g, ''); 
    setNewAddress(prev => ({ ...prev, pincode: pin }));

    if (pin.length === 6) {
      checkCodIntelligence(pin);
      try {
        const res = await axiosInstance.get(`/pincode-info/${pin}`, {
          timeout: 10000, 
          headers: { Authorization: `Bearer ${getToken()}` } 
        });
        if (res.data && res.data.success && res.data.data) {
          const postalDetails = res.data.data;
          setNewAddress(prev => ({ 
            ...prev, 
            pincode: pin, 
            city: postalDetails.district || postalDetails.city, 
            state: postalDetails.state 
          }));
        }
      } catch (error) { 
        console.error("Pincode API failed", error); 
      }
    }
  }, [cartTotalPaise, user]);

  const handleAddressSubmit = useCallback((e) => {
    e.preventDefault();
    // 🔥 Ensure primaryPhone is strictly included in new address submission
    const formattedNewAddr = {
      ...newAddress,
      primaryPhone: newAddress.primaryPhone || user?.phone || '9999999999'
    };
    setSelectedAddress(formattedNewAddr); 
    checkCodIntelligence(formattedNewAddr.pincode);
    setStep(2); 
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [newAddress, user, cartTotalPaise]);

  const handlePaymentChange = useCallback((method) => {
    if (method === 'cod') {
      if (!codIntelligence.codAvailable) {
        alert(codIntelligence.reason || "Cash on Delivery is unavailable for this location or order value.");
        return;
      }
      setShowCodAlert(true);
    }
    setPaymentMethod(method);
  }, [codIntelligence]);

  // RAZORPAY SCRIPT LOADER
  const loadRazorpayScript = useCallback(() => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }, []);

  // FINAL ORDER SUBMISSION 
  const handleFinalOrderSubmission = useCallback(async (finalPaymentMethod, gatewayOrderId) => {
    setIsProcessing(true);
    const savedTraffic = localStorage.getItem('jack_traffic_source');
    const trafficSource = savedTraffic ? JSON.parse(savedTraffic) : { source: 'Direct/Unknown', medium: 'organic', campaign: 'none' };

    try {
      if (user) {
        const orderItems = cart.map((item) => ({
          productId: item.id || item._id,
          quantity: Number(item.quantity),
        }));

        // 🔥 Final safety check on selectedAddress to guarantee primaryPhone exists
        const safeAddress = {
          name: selectedAddress?.name || user?.name || 'Customer',
          flat: selectedAddress?.flat || 'N/A',
          street: selectedAddress?.street || 'N/A',
          city: selectedAddress?.city || 'N/A',
          state: selectedAddress?.state || 'N/A',
          pincode: selectedAddress?.pincode || '110001',
          primaryPhone: selectedAddress?.primaryPhone || selectedAddress?.phone || user?.phone || '9999999999'
        };

        const orderResult = await placeOrder(orderItems, finalTotalPaise, safeAddress, finalPaymentMethod, trafficSource);
        
        if (orderResult && orderResult.error) {
            alert("Order failed to save: " + orderResult.error);
            setIsProcessing(false);
            return; 
        }

        const createdOrderId = orderResult.order?._id || orderResult.order?.id;

        localStorage.removeItem('jack_traffic_source');
        setStep(3); 
        clearCart();
        setIsProcessing(false);

        setTimeout(() => {
          if (createdOrderId) {
            navigate(`/order/${createdOrderId}`); 
          } else {
            navigate('/profile'); 
          }
        }, 2000); 
      }

    } catch (err) {
      console.error("Order Submission Crash:", err);
      alert("Something went wrong. Please check your internet or try again.");
      setIsProcessing(false);
    }
  }, [user, cart, finalTotalPaise, selectedAddress, placeOrder, clearCart, navigate]);

  // RAZORPAY PAYMENT INITIATION 
  const initiateRazorpayPayment = useCallback(async () => {
    setIsProcessing(true);
    const isLoaded = await loadRazorpayScript();
    
    if (!isLoaded) { 
      alert("Razorpay SDK failed to load. Are you online?"); 
      setIsProcessing(false); 
      return; 
    }

    try {
      const savedTraffic = localStorage.getItem('jack_traffic_source');
      const trafficSource = savedTraffic ? JSON.parse(savedTraffic) : { source: 'Direct/Unknown', medium: 'organic', campaign: 'none' };

      const orderItems = cart.map((item) => ({
        productId: item.id || item._id,
        quantity: Number(item.quantity),
      }));

      // 🔥 Final safety check on selectedAddress to guarantee primaryPhone exists
      const safeAddress = {
        name: selectedAddress?.name || user?.name || 'Customer',
        flat: selectedAddress?.flat || 'N/A',
        street: selectedAddress?.street || 'N/A',
        city: selectedAddress?.city || 'N/A',
        state: selectedAddress?.state || 'N/A',
        pincode: selectedAddress?.pincode || '110001',
        primaryPhone: selectedAddress?.primaryPhone || selectedAddress?.phone || user?.phone || '9999999999'
      };

      const orderResult = await placeOrder(orderItems, finalTotalPaise, safeAddress, 'Razorpay Online', trafficSource);
      
      if (!orderResult || orderResult.error) {
          alert("Failed to generate secure order ID: " + (orderResult?.error || "Invalid Payload"));
          setIsProcessing(false);
          return;
      }

      const pendingOrderId = orderResult.order?._id || orderResult.order?.id;

      if (!pendingOrderId) {
        alert("Failed to extract order ID from server.");
        setIsProcessing(false);
        return;
      }

      const res = await axiosInstance.post('/payment/create-order', {
        orderId: pendingOrderId 
      }, {
        timeout: 15000, 
        headers: { Authorization: `Bearer ${getToken()}` } 
      });

      const orderData = res.data;

      if (!orderData.success || !orderData.order_id) {
        alert("Backend Error: " + (orderData.error || "Could not create Razorpay Order."));
        setIsProcessing(false);
        return;
      }

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_Sx5dYj7qO20PEX",
        amount: orderData.amount, 
        currency: orderData.currency,
        name: STORE_NAME,
        description: "Order Payment",
        order_id: orderData.order_id,
        handler: async function (response) {
          try {
            setIsProcessing(true);
            
            const verifyRes = await axiosInstance.post('/payment/verify', {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature
            }, {
              timeout: 15000,
              headers: { Authorization: `Bearer ${getToken()}` } 
            });
            
            const verifyData = verifyRes.data;
            
            if (verifyData.success) {
              localStorage.removeItem('jack_traffic_source');
              setStep(3); 
              clearCart();
              setIsProcessing(false);

              setTimeout(() => {
                navigate(`/order/${pendingOrderId}`); 
              }, 2000);
            } else {
              alert("Payment verification failed! If money was deducted, it will be refunded.");
              setIsProcessing(false);
            }
          } catch (error) {
            console.error("Verification error:", error);
            alert("Error verifying payment.");
            setIsProcessing(false);
          }
        },
        prefill: {
          name: user?.name || newAddress.name || "Guest",
          email: user?.email || "guest@jackessentials.com",
          contact: user?.phone || newAddress.primaryPhone || "9999999999"
        },
        theme: { color: "#FF4500" },
        modal: { ondismiss: function () { setIsProcessing(false); } }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response) {
        alert("Payment Failed: " + response.error.description);
        setIsProcessing(false);
      });
      rzp.open();

    } catch (error) {
      console.error("Payment Error:", error);
      alert(`Server connection issue: ${error.response?.data?.message || error.message}`);
      setIsProcessing(false);
    }
  }, [cart, finalTotalPaise, selectedAddress, user, clearCart, navigate, loadRazorpayScript, placeOrder]);

  const handlePreCheckout = useCallback((e) => {
    e.preventDefault();
    if (!selectedAddress && !isAddingNew) return alert("Please select or add a delivery address first!");

    if (paymentMethod === 'online') {
      initiateRazorpayPayment(); 
    } else if (paymentMethod === 'cod') {
      if (!codIntelligence.codAvailable) {
        alert(codIntelligence.reason || "Cash on Delivery is unavailable for this location.");
        return;
      }
      handleFinalOrderSubmission('Cash on Delivery', `COD_${Date.now()}`); 
    }
  }, [selectedAddress, isAddingNew, paymentMethod, codIntelligence, initiateRazorpayPayment, handleFinalOrderSubmission]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-sans pb-24 relative selection:bg-[#FF4500] selection:text-white">
      <Navbar isLoggedIn={isLoggedIn} setIsLoggedIn={setIsLoggedIn} />

      {/* COD Alert Modal */}
      <AnimatePresence>
        {showCodAlert && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
            className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} 
              className="bg-white rounded-[2rem] w-full max-w-md p-8 relative shadow-2xl text-center border border-slate-100"
            >
              <div className="w-16 h-16 bg-slate-50 text-slate-800 rounded-full flex items-center justify-center mx-auto mb-5 ring-8 ring-slate-50/50">
                <FiTruck size={28} />
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">Premium Delivery Service</h2>
              <p className="text-slate-500 text-sm mb-8 leading-relaxed px-2 font-medium">
                To ensure a secure and expedited doorstep experience, a nominal handling fee of <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">{formatCurrency(codIntelligence.codFeePaise)}</span> is applied to all Cash on Delivery orders.
              </p>
              <button 
                onClick={() => setShowCodAlert(false)} 
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 rounded-xl shadow-lg shadow-slate-900/20 active:scale-[0.98] transition-all tracking-wide outline-none focus-visible:ring-4 focus-visible:ring-slate-300"
              >
                ACCEPT & CONTINUE
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        
        {/* Progress Stepper */}
        {step !== 3 && (
          <div className="flex items-center justify-center mb-10 max-w-2xl mx-auto px-4">
            <div className={`flex items-center transition-colors duration-300 ${step >= 1 ? 'text-[#FF4500]' : 'text-slate-400'}`}>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shadow-sm transition-all duration-300 ${step >= 1 ? 'bg-[#FF4500] text-white ring-4 ring-[#FF4500]/20' : 'bg-slate-200 text-slate-500'}`}>
                {step > 1 ? <FiCheckCircle size={18} /> : '1'}
              </div>
              <span className="ml-3 font-bold text-sm hidden sm:block tracking-wide">Address</span>
            </div>
            <div className={`flex-1 h-1 mx-4 sm:mx-6 rounded-full transition-colors duration-500 ${step >= 2 ? 'bg-[#FF4500]' : 'bg-slate-200'}`}></div>
            <div className={`flex items-center transition-colors duration-300 ${step >= 2 ? 'text-[#FF4500]' : 'text-slate-400'}`}>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shadow-sm transition-all duration-300 ${step >= 2 ? 'bg-[#FF4500] text-white ring-4 ring-[#FF4500]/20' : 'bg-slate-200 text-slate-500'}`}>
                {step > 2 ? <FiCheckCircle size={18} /> : '2'}
              </div>
              <span className="ml-3 font-bold text-sm hidden sm:block tracking-wide">Payment</span>
            </div>
            <div className={`flex-1 h-1 mx-4 sm:mx-6 rounded-full transition-colors duration-500 ${step === 3 ? 'bg-[#FF4500]' : 'bg-slate-200'}`}></div>
            <div className={`flex items-center transition-colors duration-300 ${step === 3 ? 'text-[#FF4500]' : 'text-slate-400'}`}>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shadow-sm transition-all duration-300 ${step === 3 ? 'bg-[#FF4500] text-white ring-4 ring-[#FF4500]/20' : 'bg-slate-200 text-slate-500'}`}>3</div>
              <span className="ml-3 font-bold text-sm hidden sm:block tracking-wide">Complete</span>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {step !== 3 ? (
            <motion.div 
              key="checkout-form" 
              initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.4, ease: "easeOut" }} 
              className="flex flex-col lg:flex-row gap-8 items-start"
            >
              
              {/* LEFT COLUMN: STEPS */}
              <div className="w-full lg:w-[65%] space-y-6">
                
                {/* STEP 1: ADDRESS */}
                <div className={`bg-white rounded-3xl shadow-sm border transition-all duration-300 ${step === 1 ? 'border-slate-200 shadow-md ring-4 ring-slate-50' : 'border-slate-100/60 opacity-80 hover:opacity-100'} overflow-hidden`}>
                  <div 
                    className={`p-6 sm:p-8 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between transition-colors ${step === 2 ? 'cursor-pointer hover:bg-slate-50' : ''}`} 
                    onClick={() => { if(step === 2) setStep(1) }}
                  >
                    <h2 className="text-xl font-black text-slate-900 flex items-center tracking-tight">
                      <div className="w-8 h-8 rounded-full bg-[#FF4500]/10 text-[#FF4500] flex items-center justify-center mr-3">
                        <FiMapPin size={16} />
                      </div>
                      Delivery Address
                    </h2>
                    {step === 2 && <span className="text-[#FF4500] font-bold text-sm bg-[#FF4500]/10 px-3 py-1 rounded-full">Change</span>}
                  </div>

                  <AnimatePresence>
                    {step === 1 && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} 
                        className="p-6 sm:p-8"
                      >
                        {user?.addresses && user.addresses.length > 0 && !isAddingNew ? (
                          <div className="space-y-4">
                            {user.addresses.map((addr, idx) => (
                              <label key={addr.id || addr._id || idx}
                                className={`flex items-start p-5 border-2 rounded-2xl cursor-pointer transition-all duration-200 ${
                                  selectedAddress?.id === addr.id ? 'border-[#FF4500] bg-[#FF4500]/5 shadow-sm' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                }`}
                              >
                                <div className="relative flex items-center justify-center mt-0.5">
                                  <input 
                                    type="radio" 
                                    name="address" 
                                    checked={selectedAddress?.id === addr.id} 
                                    onChange={() => {
                                      const formattedAddr = {
                                        ...addr,
                                        primaryPhone: addr.primaryPhone || addr.phone || user?.phone || '9999999999'
                                      };
                                      setSelectedAddress(formattedAddr);
                                      if (addr.pincode) checkCodIntelligence(addr.pincode);
                                    }} 
                                    className="peer sr-only" 
                                  />
                                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${selectedAddress?.id === addr.id ? 'border-[#FF4500] bg-[#FF4500]' : 'border-slate-300'}`}>
                                    {selectedAddress?.id === addr.id && <FiCheck size={12} className="text-white" />}
                                  </div>
                                </div>
                                <div className="ml-4 flex-1">
                                  <span className="bg-slate-900 text-white text-[9px] font-black px-2 py-1 rounded mb-2 inline-block tracking-widest uppercase">Saved Address</span>
                                  <p className="font-bold text-slate-900 text-base mt-1 leading-snug">{addr.flat}, {addr.street}</p>
                                  <p className="text-slate-500 text-sm font-medium mt-1">{addr.city}, {addr.state} - <span className="font-bold text-slate-800">{addr.pincode}</span></p>
                                </div>
                              </label>
                            ))}
                            
                            <div className="flex flex-col sm:flex-row gap-4 mt-8 pt-6 border-t border-slate-100">
                              <button 
                                onClick={() => { setStep(2); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                                disabled={!selectedAddress} 
                                className="flex-1 bg-[#FF4500] hover:bg-[#E8004C] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black py-4 rounded-xl transition-all shadow-lg shadow-orange-500/20 active:scale-[0.98] flex justify-center items-center"
                              >
                                DELIVER HERE <FiChevronRight className="ml-2" size={20}/>
                              </button>
                              <button 
                                onClick={() => setIsAddingNew(true)} 
                                className="flex-1 bg-white border-2 border-slate-200 hover:border-slate-400 hover:bg-slate-50 text-slate-700 font-bold py-4 rounded-xl transition-all active:scale-[0.98]"
                              >
                                + Add New Address
                              </button>
                            </div>
                          </div>
                        ) : (
                          <form onSubmit={handleAddressSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-2">
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block">Full Name</label>
                                <input 
                                  type="text" 
                                  required 
                                  value={newAddress.name} 
                                  onChange={(e) => setNewAddress({...newAddress, name: e.target.value})} 
                                  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#FF4500] focus:ring-4 focus:ring-[#FF4500]/10 focus:bg-white outline-none font-medium transition-all text-slate-800" 
                                  placeholder="John Doe"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block">Mobile Number</label>
                                <input 
                                  type="tel" 
                                  required 
                                  maxLength="10" 
                                  value={newAddress.primaryPhone} 
                                  onChange={(e) => setNewAddress({...newAddress, primaryPhone: e.target.value.replace(/[^0-9]/g, '')})} 
                                  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#FF4500] focus:ring-4 focus:ring-[#FF4500]/10 focus:bg-white outline-none font-medium transition-all text-slate-800" 
                                  placeholder="10-digit mobile number"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block">House No, Building, Street</label>
                              <input 
                                type="text" 
                                required 
                                value={newAddress.flat} 
                                onChange={(e) => setNewAddress({...newAddress, flat: e.target.value})} 
                                className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#FF4500] focus:ring-4 focus:ring-[#FF4500]/10 focus:bg-white outline-none font-medium transition-all text-slate-800" 
                                placeholder="E.g. Flat 402, Signature Towers"
                              />
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              <div className="space-y-2">
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block flex justify-between">
                                  Pincode 
                                  {newAddress.pincode.length === 6 && newAddress.city && <span className="text-emerald-500 lowercase flex items-center gap-1 tracking-normal"><FiCheckCircle size={12}/> auto-fetched</span>}
                                </label>
                                <input 
                                  type="text" 
                                  required 
                                  maxLength="6" 
                                  value={newAddress.pincode} 
                                  onChange={handlePincodeChange} 
                                  className="w-full px-5 py-3.5 bg-indigo-50/50 border border-indigo-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none font-black text-indigo-900 tracking-widest transition-all" 
                                  placeholder="6-digit pin"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block">City</label>
                                <input 
                                  type="text" 
                                  required 
                                  value={newAddress.city} 
                                  onChange={(e) => setNewAddress({...newAddress, city: e.target.value})} 
                                  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#FF4500] focus:ring-4 focus:ring-[#FF4500]/10 focus:bg-white outline-none font-medium transition-all text-slate-800" 
                                  placeholder="City name"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block">State</label>
                                <input 
                                  type="text" 
                                  required 
                                  value={newAddress.state} 
                                  onChange={(e) => setNewAddress({...newAddress, state: e.target.value})} 
                                  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#FF4500] focus:ring-4 focus:ring-[#FF4500]/10 focus:bg-white outline-none font-medium transition-all text-slate-800" 
                                  placeholder="State name"
                                />
                              </div>
                            </div>
                            
                            <div className="flex flex-col sm:flex-row gap-4 pt-6 mt-6 border-t border-slate-100">
                              <button 
                                type="submit" 
                                className="flex-1 bg-[#FF4500] hover:bg-[#E8004C] text-white font-black py-4 rounded-xl transition-all shadow-lg shadow-orange-500/20 active:scale-[0.98]"
                              >
                                SAVE & CONTINUE
                              </button>
                              {user?.addresses && user.addresses.length > 0 && (
                                <button 
                                  type="button" 
                                  onClick={() => setIsAddingNew(false)} 
                                  className="px-10 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-4 rounded-xl transition-all active:scale-[0.98]"
                                >
                                  Cancel
                                </button>
                              )}
                            </div>
                          </form>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {step === 2 && selectedAddress && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} 
                        className="px-6 sm:px-8 pb-6 text-sm"
                      >
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <p className="font-bold text-slate-900 text-base">{user?.name || 'Guest'} <span className="text-slate-400 mx-2">|</span> {user?.phone || selectedAddress.primaryPhone || selectedAddress.phone}</p>
                          <p className="text-slate-500 mt-1.5 leading-relaxed">{selectedAddress.flat}, {selectedAddress.street}, {selectedAddress.city}, {selectedAddress.state} - <span className="font-bold text-slate-800">{selectedAddress.pincode}</span></p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* STEP 2: PAYMENT */}
                <div className={`bg-white rounded-3xl shadow-sm border transition-all duration-300 ${step === 2 ? 'border-slate-200 shadow-md ring-4 ring-slate-50' : 'border-slate-100/60 opacity-60'} overflow-hidden`}>
                  <div className="p-6 sm:p-8 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-xl font-black text-slate-900 flex items-center tracking-tight">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 transition-colors ${step === 2 ? 'bg-[#FF4500]/10 text-[#FF4500]' : 'bg-slate-200 text-slate-500'}`}>
                        <FiCreditCard size={16} />
                      </div>
                      Payment Method
                    </h2>
                  </div>

                  <AnimatePresence>
                    {step === 2 && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} 
                        className="p-6 sm:p-8 space-y-4"
                      >
                        <div className="space-y-4">
                          <label 
                            className={`flex items-start p-5 border-2 rounded-2xl cursor-pointer shadow-sm relative overflow-hidden transition-all duration-200 ${
                              paymentMethod === 'online' ? 'border-[#FF4500] bg-[#FF4500]/5' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            <div className="absolute top-0 right-0 bg-[#FF4500] text-white text-[9px] font-black px-3 py-1.5 rounded-bl-xl tracking-widest uppercase">
                              RECOMMENDED
                            </div>
                            <div className="relative flex items-center justify-center mt-1">
                              <input 
                                type="radio" 
                                name="payment" 
                                value="online" 
                                checked={paymentMethod === 'online'} 
                                onChange={() => handlePaymentChange('online')} 
                                className="peer sr-only" 
                              />
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${paymentMethod === 'online' ? 'border-[#FF4500] bg-[#FF4500]' : 'border-slate-300'}`}>
                                {paymentMethod === 'online' && <FiCheck size={12} className="text-white" />}
                              </div>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-white shadow-sm text-[#FF4500] flex items-center justify-center ml-4 mr-4">
                              <FiSmartphone size={24} />
                            </div>
                            <div className="flex-1 pt-1">
                              <p className="font-black text-slate-900 text-lg leading-none">Pay Online</p>
                              <p className="text-sm font-medium text-slate-500 mt-2">UPI / Credit Card / Debit Card / NetBanking</p>
                              <p className="text-[11px] font-bold text-indigo-500 mt-2 flex items-center gap-1 bg-indigo-50 w-max px-2 py-0.5 rounded"><FiShield size={12}/> Secure via Razorpay</p>
                            </div>
                          </label>

                          <label 
                            className={`flex items-start p-5 border-2 rounded-2xl transition-all duration-200 ${
                              !codIntelligence.codAvailable 
                                ? 'opacity-50 bg-slate-100 border-slate-200 cursor-not-allowed' 
                                : paymentMethod === 'cod' 
                                  ? 'border-slate-800 bg-slate-50 cursor-pointer' 
                                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 cursor-pointer'
                            }`}
                          >
                            <div className="relative flex items-center justify-center mt-1">
                              <input 
                                type="radio" 
                                name="payment" 
                                value="cod" 
                                disabled={!codIntelligence.codAvailable}
                                checked={paymentMethod === 'cod'} 
                                onChange={() => handlePaymentChange('cod')} 
                                className="peer sr-only" 
                              />
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${paymentMethod === 'cod' ? 'border-slate-800 bg-slate-800' : 'border-slate-300'}`}>
                                {paymentMethod === 'cod' && <FiCheck size={12} className="text-white" />}
                              </div>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-white shadow-sm text-slate-800 flex items-center justify-center ml-4 mr-4">
                              <FiTruck size={24} />
                            </div>
                            <div className="flex-1 pt-1">
                              <div className="flex justify-between items-center">
                                <p className="font-black text-slate-900 text-lg leading-none">Cash on Delivery (COD)</p>
                                {codIntelligence.codFeePaise > 0 && codIntelligence.codAvailable && (
                                  <span className="text-[10px] font-black text-amber-800 bg-amber-100 px-2.5 py-1 rounded-md uppercase tracking-wider">
                                    +{formatCurrency(codIntelligence.codFeePaise)} Fee
                                  </span>
                                )}
                              </div>
                              <p className="text-sm font-medium text-slate-500 mt-2">
                                {codIntelligence.codAvailable ? 'Pay via Cash/UPI at your doorstep securely' : <span className="text-red-500 font-bold">{codIntelligence.reason}</span>}
                              </p>
                            </div>
                          </label>
                        </div>

                        <div className="mt-8 pt-8 border-t border-slate-100">
                          <button 
                            onClick={handlePreCheckout} 
                            disabled={isProcessing}
                            className="w-full bg-slate-950 disabled:bg-slate-400 hover:bg-slate-800 text-white font-black py-4 sm:py-5 rounded-xl shadow-xl shadow-slate-900/20 active:scale-[0.98] transition-all text-base sm:text-lg flex justify-center items-center gap-3"
                          >
                            {isProcessing ? (
                              <><FiLoader className="animate-spin" size={20} /> SECURING PAYMENT...</>
                            ) : (
                              <><FiLock size={20} /> {paymentMethod === 'cod' ? `CONFIRM ORDER - ${formatCurrency(finalTotalPaise)}` : `PAY ${formatCurrency(finalTotalPaise)} SECURELY`}</>
                            )}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* RIGHT COLUMN: ORDER SUMMARY */}
              <aside className="w-full lg:w-[35%]">
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 sm:p-8 sticky top-24">
                  <h3 className="text-lg font-black text-slate-900 mb-6 border-b border-slate-100 pb-4">Order Summary</h3>
                  
                  <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-2xl mb-6 flex items-start gap-3 shadow-sm">
                    <FiTruck className="text-emerald-600 mt-0.5 flex-shrink-0" size={20} />
                    <div>
                      <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest mb-1">Expected Delivery</p>
                      <p className="font-black text-emerald-950 text-sm">{formattedDeliveryDate}</p>
                    </div>
                  </div>

                  <div className="space-y-4 mb-6 max-h-[300px] overflow-y-auto scrollbar-hide pr-1">
                    {cart.map(item => {
                      const itemPricePaise = item.pricePaise || 0;
                      return (
                        <div key={item.id} className="flex items-center gap-4 bg-slate-50/80 p-3 rounded-2xl border border-slate-100">
                          <SummaryItemImage src={item.image || (item.images && item.images[0])} alt={item.title} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800 line-clamp-2 leading-tight mb-1">{item.title}</p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Qty: {item.quantity}</p>
                          </div>
                          <p className="text-sm font-black text-slate-900 pl-2">{formatCurrency(itemPricePaise)}</p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="space-y-3.5 mb-6 text-sm font-medium border-t border-slate-100 pt-6">
                    <div className="flex justify-between text-slate-500">
                      <span>Total MRP</span>
                      <span className="text-slate-900 font-bold">{formatCurrency(cartTotalPaiseMetric)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-600 font-bold">
                      <span>Store Discount</span>
                      <span>- {formatCurrency(discountPaise)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500 items-center">
                      <span>Shipping Fee</span>
                      <span className="text-emerald-600 font-black bg-emerald-50 px-2 py-0.5 rounded-md text-[10px] uppercase tracking-widest border border-emerald-100">FREE</span>
                    </div>
                    {paymentMethod === 'cod' && appliedCodFeePaise > 0 && (
                      <div className="flex justify-between text-slate-800 font-bold pt-1">
                        <span>COD Handling Fee</span>
                        <span className="text-slate-900 font-black">+ {formatCurrency(appliedCodFeePaise)}</span>
                      </div>
                    )}
                  </div>

                  <div className="w-full h-px bg-slate-200 mb-6"></div>

                  <div className="flex justify-between items-end">
                    <div>
                      <span className="font-bold text-slate-500 uppercase tracking-widest text-[11px] block mb-1">To Pay</span>
                      <span className="text-[10px] text-slate-400 font-medium leading-none">Inclusive of all taxes</span>
                    </div>
                    <span className="text-3xl font-black text-slate-950 tracking-tight">{formatCurrency(finalTotalPaise)}</span>
                  </div>
                </div>
              </aside>
            </motion.div>
          ) : (
            
            /* STEP 3: SUCCESS ANIMATION */
            <motion.div 
              key="success" 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5, type: "spring", bounce: 0.4 }} 
              className="flex flex-col items-center justify-center py-24 bg-white rounded-[2rem] shadow-sm border border-slate-100 max-w-2xl mx-auto mt-12 text-center px-6"
            >
              <motion.div 
                initial={{ scale: 0 }} animate={{ scale: 1 }} 
                transition={{ type: 'spring', damping: 12, stiffness: 100, delay: 0.2 }} 
                className="w-32 h-32 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 mb-8 border-4 border-emerald-100 relative"
              >
                <div className="absolute inset-0 rounded-full border-2 border-emerald-500 animate-ping opacity-20"></div>
                <FiCheckCircle size={64} className="stroke-[1.5]" />
              </motion.div>
              <h1 className="text-3xl sm:text-4xl font-black text-slate-900 mb-3 tracking-tight">Order Confirmed!</h1>
              <p className="text-slate-500 font-medium mb-10 max-w-md text-base sm:text-lg leading-relaxed">
                Thank you for shopping with Jack Essentials.<br/>
                {paymentMethod === 'cod' && <span className="text-slate-700 font-bold block mt-2">Please keep the cash ready at delivery.</span>}
                We are preparing your package for dispatch.
              </p>
              <div className="flex items-center space-x-3 bg-slate-50 px-6 py-3.5 rounded-full border border-slate-200/60 shadow-inner">
                <div className="w-5 h-5 border-2 border-slate-300 border-t-[#FF4500] rounded-full animate-spin"></div>
                <p className="text-[11px] text-slate-600 font-bold tracking-widest uppercase">Redirecting to Dashboard...</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default Checkout;