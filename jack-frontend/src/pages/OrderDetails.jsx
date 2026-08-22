import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiArrowLeft, FiPackage, FiTruck, FiCheckCircle, FiClock, FiXCircle, FiMapPin, FiCreditCard, FiHelpCircle, FiCopy, FiDownload } from 'react-icons/fi';
import Navbar from '../components/Navbar';
import { useUser } from '../context/UserContext';

const OrderDetails = ({ isLoggedIn, setIsLoggedIn }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { orders, cancelOrder } = useUser();
  const [copied, setCopied] = useState('');

  const order = orders.find(o => o.id === id);

  useEffect(() => {
    window.scrollTo(0, 0);
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

  // 🔥 Advance Tracking Logic 🔥
  const steps = ["Processing", "Packed", "Shipped", "Delivered"];
  
  let currentStepIndex = 0;
  if (['Pending Review', 'Processing'].includes(order.status)) currentStepIndex = 0;
  else if (order.status === 'Packed') currentStepIndex = 1;
  else if (order.status === 'Shipped') currentStepIndex = 2;
  else if (order.status === 'Delivered') currentStepIndex = 3;
  
  const isCancelled = order.status === 'Cancelled';
  const isRTO = order.status === 'RTO';

  // Format delivery date
  const orderDateObj = new Date(order.createdAt || Date.now());
  orderDateObj.setDate(orderDateObj.getDate() + 4);
  const estDelivery = orderDateObj.toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' });

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(''), 2000);
  };

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
                  ID: {order.id.slice(-8).toUpperCase()} 
                  <button onClick={() => handleCopy(order.id, 'id')} className="ml-2 hover:text-white transition-colors" title="Copy ID">
                    {copied === 'id' ? <FiCheckCircle className="text-green-400"/> : <FiCopy />}
                  </button>
                </span>
                <span>•</span>
                <span>Placed on <b className="text-white">{order.date}</b></span>
              </div>
            </div>
            
            <div className="flex flex-col md:items-end relative z-10 bg-white/10 p-4 rounded-2xl backdrop-blur-sm border border-white/10">
              <span className="text-xs text-slate-300 font-bold uppercase tracking-widest mb-1">Total Amount</span>
              <span className="text-3xl font-black text-[#FF4500]">₹{order.totalAmount}</span>
            </div>
          </div>

          <div className="p-6 md:p-8">
            
            {/* --- THE ADVANCE TRACKING UI --- */}
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
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">Tracking Progress</h3>
                    <span className="text-sm font-black text-indigo-700 bg-indigo-100 px-4 py-2 rounded-xl flex items-center w-max border border-indigo-200 shadow-sm">
                      <FiTruck className="mr-2" /> {order.status === 'Delivered' ? 'Delivered successfully' : `Expected by ${estDelivery}`}
                    </span>
                  </div>
                  
                  <div className="relative pt-2 pb-2 px-2 md:px-10">
                    {/* Background Line Desktop */}
                    <div className="absolute left-10 right-10 top-6 h-2 bg-slate-200 rounded-full z-0 hidden md:block"></div>
                    
                    {/* Progress Line Desktop */}
                    <div 
                      className="absolute left-10 top-6 h-2 bg-gradient-to-r from-green-400 to-green-600 rounded-full z-0 transition-all duration-1000 ease-out hidden md:block shadow-[0_0_10px_rgba(34,197,94,0.4)]" 
                      style={{ width: `${(currentStepIndex / (steps.length - 1)) * 100}%` }}
                    ></div>

                    {/* Desktop Steps */}
                    <div className="hidden md:flex justify-between relative z-10">
                      {steps.map((step, index) => {
                        const isCompleted = index <= currentStepIndex;
                        const isCurrent = index === currentStepIndex;
                        return (
                          <div key={index} className="flex flex-col items-center group relative w-1/4">
                            <motion.div 
                              initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: index * 0.2 }}
                              className={`w-14 h-14 rounded-full flex items-center justify-center border-4 border-slate-50 shadow-md transition-all duration-500 z-10
                                ${isCompleted ? 'bg-green-500 text-white scale-110 shadow-green-500/30' : 'bg-white text-slate-300 border-slate-200'}`}
                            >
                              {index === 0 ? <FiClock size={24} /> : index === 1 ? <FiPackage size={24} /> : index === 2 ? <FiTruck size={24} /> : <FiCheckCircle size={24} />}
                            </motion.div>
                            <span className={`mt-5 text-sm font-black uppercase tracking-widest text-center transition-colors
                              ${isCurrent ? 'text-slate-900' : isCompleted ? 'text-green-600' : 'text-slate-400'}`}>
                              {step}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Mobile Steps (Vertical) */}
                    <div className="md:hidden space-y-8 relative before:absolute before:inset-0 before:ml-[1.4rem] before:-translate-x-px before:h-full before:w-1 before:bg-slate-200 rounded-full">
                      {steps.map((step, index) => {
                        const isCompleted = index <= currentStepIndex;
                        return (
                          <div key={index} className="relative flex items-center">
                            <div className={`flex items-center justify-center w-12 h-12 rounded-full border-4 border-slate-50 shrink-0 shadow-sm z-10
                              ${isCompleted ? 'bg-green-500 text-white' : 'bg-white text-slate-300 border-slate-200'}`}>
                              {index === 0 ? <FiClock size={18} /> : index === 1 ? <FiPackage size={18} /> : index === 2 ? <FiTruck size={18} /> : <FiCheckCircle size={18} />}
                            </div>
                            <div className="ml-5 bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex-1">
                              <h4 className={`font-black text-sm uppercase tracking-widest ${isCompleted ? 'text-slate-900' : 'text-slate-400'}`}>{step}</h4>
                              {isCompleted && index === currentStepIndex && <p className="text-xs font-medium text-green-600 mt-1">Currently here</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Left Column: Items */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* 🚚 AWB TRACKING CARD (PRO FEATURE) */}
                {order.shiprocketOrderId && !isCancelled && (
                  <div className="bg-indigo-50 border border-indigo-200 p-6 rounded-3xl shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div>
                      <h3 className="font-black text-indigo-900 text-lg flex items-center"><FiTruck className="mr-2"/> Courier Dispatched</h3>
                      <p className="text-sm font-medium text-indigo-700 mt-1 flex items-center gap-2">
                        Tracking AWB: <span className="font-mono bg-white px-2 py-1 rounded border border-indigo-100">{order.shiprocketOrderId}</span>
                        <button onClick={() => handleCopy(order.shiprocketOrderId, 'awb')} className="hover:text-indigo-900" title="Copy AWB">
                           {copied === 'awb' ? <FiCheckCircle className="text-green-500"/> : <FiCopy />}
                        </button>
                      </p>
                    </div>
                    <a href={`https://www.delhivery.com/tracking?id=${order.shiprocketOrderId}`} target="_blank" rel="noreferrer" className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl text-center shadow-md transition-colors whitespace-nowrap">
                      Track Live
                    </a>
                  </div>
                )}

                <div>
                  <h3 className="text-xl font-black text-slate-900 mb-4 tracking-tight">Items Ordered</h3>
                  <div className="space-y-4">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex items-center space-x-4 md:space-x-6 border border-slate-100 p-4 md:p-5 rounded-3xl hover:shadow-md transition-shadow bg-white group">
                        <div className="w-20 h-20 md:w-24 md:h-24 bg-slate-50 rounded-2xl overflow-hidden p-2 flex-shrink-0 relative">
                          <img src={item.image || (item.images && item.images[0])} alt={item.title} className="w-full h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-slate-800 text-sm md:text-base line-clamp-2 leading-tight">{item.title}</h4>
                          <p className="text-[10px] md:text-xs font-bold text-slate-400 mt-1.5 uppercase tracking-widest">Category: {item.category || 'Fashion'}</p>
                          <div className="flex items-center justify-between mt-3">
                            <span className="text-xs font-black text-slate-600 bg-slate-100 border border-slate-200 px-3 py-1 rounded-lg">Qty: {item.quantity}</span>
                            <span className="font-black text-lg text-[#FF4500]">₹{item.price}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Address, Payment & Actions */}
              <div className="space-y-6">
                
                {/* Shipping & Payment Details */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                  
                  <div>
                    <h3 className="text-xs font-black text-slate-400 mb-3 uppercase tracking-widest flex items-center"><FiMapPin className="mr-2 text-indigo-500" size={16}/> Delivery Address</h3>
                    <div className="text-sm font-medium text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      {order.address ? (
                        <>
                          <p className="font-black text-slate-900 text-base mb-1">{order.userDetails?.name || 'Customer'}</p>
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

                {/* Actions */}
                <div className="space-y-3">
                  {!isCancelled && !isRTO && currentStepIndex < 2 && (
                    <button 
                      onClick={() => {
                        if(window.confirm('Are you sure you want to cancel this order? This cannot be undone.')) cancelOrder(order.id);
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
    </div>
  );
};

export default OrderDetails;