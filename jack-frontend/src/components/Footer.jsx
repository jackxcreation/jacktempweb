import React, { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiFacebook, FiTwitter, FiInstagram, FiYoutube, FiArrowRight, 
  FiMail, FiPhone, FiMapPin, FiShield, FiTruck, FiRefreshCw, 
  FiCheckCircle, FiAlertCircle 
} from 'react-icons/fi';
import { useSettings } from '../context/SettingsContext';
import { API_URL } from '../config';

// Reusable animated link component
const FooterLink = ({ to, text }) => (
  <li>
    <Link 
      to={to} 
      className="text-slate-400 hover:text-[#FF4500] text-sm font-medium transition-all duration-300 flex items-center group"
    >
      <span className="w-0 h-px bg-[#FF4500] mr-0 transition-all duration-300 group-hover:w-3 group-hover:mr-2"></span>
      {text}
    </Link>
  </li>
);

const Footer = () => {
  const { settings } = useSettings();
  
  // 🔥 Custom Animated Toast State 🔥
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [isLoading, setIsLoading] = useState(false);

  // Subscription Logic
  const handleSubscribe = async (e) => {
    e.preventDefault();
    const email = e.target.email.value;
    setIsLoading(true);
    
    try {
      await axios.post(`${API_URL}/subscribe`, { email });
      setToast({ show: true, message: "Welcome to the VIP club! 🎉", type: 'success' });
      e.target.reset(); 
    } catch (err) {
      setToast({ show: true, message: "You're already on our list! 😉", type: 'error' });
    }
    
    setIsLoading(false);

    // 3 second baad toast auto-hide ho jayega
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 3000);
  };

  const getSocialUrl = (url) => {
    if (!url || url === "#" || url.trim() === "") return "#";
    return url.startsWith('http') ? url : `https://${url}`;
  };

  const aboutText = settings?.footerAbout || "Upgrade your lifestyle with our premium collection of electronics, fashion, and daily essentials. Designed for the modern Indian.";
  
  // 🔥 UPDATED: Added "About Us" to balance the list
  const shopLinks = [
    { title: "About Us", url: "/about" },
    { title: "Electronics", url: "/shop/electronics" },
    { title: "Men's Fashion", url: "/shop/fashion" },
    { title: "Home & Living", url: "/shop/home" },
    { title: "Super Offers 🔥", url: "/shop" }
  ];

  // 🔥 UPDATED: Added all Legal, Support, and Tracking links here
  const supportLinks = [
    { title: "Track Your Order", url: "/track-order" },
    { title: "Returns & Refunds", url: "/returns" },
    { title: "Help Center / FAQ", url: "/help-center" },
    { title: "Contact Us", url: "/contact" },
    { title: "Terms of Service", url: "/terms" },
    { title: "Privacy Policy", url: "/privacy-policy" }
  ];

  return (
    <footer className="bg-[#0B0F19] pt-16 pb-8 border-t border-slate-800 font-sans relative overflow-hidden">
      
      {/* 🔥 ANIMATED TOAST NOTIFICATION 🔥 */}
      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className={`fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] px-6 py-3.5 rounded-full shadow-2xl flex items-center gap-3 font-bold text-sm tracking-wide ${
              toast.type === 'success' ? 'bg-[#FF4500] text-white' : 'bg-slate-800 border border-slate-700 text-slate-200'
            }`}
          >
            {toast.type === 'success' ? <FiCheckCircle size={18} /> : <FiAlertCircle size={18} className="text-orange-400" />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Glow Effect */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-[#FF4500] opacity-[0.03] blur-[100px] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* ================= MAIN GRID ================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 lg:gap-8 mb-16">
          
          {/* 1. BRAND & NEWSLETTER */}
          <div className="lg:col-span-4 space-y-6">
            <Link to="/" className="flex items-center space-x-2 outline-none inline-block">
              <span className="text-4xl font-black tracking-tighter text-white">
                J<span className="text-[#FF4500]">E</span>
              </span>
              <span className="text-xl font-bold tracking-widest text-slate-200 uppercase mt-1">Jack Essentials</span>
            </Link>
            
            <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
              {aboutText}
            </p>
            
            <div className="pt-2">
              <p className="text-white font-bold text-sm mb-3 uppercase tracking-widest">Subscribe to Insider Emails</p>
              
              {/* Subscription Form */}
              <form onSubmit={handleSubscribe} className="flex relative max-w-sm group">
                <input 
                  name="email"
                  type="email" 
                  required
                  placeholder="Enter your email address" 
                  className="w-full bg-slate-800/50 border border-slate-700 text-white text-sm rounded-xl py-3.5 pl-4 pr-12 focus:outline-none focus:border-[#FF4500] focus:ring-1 focus:ring-[#FF4500] transition-all placeholder:text-slate-500"
                />
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-[#FF4500] hover:bg-orange-600 text-white p-2 rounded-lg transition-colors active:scale-95 disabled:opacity-50"
                >
                  {isLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <FiArrowRight size={18} />}
                </button>
              </form>
            </div>
          </div>

          {/* 2. QUICK LINKS */}
          <div className="lg:col-span-2 lg:col-start-6">
            <h3 className="text-white font-black text-sm uppercase tracking-widest mb-6">Quick Links</h3>
            <ul className="space-y-4">
              {shopLinks.map((link, index) => (
                <FooterLink key={index} to={link.url} text={link.title} />
              ))}
            </ul>
          </div>

          {/* 3. SUPPORT & LEGAL */}
          <div className="lg:col-span-2">
            <h3 className="text-white font-black text-sm uppercase tracking-widest mb-6">Support & Legal</h3>
            <ul className="space-y-4">
              {supportLinks.map((link, index) => (
                <FooterLink key={index} to={link.url} text={link.title} />
              ))}
            </ul>
          </div>

          {/* 4. COMPANY INFO */}
          <div className="lg:col-span-3">
            <h3 className="text-white font-black text-sm uppercase tracking-widest mb-6">Reach Us</h3>
            <ul className="space-y-5">
              <li className="flex items-start text-slate-400 text-sm group">
                <FiMapPin className="mt-1 mr-3 text-slate-500 group-hover:text-[#FF4500] flex-shrink-0 transition-colors" size={18} />
                <span>Jack Essentials Headquarters,<br/>Cuttack, Odisha, 754132<br/>India</span>
              </li>
              <li className="flex items-center text-slate-400 text-sm group hover:text-white transition-colors cursor-pointer">
                <FiMail className="mr-3 text-slate-500 group-hover:text-[#FF4500] transition-colors" size={18} />
                support@thejackessentials.com
              </li>
              <li className="flex items-center text-slate-400 text-sm group hover:text-white transition-colors cursor-pointer">
                <FiPhone className="mr-3 text-slate-500 group-hover:text-[#FF4500] transition-colors" size={18} />
                +91 911-436-9743
              </li>
            </ul>

            {/* Social Icons */}
            <div className="flex items-center space-x-4 mt-8">
              <a href={getSocialUrl(settings?.socialLinks?.instagram)} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-[#FF4500] hover:text-white transition-all"><FiInstagram size={18} /></a>
              <a href={getSocialUrl(settings?.socialLinks?.twitter)} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-[#FF4500] hover:text-white transition-all"><FiTwitter size={18} /></a>
              <a href={getSocialUrl(settings?.socialLinks?.facebook)} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-[#FF4500] hover:text-white transition-all"><FiFacebook size={18} /></a>
              <a href={getSocialUrl(settings?.socialLinks?.youtube)} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-[#FF4500] hover:text-white transition-all"><FiYoutube size={18} /></a>
            </div>
          </div>
        </div>

        {/* TRUST BADGES */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 py-8 border-t border-slate-800/80">
          <div className="flex items-center justify-center sm:justify-start space-x-3 text-slate-300">
            <FiTruck className="text-[#FF4500]" size={24} />
            <div><p className="font-bold text-sm">Free Delivery</p><p className="text-xs text-slate-500">On All Orders</p></div>
          </div>
          <div className="flex items-center justify-center space-x-3 text-slate-300">
            <FiRefreshCw className="text-[#FF4500]" size={24} />
            <div><p className="font-bold text-sm">7 Days Return</p><p className="text-xs text-slate-500">No questions asked</p></div>
          </div>
          <div className="flex items-center justify-center sm:justify-end space-x-3 text-slate-300">
            <FiShield className="text-[#FF4500]" size={24} />
            <div><p className="font-bold text-sm">100% Secure</p><p className="text-xs text-slate-500">Encrypted payments</p></div>
          </div>
        </div>

        {/* BOTTOM BAR */}
        <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-slate-800/80 gap-4">
          <div className="text-slate-500 text-xs text-center md:text-left">
            <p>&copy; {new Date().getFullYear()} Jack Essentials Inc. All Rights Reserved.</p>
          </div>
          <div className="flex items-center gap-2">
            {['UPI', 'VISA', 'MasterCard', 'RuPay'].map(card => (
              <span key={card} className="px-2 py-1 bg-slate-800 text-slate-300 text-[10px] font-black tracking-wider rounded border border-slate-700">{card}</span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;