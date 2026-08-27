import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiPackage, FiShoppingBag, FiTruck, FiCheckCircle, FiClock, FiChevronRight } from 'react-icons/fi';
import { Link, useNavigate } from 'react-router-dom';
// 🔥 PHASE 1 FIX: Canonical Axios Instance
import axiosInstance from '../api/axiosInstance';

// 🔥 CANONICAL CURRENCY FORMATTER UTILITY
const formatCurrency = (paise) => {
  if (typeof paise !== 'number') return '₹0.00';
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const TrackOrder = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);

  // Order Tracking Stages
  const stages = ["Placed", "Processing", "Shipped", "Out for Delivery", "Delivered"];

  useEffect(() => {
    window.scrollTo(0, 0);
    
    const checkAuthAndFetch = async () => {
      const storedUser = JSON.parse(localStorage.getItem('jack_user'));
      
      // 1. Redirect if not logged in
      if (!storedUser || !storedUser.id) {
        navigate('/login');
        return;
      }

      setUser(storedUser);

      // 2. Fetch real orders
      try {
        // 🔥 PHASE 1 FIX: Removed localhost and used axiosInstance
        const res = await axiosInstance.get(`/orders/user/${storedUser.id}`);
        setOrders(res.data);
      } catch (error) {
        console.error("Failed to fetch orders:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthAndFetch();
  }, [navigate]);

  // Animations
  const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } } };
  const stagger = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.2 } } };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-200 font-sans pb-20 overflow-hidden">
      
      {/* HEADER SECTION */}
      <div className="relative pt-32 pb-16 px-6 text-center border-b border-slate-800">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl h-48 bg-[#FF4500] opacity-[0.05] blur-[100px] pointer-events-none"></div>
        <motion.div initial="hidden" animate="visible" variants={fadeUp} className="relative z-10 max-w-3xl mx-auto">
          <div className="w-16 h-16 bg-slate-800/50 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-slate-700">
            <FiTruck className="text-[#FF4500] w-8 h-8" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">
            Track Your Order
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed">
            Monitor your Jack Essentials deliveries in real-time.
          </p>
        </motion.div>
      </div>

      {/* CONTENT SECTION */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        {isLoading ? (
          // LOADING SKELETON
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-slate-700 border-t-[#FF4500] rounded-full animate-spin mb-4"></div>
            <p className="text-slate-400 font-bold tracking-widest uppercase text-sm">Fetching your orders...</p>
          </div>
        ) : orders.length === 0 ? (
          // EMPTY STATE (No Orders)
          <motion.div initial="hidden" animate="visible" variants={fadeUp} className="text-center py-20 bg-slate-800/20 rounded-3xl border border-slate-800">
            <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
              <FiShoppingBag className="text-slate-500 w-10 h-10" />
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-white mb-3">You haven't placed any orders yet.</h2>
            <p className="text-slate-400 mb-8 max-w-md mx-auto">Looks like your cart is waiting for some amazing products. Let's get you something special!</p>
            <Link to="/shop" className="inline-block bg-[#FF4500] hover:bg-orange-600 text-white font-bold py-4 px-10 rounded-full transition-all shadow-lg shadow-orange-500/20 active:scale-95">
              Start Shopping
            </Link>
          </motion.div>
        ) : (
          // ORDERS LIST
          <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-8">
            {orders.map((order, idx) => {
              // Calculate progress index based on real status
              const currentStageIdx = stages.includes(order.status) ? stages.indexOf(order.status) : 0;
              const progressPercentage = (currentStageIdx / (stages.length - 1)) * 100;
              
              const orderIdStr = order.id || order._id || '';
              const orderTotalPaise = order.totalPaise || 0;

              return (
                <motion.div key={orderIdStr || idx} variants={fadeUp} className="bg-slate-800/40 rounded-3xl border border-slate-700 overflow-hidden hover:border-slate-500 transition-colors">
                  
                  {/* Order Details Header */}
                  <div className="p-6 md:p-8 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between border-b border-slate-700/50">
                    <div className="flex items-center gap-6">
                      <div className="w-24 h-24 bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 flex-shrink-0 relative group">
                        <img 
                          src={order.items?.[0]?.image || order.items?.[0]?.images?.[0] || "https://via.placeholder.com/150"} 
                          alt="product" 
                          className="w-full h-full object-contain bg-white p-1 group-hover:scale-110 transition-transform duration-500"
                        />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#FF4500] uppercase tracking-wider mb-1">Order #{orderIdStr.slice(-8).toUpperCase()}</p>
                        <h3 className="text-xl font-bold text-white line-clamp-1 mb-1">{order.items?.[0]?.title || "Premium Product"}</h3>
                        <p className="text-sm font-black text-emerald-400 mb-2">{formatCurrency(order.items?.[0]?.pricePaise || orderTotalPaise)}</p>
                        <p className="text-sm text-slate-400 flex items-center gap-2">
                          <FiClock /> Placed on: {order.date || new Date(order.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Link to={`/order/${orderIdStr}`} className="text-sm font-bold text-slate-300 hover:text-white bg-slate-700/50 hover:bg-slate-600 px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap">
                      View Details <FiChevronRight />
                    </Link>
                  </div>

                  {/* PREMIUM ANIMATED PROGRESS TRACKER */}
                  <div className="p-6 md:p-10 bg-slate-900/30">
                    <div className="relative">
                      {/* Background Line */}
                      <div className="absolute top-5 left-0 w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        {/* Animated Fill Line */}
                        <motion.div 
                          initial={{ width: 0 }}
                          whileInView={{ width: `${progressPercentage}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 1.5, ease: "easeInOut" }}
                          className="h-full bg-gradient-to-r from-orange-500 to-[#FF4500] rounded-full relative"
                        >
                           <div className="absolute right-0 top-0 bottom-0 w-10 bg-white/30 blur-sm animate-pulse"></div>
                        </motion.div>
                      </div>

                      {/* Nodes */}
                      <div className="relative flex justify-between">
                        {stages.map((stage, stageIdx) => {
                          const isCompleted = stageIdx <= currentStageIdx;
                          const isCurrent = stageIdx === currentStageIdx;

                          return (
                            <div key={stage} className="flex flex-col items-center">
                              {/* Node Circle */}
                              <motion.div 
                                initial={{ scale: 0 }}
                                whileInView={{ scale: 1 }}
                                viewport={{ once: true }}
                                transition={{ delay: stageIdx * 0.2, type: "spring" }}
                                className={`w-10 h-10 rounded-full flex items-center justify-center z-10 border-4 ${
                                  isCompleted ? 'bg-[#FF4500] border-slate-900 shadow-[0_0_15px_rgba(255,69,0,0.5)]' : 'bg-slate-800 border-slate-900 text-slate-500'
                                }`}
                              >
                                {isCompleted ? <FiCheckCircle className="text-white w-5 h-5" /> : <FiPackage className="w-4 h-4" />}
                              </motion.div>
                              
                              {/* Stage Text */}
                              <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: (stageIdx * 0.2) + 0.1 }}
                                className={`mt-4 text-xs md:text-sm font-bold text-center w-20 md:w-24 ${
                                  isCurrent ? 'text-[#FF4500]' : isCompleted ? 'text-white' : 'text-slate-500'
                                }`}
                              >
                                {stage}
                              </motion.div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default TrackOrder;