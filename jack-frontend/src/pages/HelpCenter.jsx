import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiBox, FiTruck, FiAlertCircle, FiChevronDown, FiChevronUp, 
  FiMessageSquare, FiSearch, FiCreditCard, FiRefreshCw, FiShoppingBag, FiInfo
} from 'react-icons/fi';
import { Link } from 'react-router-dom';
import Chat from "./Chat"; // 🔥 PHASE 1 FIX: Corrected import path
// 🔥 PHASE 1 FIX: Canonical Axios Instance
import axiosInstance from '../api/axiosInstance';

const HelpCenter = () => {
  const [activeFaq, setActiveFaq] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // 🔥 REAL DATA STATE 🔥
  const [userOrders, setUserOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  // 🔥 CUSTOM CHAT & TOAST STATE 🔥
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatContext, setChatContext] = useState(null); // Will hold order data if clicked from an order
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    window.scrollTo(0, 0);
    
    const fetchOrders = async () => {
      const storedUser = JSON.parse(localStorage.getItem('jack_user'));
      if (storedUser && storedUser.id) {
        setCurrentUser(storedUser);
        try {
          // 🔥 PHASE 1 FIX: Removed localhost and used axiosInstance
          const res = await axiosInstance.get(`/orders/user/${storedUser.id}`);
          setUserOrders(res.data);
        } catch (error) {
          console.error("Orders fetch failed", error);
        }
      }
      setIsLoading(false);
    };
    fetchOrders();
  }, []);

  const faqs = [
    { id: 1, question: "How do I track my Jack Essentials order?", answer: "You can track your order by clicking on the specific product in the 'Recent Orders' section above. You will see real-time updates from our courier partners." },
    { id: 2, question: "What is the return and refund policy?", answer: "We offer a 7-day hassle-free return policy. If you are not satisfied, raise a ticket here and our delivery partner will pick it up." },
    { id: 3, question: "How long does delivery take?", answer: "Standard delivery takes 3-5 business days. Express delivery (where available) takes 1-2 days." },
    { id: 4, question: "My payment failed but money was deducted.", answer: "Don't worry! Failed payments are automatically reversed by your bank within 48-72 hours. If it takes longer, please chat with our support team." }
  ];

  const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } };
  const staggerContainer = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };

  // 🔥 CUSTOM NOTIFICATION TOAST FUNCTION 🔥
  const showCustomToast = (message) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage('');
    }, 3000);
  };

  // 🔥 OPEN CUSTOM CHAT WIDGET 🔥
  const openCustomChat = (orderContext = null) => {
    showCustomToast("Connecting to Support Team...");
    setChatContext(orderContext);
    
    // Adding slight delay to let the toast show before chat slides in
    setTimeout(() => {
      setIsChatOpen(true);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-sans pb-20 relative">
      
      {/* PREMIUM CUSTOM TOAST (Replaces ugly browser alert) */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -50 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-slate-700"
          >
            <div className="w-4 h-4 border-2 border-slate-400 border-t-[#FF4500] rounded-full animate-spin"></div>
            <span className="font-bold text-sm tracking-wide">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* RENDER THE NEW CHAT COMPONENT */}
      <Chat 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)} 
        contextData={chatContext} 
        user={currentUser}
      />

      {/* HEADER SECTION */}
      <div className="bg-slate-900 pt-20 pb-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#FF4500] rounded-full mix-blend-overlay filter blur-[100px] opacity-20 pointer-events-none"></div>
        <div className="max-w-7xl mx-auto relative z-10 text-center">
          <motion.h1 initial="hidden" animate="visible" variants={fadeUp} className="text-4xl md:text-5xl font-black text-white mb-4">
            Jack Essentials <span className="text-[#FF4500]">24×7</span> Help Center
          </motion.h1>
          <motion.p initial="hidden" animate="visible" variants={fadeUp} className="text-slate-400 text-sm md:text-base max-w-2xl mx-auto mb-8">
            Get quick resolutions for your orders, tracking, refunds, and more. Our dedicated AI support and support executives are here to ensure your shopping experience is positive and enjoyable.
          </motion.p>
          
          <motion.div initial="hidden" animate="visible" variants={fadeUp} className="max-w-2xl mx-auto relative">
            <input 
              type="text" 
              placeholder="Search for a topic or issue..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/10 border border-slate-700 text-white placeholder-slate-400 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-[#FF4500] focus:ring-1 focus:ring-[#FF4500] backdrop-blur-sm"
            />
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 relative z-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT SIDEBAR */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 sticky top-24">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Type of Issue</h3>
              <ul className="space-y-2">
                <li><button className="w-full text-left font-bold text-[#FF4500] bg-orange-50 px-4 py-3 rounded-xl transition-all">Help with your orders</button></li>
                <li><button className="w-full text-left font-bold text-slate-600 hover:bg-slate-50 px-4 py-3 rounded-xl transition-all">Payment & Refunds</button></li>
                <li><button className="w-full text-left font-bold text-slate-600 hover:bg-slate-50 px-4 py-3 rounded-xl transition-all">Delivery related</button></li>
                <li><button className="w-full text-left font-bold text-slate-600 hover:bg-slate-50 px-4 py-3 rounded-xl transition-all">Login and my account</button></li>
              </ul>

              <div className="mt-8 pt-8 border-t border-slate-100">
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-5 rounded-2xl text-white">
                  <FiMessageSquare size={24} className="mb-3 text-[#FF4500]" />
                  <h4 className="font-black mb-1">Need instant help?</h4>
                  <p className="text-xs text-slate-400 mb-4">Talk to our AI Chatbot or Human Agents right now.</p>
                  <button onClick={() => openCustomChat()} className="w-full bg-[#FF4500] hover:bg-orange-600 text-white font-bold py-2.5 rounded-lg text-sm transition-all shadow-lg shadow-orange-500/30">
                    Chat with Us
                  </button>
                </div>
                <Link to="/contact" className="block text-center mt-4 text-sm font-bold text-slate-500 hover:text-[#FF4500] transition-colors">
                 View Other Contact Options →
                </Link>
              </div>
            </div>
          </div>

          {/* RIGHT CONTENT AREA */}
          <div className="lg:col-span-9 space-y-8">
            
            {/* Quick Actions */}
            <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <motion.div variants={fadeUp} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center text-center cursor-pointer hover:border-indigo-300 transition-colors">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-3"><FiBox size={20}/></div>
                <span className="font-bold text-sm text-slate-800">Track Order</span>
              </motion.div>
              <motion.div variants={fadeUp} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center text-center cursor-pointer hover:border-orange-300 transition-colors">
                <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center mb-3"><FiRefreshCw size={20}/></div>
                <span className="font-bold text-sm text-slate-800">Return Item</span>
              </motion.div>
              <motion.div variants={fadeUp} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center text-center cursor-pointer hover:border-green-300 transition-colors">
                <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-3"><FiCreditCard size={20}/></div>
                <span className="font-bold text-sm text-slate-800">Refund Status</span>
              </motion.div>
              <motion.div variants={fadeUp} onClick={() => openCustomChat()} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center text-center cursor-pointer hover:border-blue-300 transition-colors">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-3"><FiAlertCircle size={20}/></div>
                <span className="font-bold text-sm text-slate-800">Report Issue</span>
              </motion.div>
            </motion.div>

            {/* 🔥 REAL DATA LOGIC FOR ORDERS 🔥 */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-black text-slate-900">Which item are you facing an issue with?</h2>
                  <p className="text-sm text-slate-500 mt-1">Select an order to view details or start a support chat for it.</p>
                </div>
              </div>
              
              <div className="divide-y divide-slate-100">
                {isLoading ? (
                  <div className="p-12 text-center text-slate-500 font-bold">Loading your orders...</div>
                ) : userOrders.length === 0 ? (
                  <div className="p-12 flex flex-col items-center text-center">
                    <FiShoppingBag size={48} className="text-slate-200 mb-4" />
                    <p className="text-lg font-bold text-slate-800">No Orders Found</p>
                    <p className="text-sm text-slate-500 mt-1 mb-6">Looks like you haven't placed any orders yet.</p>
                    <Link to="/shop" className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-colors">Start Shopping</Link>
                  </div>
                ) : (
                  userOrders.map((order, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row gap-4 sm:gap-6 p-6 hover:bg-slate-50 transition-colors group cursor-default">
                      <Link to={`/order/${order.id}`} className="w-20 h-20 bg-slate-100 rounded-xl overflow-hidden flex-shrink-0 border border-slate-200 block">
                        <img src={order.items[0]?.image} alt="product" className="w-full h-full object-cover" />
                      </Link>
                      
                      <div className="flex-1">
                        <Link to={`/order/${order.id}`} className="block">
                          <h3 className="font-bold text-slate-800 text-base line-clamp-1 hover:text-[#FF4500] transition-colors">{order.items[0]?.title}</h3>
                        </Link>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`w-2 h-2 rounded-full ${['Delivered'].includes(order.status) ? 'bg-green-500' : 'bg-orange-500'}`}></span>
                          <span className="text-sm font-bold text-slate-600">{order.status} on {order.date}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 font-mono">Order ID: {order.id}</p>
                      </div>
                      
                      <div className="sm:self-center flex gap-3">
                         <Link to={`/order/${order.id}`} className="text-slate-600 font-bold text-sm bg-white border border-slate-200 px-4 py-2 rounded-lg hover:bg-slate-100 transition-all whitespace-nowrap text-center">
                           View Details
                         </Link>
                         {/* THIS BUTTON PASSES CONTEXT TO OUR NEW CHAT */}
                         <button onClick={() => openCustomChat(order)} className="text-[#FF4500] font-bold text-sm bg-orange-50 border border-orange-100 px-4 py-2 rounded-lg hover:bg-[#FF4500] hover:text-white transition-all whitespace-nowrap flex items-center gap-2">
                           <FiMessageSquare size={16}/> Need Help
                         </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>

            {/* FAQ Section */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8">
              <h2 className="text-xl font-black text-slate-900 mb-6">Frequently Asked Questions</h2>
              <div className="space-y-4">
                {faqs.map((faq, index) => (
                  <div key={faq.id} className="border border-slate-200 rounded-2xl overflow-hidden transition-all">
                    <button 
                      onClick={() => setActiveFaq(activeFaq === index ? null : index)}
                      className="w-full flex justify-between items-center p-5 bg-white hover:bg-slate-50 transition-colors text-left"
                    >
                      <span className="font-bold text-slate-800 pr-4">{faq.question}</span>
                      {activeFaq === index ? <FiChevronUp className="text-[#FF4500] flex-shrink-0" size={20} /> : <FiChevronDown className="text-slate-400 flex-shrink-0" size={20} />}
                    </button>
                    <AnimatePresence>
                      {activeFaq === index && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }} 
                          animate={{ height: "auto", opacity: 1 }} 
                          exit={{ height: 0, opacity: 0 }}
                          className="bg-slate-50 border-t border-slate-100"
                        >
                          <div className="p-5 text-sm text-slate-600 leading-relaxed">
                            {faq.answer}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </motion.div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpCenter;