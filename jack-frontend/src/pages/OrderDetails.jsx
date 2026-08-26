import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiArrowLeft, FiPackage, FiTruck, FiCheckCircle, FiClock, FiXCircle, FiMapPin, FiCreditCard, FiHelpCircle, FiCopy, FiDownload, FiStar, FiUpload, FiX } from 'react-icons/fi';
import Navbar from '../components/Navbar';
import { useUser } from '../context/UserContext';
import axiosInstance from '../api/axiosInstance';

// 🔥 CANONICAL CURRENCY FORMATTER UTILITY
const formatCurrency = (paise) => {
  if (typeof paise !== 'number') return '₹0.00';
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// ==========================================
// 📝 SUBMIT REVIEW MODAL WITH CLOUDINARY UPLOAD 🔥
// ==========================================
const SubmitReviewModal = ({ isOpen, onClose, product, orderId }) => {
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen || !product) return null;

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const uploadToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'jack_essentials_preset'); 
    
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'your_cloud_name';
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Image upload failed');
    return data.secure_url;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);
    setErrorMsg('');

    try {
      let uploadedImageUrl = '';
      if (imageFile) {
        uploadedImageUrl = await uploadToCloudinary(imageFile);
      }

      const productId = product.productId || product.id || product._id;
      const res = await axiosInstance.post(`/products/${productId}/reviews`, {
        rating,
        title,
        comment,
        images: uploadedImageUrl ? [uploadedImageUrl] : []
      });

      if (res.status === 201) {
        setSuccessMsg('Review submitted successfully with Verified Buyer status! ✅');
        setTimeout(() => {
          onClose();
          setSuccessMsg('');
        }, 1500);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to submit review.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-[2rem] max-w-lg w-full p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
          <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-xl font-black text-slate-900">Rate & Review Item</h3>
              <p className="text-xs text-slate-500 font-medium truncate max-w-xs">{product.title}</p>
            </div>
            <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200"><FiX size={18}/></button>
          </div>

          {errorMsg && <p className="bg-red-50 text-red-600 text-xs font-bold p-3 rounded-xl mb-4 border border-red-100">{errorMsg}</p>}
          {successMsg && <p className="bg-emerald-50 text-emerald-600 text-xs font-bold p-3 rounded-xl mb-4 border border-emerald-100">{successMsg}</p>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Rating</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button type="button" key={star} onClick={() => setRating(star)} className={`text-3xl ${rating >= star ? 'text-yellow-400' : 'text-slate-300'}`}>★</button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Headline</label>
              <input type="text" placeholder="What's most important to know?" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none focus:border-slate-900" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Add Written Review</label>
              <textarea rows="4" placeholder="What did you like or dislike? How was the quality?" value={comment} onChange={(e) => setComment(e.target.value)} required className="w-full border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none focus:border-slate-900 resize-none"></textarea>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Add Photo (Optional)</label>
              <div className="flex items-center gap-4">
                <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 hover:border-slate-900 bg-slate-50 rounded-xl p-4 cursor-pointer flex-1 transition-colors">
                  <FiUpload className="text-slate-500" />
                  <span className="text-xs font-bold text-slate-600">Upload Image</span>
                  <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                </label>
                {previewUrl && (
                  <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 relative flex-shrink-0">
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            </div>

            <button type="submit" disabled={uploading} className="w-full bg-slate-900 hover:bg-[#FF4500] text-white font-black py-3.5 rounded-xl transition-all shadow-md active:scale-95 disabled:bg-slate-300">
              {uploading ? 'Uploading to Cloudinary & Submitting...' : 'Submit Verified Review'}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

const OrderDetails = ({ isLoggedIn, setIsLoggedIn }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { orders, cancelOrder } = useUser();
  const [copied, setCopied] = useState('');
  
  // Real-time tracking data state from backend `/api/track/:id`
  const [liveTracking, setLiveTracking] = useState(null);
  const [loadingTracking, setLoadingTracking] = useState(true);

  // State for Review Modal
  const [selectedProductForReview, setSelectedProductForReview] = useState(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  const order = orders.find(o => String(o.id) === String(id) || String(o._id) === String(id));

  useEffect(() => {
    window.scrollTo(0, 0);
    
    // 🔥 Fetch Real-Time Courier Tracking Events
    const fetchLiveTracking = async () => {
      try {
        const res = await axiosInstance.get(`/api/track/${id}`);
        if (res.data && res.data.success) {
          setLiveTracking(res.data);
        }
      } catch (err) {
        console.warn("Live tracking fetch failed, falling back to local order status.");
      } finally {
        setLoadingTracking(false);
      }
    };

    fetchLiveTracking();
  }, [id]);

  if (!order) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center flex-col">
        <div className="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center mb-6"><FiPackage size={40} className="text-slate-400" /></div>
        <h2 className="text-3xl font-black mb-2 text-slate-900 tracking-tight">Order Not Found</h2>
        <p className="text-slate-500 mb-8 font-medium">The order you are looking for does not exist or has been removed.</p>
        <button onClick={() => navigate('/profile')} className="px-8 py-4 bg-slate-900 text-white font-black rounded-xl hover:bg-[#FF4500] transition-colors shadow-lg active:scale-95">Return to My Orders</button>
      </div>
    );
  }

  // 🔥 Real-Time Tracking Timeline Steps 🔥
  const trackingTimeline = liveTracking?.timeline || [
    { title: 'Ordered', completed: true },
    { title: 'Packed', completed: ['Packed', 'Shipped', 'Out for Delivery', 'Delivered'].includes(order.status) },
    { title: 'Shipped', completed: ['Shipped', 'Out for Delivery', 'Delivered'].includes(order.status) },
    { title: 'Out for Delivery', completed: ['Out for Delivery', 'Delivered'].includes(order.status) },
    { title: 'Delivered', completed: order.status === 'Delivered' }
  ];

  const currentStepIndex = trackingTimeline.filter(step => step.completed).length - 1;
  const progressPercentage = Math.max(0, (currentStepIndex / (trackingTimeline.length - 1)) * 100);

  const isCancelled = order.status === 'Cancelled';
  const isRTO = order.status === 'RTO';
  const isDelivered = order.status === 'Delivered';

  // Format delivery date
  const orderDateObj = new Date(order.createdAt || Date.now());
  orderDateObj.setDate(orderDateObj.getDate() + 4);
  const estDelivery = liveTracking?.estimatedDelivery || orderDateObj.toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' });

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(''), 2000);
  };

  const orderTotalPaise = order.totalPaise || 0;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-24">
      <Navbar isLoggedIn={isLoggedIn} setIsLoggedIn={setIsLoggedIn} />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        
        <button onClick={() => navigate('/profile')} className="flex items-center text-slate-500 hover:text-slate-900 mb-6 font-bold transition-colors w-max bg-white px-4 py-2 rounded-full shadow-sm border border-slate-200">
          <FiArrowLeft className="mr-2" /> Back to Orders
        </button>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          
          {/* HEADER SECTION */}
          <div className="bg-slate-900 p-6 md:p-8 text-white flex flex-col md:flex-row justify-between md:items-end gap-6 relative overflow-hidden">
            <div className="absolute top-[-50%] right-[-10%] w-64 h-64 bg-[#FF4500] rounded-full mix-blend-screen filter blur-[80px] opacity-30"></div>
            
            <div className="relative z-10">
              <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2">Order Summary</h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300 font-medium mt-3">
                <span className="bg-slate-800 px-3 py-1.5 rounded-lg flex items-center font-mono">
                  ID: {(order.id || order._id).slice(-8).toUpperCase()} 
                  <button onClick={() => handleCopy(order.id || order._id, 'id')} className="ml-2 hover:text-white transition-colors" title="Copy ID">
                    {copied === 'id' ? <FiCheckCircle className="text-green-400"/> : <FiCopy />}
                  </button>
                </span>
                <span>•</span>
                <span>Placed on <b className="text-white">{order.date || new Date(order.createdAt).toLocaleDateString()}</b></span>
              </div>
            </div>
            
            <div className="flex flex-col md:items-end relative z-10 bg-white/10 p-4 rounded-2xl backdrop-blur-sm border border-white/10">
              <span className="text-xs text-slate-300 font-bold uppercase tracking-widest mb-1">Total Amount</span>
              <span className="text-3xl font-black text-[#FF4500]">{formatCurrency(orderTotalPaise)}</span>
            </div>
          </div>

          <div className="p-6 md:p-8">
            
            {/* --- REAL-TIME ADVANCE TRACKING UI --- */}
            <div className="mb-10">
              {isCancelled || isRTO ? (
                <div className="bg-red-50 border border-red-100 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
                  <FiXCircle size={56} className="text-red-500 mb-4" />
                  <h3 className="text-2xl font-black text-red-700 tracking-tight mb-2">
                    {isCancelled ? 'Order Cancelled' : 'Delivery Failed (RTO)'}
                  </h3>
                  <p className="text-red-500 font-medium text-sm max-w-md">
                    {isCancelled 
                      ? 'This order has been cancelled. If you already paid, the refund will be processed shortly.' 
                      : 'The courier attempted delivery but it failed. The package is returning to our warehouse.'}
                  </p>
                </div>
              ) : (
                <div className="bg-slate-50 p-6 md:p-10 rounded-3xl border border-slate-100">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-10 gap-4">
                    <div>
                      <h3 className="text-xl font-black text-slate-900 tracking-tight">Real-Time Courier Tracking</h3>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">Partner: <span className="font-bold text-slate-800">{liveTracking?.courierPartner || 'Delhivery Express'}</span></p>
                    </div>
                    <span className="text-sm font-black text-indigo-700 bg-indigo-100 px-4 py-2 rounded-xl flex items-center w-max border border-indigo-200 shadow-sm">
                      <FiTruck className="mr-2" /> {order.status === 'Delivered' ? 'Delivered successfully' : `Expected by ${estDelivery}`}
                    </span>
                  </div>
                  
                  {/* Timeline Bar */}
                  <div className="relative pt-2 pb-2 px-2 md:px-6">
                    <div className="absolute left-10 right-10 top-6 h-2 bg-slate-200 rounded-full z-0 hidden md:block"></div>
                    <div 
                      className="absolute left-10 top-6 h-2 bg-gradient-to-r from-orange-500 to-[#FF4500] rounded-full z-0 transition-all duration-1000 ease-out hidden md:block shadow-[0_0_10px_rgba(255,69,0,0.4)]" 
                      style={{ width: `${progressPercentage}%` }}
                    ></div>

                    <div className="hidden md:flex justify-between relative z-10">
                      {trackingTimeline.map((step, index) => {
                        const isCompleted = step.completed;
                        const isCurrent = index === currentStepIndex;
                        return (
                          <div key={index} className="flex flex-col items-center group relative">
                            <motion.div 
                              initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: index * 0.2 }}
                              className={`w-12 h-12 rounded-full flex items-center justify-center border-4 border-slate-50 shadow-md transition-all duration-500 z-10
                                ${isCompleted ? 'bg-[#FF4500] text-white scale-110 shadow-orange-500/30' : 'bg-white text-slate-300 border-slate-200'}`}
                            >
                              {index === 0 ? <FiClock size={20} /> : index === 1 ? <FiPackage size={20} /> : index === 2 ? <FiTruck size={20} /> : <FiCheckCircle size={20} />}
                            </motion.div>
                            <span className={`mt-4 text-xs font-black uppercase tracking-wider text-center transition-colors
                              ${isCurrent ? 'text-[#FF4500]' : isCompleted ? 'text-slate-900' : 'text-slate-400'}`}>
                              {step.title}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Mobile Timeline */}
                    <div className="md:hidden space-y-6 relative before:absolute before:inset-0 before:ml-[1.4rem] before:-translate-x-px before:h-full before:w-1 before:bg-slate-200 rounded-full">
                      {trackingTimeline.map((step, index) => (
                        <div key={index} className="relative flex items-center">
                          <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-slate-50 shrink-0 shadow-sm z-10
                            ${step.completed ? 'bg-[#FF4500] text-white' : 'bg-white text-slate-300 border-slate-200'}`}>
                            {index === 0 ? <FiClock size={16} /> : index === 1 ? <FiPackage size={16} /> : index === 2 ? <FiTruck size={16} /> : <FiCheckCircle size={16} />}
                          </div>
                          <div className="ml-4 bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex-1">
                            <h4 className={`font-black text-xs uppercase tracking-widest ${step.completed ? 'text-slate-900' : 'text-slate-400'}`}>{step.title}</h4>
                            <p className="text-[10px] text-slate-500 font-medium mt-0.5">{step.date || 'In Transit'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              <div className="lg:col-span-2 space-y-6">
                
                {(order.shiprocketOrderId || liveTracking?.trackingId) && !isCancelled && (
                  <div className="bg-indigo-50 border border-indigo-200 p-6 rounded-3xl shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div>
                      <h3 className="font-black text-indigo-900 text-lg flex items-center"><FiTruck className="mr-2"/> Courier Tracking ID</h3>
                      <p className="text-sm font-medium text-indigo-700 mt-1 flex items-center gap-2">
                        AWB / Tracking Number: <span className="font-mono bg-white px-2 py-1 rounded border border-indigo-100">{order.shiprocketOrderId || liveTracking?.trackingId}</span>
                        <button onClick={() => handleCopy(order.shiprocketOrderId || liveTracking?.trackingId, 'awb')} className="hover:text-indigo-900" title="Copy ID">
                           {copied === 'awb' ? <FiCheckCircle className="text-green-500"/> : <FiCopy />}
                        </button>
                      </p>
                    </div>
                    <a href={`https://www.delhivery.com/tracking?id=${order.shiprocketOrderId || liveTracking?.trackingId}`} target="_blank" rel="noreferrer" className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl text-center shadow-md transition-colors whitespace-nowrap">
                      Track on Courier
                    </a>
                  </div>
                )}

                <div>
                  <h3 className="text-xl font-black text-slate-900 mb-4 tracking-tight">Items Ordered</h3>
                  <div className="space-y-4">
                    {order.items.map((item, idx) => {
                      const itemPricePaise = item.pricePaise || 0;
                      return (
                        <div key={idx} className="flex items-center space-x-4 md:space-x-6 border border-slate-100 p-4 md:p-5 rounded-3xl hover:shadow-md transition-shadow bg-white group">
                          <div className="w-20 h-20 md:w-24 md:h-24 bg-slate-50 rounded-2xl overflow-hidden p-2 flex-shrink-0 relative">
                            <img src={item.image || (item.images && item.images[0])} alt={item.title} className="w-full h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-slate-800 text-sm md:text-base line-clamp-2 leading-tight">{item.title}</h4>
                            <p className="text-[10px] md:text-xs font-bold text-slate-400 mt-1.5 uppercase tracking-widest">Category: {item.category || 'Fashion'}</p>
                            
                            <div className="flex items-center justify-between mt-3">
                              <span className="text-xs font-black text-slate-600 bg-slate-100 border border-slate-200 px-3 py-1 rounded-lg">Qty: {item.quantity}</span>
                              <div className="flex items-center gap-3">
                                <span className="font-black text-lg text-[#FF4500]">{formatCurrency(itemPricePaise)}</span>
                                {isDelivered && (
                                  <button 
                                    onClick={() => { setSelectedProductForReview(item); setIsReviewModalOpen(true); }} 
                                    className="bg-amber-100 hover:bg-amber-200 text-amber-800 px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 transition-colors shadow-sm"
                                  >
                                    <FiStar size={12} fill="currentColor" /> Rate Item
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                  <div>
                    <h3 className="text-xs font-black text-slate-400 mb-3 uppercase tracking-widest flex items-center"><FiMapPin className="mr-2 text-indigo-500" size={16}/> Delivery Address</h3>
                    <div className="text-sm font-medium text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      {order.address ? (
                        <>
                          <p className="font-black text-slate-900 text-base mb-1">{order.userDetails?.name || order.address.name || 'Customer'}</p>
                          <p className="mb-2">{order.address.primaryPhone || order.userDetails?.phone}</p>
                          <p className="leading-relaxed text-slate-600">{order.address.flat}, {order.address.street}</p>
                          <p className="font-bold text-slate-800 mt-1">{order.address.city}, {order.address.state} - {order.address.pincode}</p>
                        </>
                      ) : (
                        <p className="text-slate-500 italic">Address details unavailable for this order.</p>
                      )}
                    </div>
                  </div>

                  <div className="w-full h-px bg-slate-100"></div>

                  <div>
                    <h3 className="text-xs font-black text-slate-400 mb-3 uppercase tracking-widest flex items-center"><FiCreditCard className="mr-2 text-green-500" size={16}/> Payment Method</h3>
                    <div className="text-sm font-bold text-slate-800 bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                      <span>{order.paymentMethod?.includes('UPI') ? 'UPI Payment' : order.paymentMethod || 'Cash on Delivery'}</span>
                      {order.paymentMethod?.includes('UPI') && <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-[10px] tracking-widest">PAID</span>}
                    </div>
                  </div>

                </div>

                <div className="space-y-3">
                  {!isCancelled && !isRTO && currentStepIndex < 2 && (
                    <button 
                      onClick={() => {
                        if(window.confirm('Are you sure you want to cancel this order? This cannot be undone.')) cancelOrder(order.id || order._id);
                      }}
                      className="w-full py-4 border-2 border-red-100 bg-red-50 text-red-600 font-bold rounded-2xl hover:bg-red-500 hover:text-white transition-all active:scale-95 text-sm"
                    >
                      Cancel Order
                    </button>
                  )}

                  {order.status === 'Delivered' && (
                    <button className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl shadow-lg hover:bg-[#FF4500] transition-all active:scale-95 flex justify-center items-center gap-2">
                      <FiDownload /> Download Invoice
                    </button>
                  )}

                  <button className="w-full py-4 bg-white border border-slate-200 text-slate-700 font-bold rounded-2xl shadow-sm hover:border-indigo-600 hover:text-indigo-600 transition-all active:scale-95 flex justify-center items-center gap-2 text-sm">
                    <FiHelpCircle /> Need Help with Order?
                  </button>
                </div>

              </div>
            </div>

          </div>
        </motion.div>
      </main>

      <SubmitReviewModal 
        isOpen={isReviewModalOpen} 
        onClose={() => setIsReviewModalOpen(false)} 
        product={selectedProductForReview} 
        orderId={order.id || order._id} 
      />
    </div>
  );
};

export default OrderDetails;