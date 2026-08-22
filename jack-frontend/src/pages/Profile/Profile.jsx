import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiUser, FiPackage, FiSettings, FiLogOut, FiMapPin, FiCreditCard, FiAward, FiShield, FiCheckCircle } from 'react-icons/fi';
import Navbar from "../../components/Navbar";
import { useUser } from "../../context/UserContext";

// Import all Tab Components
import PersonalInfo from './PersonalInfo';
import AddressBook from './AddressBook';
import OrderHistory from './OrderHistory';
import AccountSettings from './AccountSettings';

const Profile = ({ isLoggedIn, setIsLoggedIn }) => {
  const navigate = useNavigate();
  const { user, logoutUser } = useUser();
  const [activeTab, setActiveTab] = useState('info');
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  if (!user) return null;

  const handleLogout = () => {
    logoutUser();
    if (setIsLoggedIn) setIsLoggedIn(false);
    navigate('/login');
  };

  const showToast = (msg, isError = false) => {
    setToastMsg({ text: msg, isError });
    setTimeout(() => setToastMsg(''), 3000);
  };

  const TABS = [
    { id: 'info', name: 'Personal Info', icon: <FiUser size={18} /> },
    { id: 'addresses', name: 'Saved Addresses', icon: <FiMapPin size={18} /> },
    { id: 'orders', name: 'Order History', icon: <FiPackage size={18} /> },
    { id: 'settings', name: 'Account Settings', icon: <FiSettings size={18} /> }
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-sans pb-24 relative">
      <Navbar isLoggedIn={isLoggedIn} setIsLoggedIn={setIsLoggedIn} />

      {/* 🔥 PREMIUM TOAST 🔥 */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3.5 rounded-2xl shadow-xl z-50 font-bold text-sm flex items-center space-x-3
              ${toastMsg.isError ? 'bg-red-50 border border-red-200 text-red-600' : 'bg-slate-900 text-white'}`}
          >
            {toastMsg.isError ? <FiShield size={18}/> : <FiCheckCircle size={18} className="text-green-400"/>}
            <span>{toastMsg.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* ================= SIDEBAR ================= */}
          <div className="w-full lg:w-80 flex-shrink-0 space-y-6">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 sm:p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#FF4500]/10 to-transparent rounded-bl-full pointer-events-none"></div>
              
              <div className="flex items-center space-x-4 mb-6 relative z-10">
                <div className="w-16 h-16 bg-slate-900 text-white rounded-2xl flex items-center justify-center text-3xl font-black shadow-lg">
                  {user.name ? user.name.charAt(0).toUpperCase() : 'J'}
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-xl leading-tight">{user.name}</h3>
                  <div className="flex items-center text-[#FF4500] font-bold text-xs mt-1 uppercase tracking-widest">
                    <FiAward className="mr-1" /> Elite Member
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-4 text-white flex justify-between items-center shadow-md mb-8">
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">Jack Wallet</p>
                  <p className="text-xl font-black">₹0.00</p>
                </div>
                <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <FiCreditCard size={18} />
                </div>
              </div>

              <nav className="space-y-1.5 relative z-10">
                {TABS.map(tab => (
                  <button 
                    key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center px-4 py-3.5 rounded-xl font-bold transition-all ${activeTab === tab.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                  >
                    <span className={`mr-3 ${activeTab === tab.id ? 'text-indigo-600' : 'text-slate-400'}`}>{tab.icon}</span> {tab.name}
                  </button>
                ))}
                <div className="w-full h-px bg-slate-100 my-4"></div>
                <button onClick={handleLogout} className="w-full flex items-center px-4 py-3.5 rounded-xl font-bold text-red-500 hover:bg-red-50 transition-all">
                  <span className="mr-3 text-red-400"><FiLogOut size={18}/></span> Secure Logout
                </button>
              </nav>
            </div>
          </div>

          {/* ================= MAIN TAB CONTENT ================= */}
          <div className="flex-1">
            <AnimatePresence mode="wait">
              {activeTab === 'info' && <PersonalInfo key="info" showToast={showToast} />}
              {activeTab === 'addresses' && <AddressBook key="addresses" showToast={showToast} />}
              {activeTab === 'orders' && <OrderHistory key="orders" />}
              {activeTab === 'settings' && <AccountSettings key="settings" />}
            </AnimatePresence>
          </div>

        </div>
      </main>
    </div>
  );
};

export default Profile;