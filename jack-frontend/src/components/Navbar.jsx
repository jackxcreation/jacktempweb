import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSearch, FiShoppingCart, FiUser, FiMenu, FiHeart, FiX, FiHome, FiGrid } from 'react-icons/fi';
import { useCart } from '../context/CartContext';
import { useUser } from '../context/UserContext'; 
import { LanguageSelector } from './LanguageSelector'; // 🔥 ADDED: Multi-lingual selector component

const Navbar = ({ isLoggedIn }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { cart, cartCount } = useCart(); // 🔥 FIX: Destructured cartCount from useCart for accurate total quantity tracking
  const { user, logoutUser } = useUser(); 
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const totalItems = cartCount !== undefined ? cartCount : cart.length; // 🔥 FIX: Using cartCount so multi-quantity items count correctly

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = () => {
    logoutUser();
    navigate('/login');
  };

  return (
    <>
      <header className={`w-full sticky top-0 z-50 transition-all duration-300 bg-white ${scrolled ? 'shadow-lg shadow-slate-200/50' : 'border-b border-slate-200'}`}>
        
        {/* ================= TOP NAV (High Contrast Premium Theme) ================= */}
        <div className="px-4 py-3 md:px-8 flex items-center justify-between">
          
          {/* Logo & Mobile Menu Toggle */}
          <div className="flex items-center gap-4">
            <button 
              className="md:hidden text-slate-800 hover:text-[#FF4500] transition-colors"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <FiX size={26} /> : <FiMenu size={26} />}
            </button>
            
            <Link to="/" className="flex items-center space-x-2 group outline-none">
              {/* 🔥 FIXED: High Contrast Logo (JE) 🔥 */}
              <span className="text-3xl sm:text-4xl font-black tracking-tighter text-slate-900 group-hover:scale-105 transition-transform">
                J<span className="text-[#FF4500]">E</span>
              </span>
              <span className="text-lg sm:text-xl font-bold tracking-widest text-slate-800 hidden lg:block uppercase mt-1">Jack Essentials</span>
            </Link>
          </div>

          {/* Centered Search Bar (Desktop) */}
          <div className="hidden md:flex flex-1 max-w-2xl mx-10 relative group">
            <input 
              type="text" 
              placeholder="Search premium products, brands..." 
              className="w-full py-3 pl-6 pr-14 rounded-full text-slate-900 bg-slate-100/80 border border-transparent focus:bg-white focus:outline-none focus:border-[#FF4500]/50 focus:ring-4 focus:ring-[#FF4500]/10 transition-all placeholder:text-slate-400 font-medium shadow-inner"
            />
            <button className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-500 hover:text-[#FF4500] hover:bg-orange-50 transition-colors rounded-full">
              <FiSearch size={22} />
            </button>
          </div>

          {/* Action Icons (Right Side) */}
          <div className="flex items-center space-x-5 sm:space-x-7 text-slate-700">
            
            {/* 🔥 Multi-Lingual Selector */}
            <div className="hidden lg:block">
              <LanguageSelector />
            </div>

            {/* Personalized User Profile */}
            <div className="hidden sm:flex items-center">
              {isLoggedIn && user ? (
                <Link to="/profile" className="flex items-center gap-3 hover:text-[#FF4500] transition-colors group">
                  <div className="w-11 h-11 rounded-full bg-slate-900 text-white flex items-center justify-center text-lg font-black shadow-md group-hover:bg-[#FF4500] transition-colors">
                    {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="flex flex-col hidden xl:flex">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-1">Welcome</span>
                    <span className="text-sm font-black text-slate-900 leading-none truncate max-w-[100px] group-hover:text-[#FF4500]">{user.name.split(' ')[0]}</span>
                  </div>
                </Link>
              ) : (
                <Link to="/login" className="flex flex-col items-center hover:text-[#FF4500] transition-colors">
                  <FiUser size={24} className="stroke-[2px]" />
                  <span className="text-[10px] font-black uppercase tracking-wider mt-1.5">Sign In</span>
                </Link>
              )}
            </div>
            
            {/* 🔥 FIX: Wishlist link updated to /wishlist instead of /profile */}
            <Link to="/wishlist" className="hidden sm:flex flex-col items-center hover:text-[#FF4500] transition-colors">
              <FiHeart size={24} className="stroke-[2px]" />
              <span className="text-[10px] font-black uppercase tracking-wider mt-1.5">Wishlist</span>
            </Link>

            {/* Cart */}
            <Link to="/cart" className="flex flex-col items-center hover:text-[#FF4500] transition-colors relative group outline-none">
              <motion.div 
                key={totalItems} 
                animate={totalItems > 0 ? { scale: [1, 1.2, 1], rotate: [0, -10, 10, 0] } : {}} 
                transition={{ duration: 0.3 }}
                className="relative"
              >
                <FiShoppingCart size={24} className="stroke-[2px]" />
                <AnimatePresence>
                  {totalItems > 0 && (
                    <motion.span 
                      initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                      className="absolute -top-2 -right-2 bg-[#FF4500] text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-sm"
                    >
                      {totalItems}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
              <span className="text-[10px] font-black uppercase tracking-wider mt-1.5 hidden sm:block">Cart</span>
            </Link>
          </div>
        </div>

        {/* ================= BOTTOM NAV (Categories) ================= */}
        <div className="px-4 md:px-8 py-3.5 hidden md:flex items-center space-x-8 text-sm font-bold text-slate-600 bg-slate-50/50 border-t border-slate-100">
          <Link to="/shop" className="flex items-center text-slate-900 hover:text-[#FF4500] transition-colors group">
            <FiGrid className="mr-2 group-hover:rotate-12 transition-transform text-[#FF4500]" size={18}/> Shop All
          </Link>
          <div className="w-px h-5 bg-slate-300"></div>
          <Link to="/shop" className="hover:text-[#FF4500] transition-colors">Electronics</Link>
          <Link to="/shop" className="hover:text-[#FF4500] transition-colors">Fashion</Link>
          <Link to="/shop" className="hover:text-[#FF4500] transition-colors">Home & Living</Link>
          <Link to="/shop" className="text-slate-900 flex items-center ml-auto bg-orange-100/50 px-5 py-2 rounded-full border border-orange-200 hover:bg-orange-100 transition-colors shadow-sm">
            <span className="animate-pulse mr-2 text-lg">🔥</span> <span className="font-black text-[#FF4500] tracking-wide">Super Offers</span>
          </Link>
        </div>
      </header>

      {/* ================= MOBILE BOTTOM NAVIGATION ================= */}
      <div className="md:hidden fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 flex justify-around items-center py-3 z-50 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] pb-safe">
        <Link to="/" className={`flex flex-col items-center gap-1.5 ${location.pathname === '/' ? 'text-[#FF4500]' : 'text-slate-500'}`}>
          <FiHome size={22} className={location.pathname === '/' ? 'fill-orange-100 stroke-[2px]' : 'stroke-[2px]'} />
          <span className="text-[10px] font-black tracking-wide">Home</span>
        </Link>
        <Link to="/shop" className={`flex flex-col items-center gap-1.5 ${location.pathname === '/shop' ? 'text-[#FF4500]' : 'text-slate-500'}`}>
          <FiGrid size={22} className="stroke-[2px]" />
          <span className="text-[10px] font-black tracking-wide">Shop</span>
        </Link>
        <Link to="/profile" className={`flex flex-col items-center gap-1.5 ${location.pathname === '/profile' ? 'text-[#FF4500]' : 'text-slate-500'}`}>
          <FiUser size={22} className="stroke-[2px]" />
          <span className="text-[10px] font-black tracking-wide">Account</span>
        </Link>
      </div>

      {/* ================= MOBILE MENU DRAWER ================= */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 md:hidden"
            />
            <motion.div 
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 w-[85%] max-w-sm h-full bg-white z-50 shadow-2xl flex flex-col md:hidden"
            >
              <div className="p-6 bg-white border-b border-slate-100 flex justify-between items-center">
                <span className="text-3xl font-black tracking-tighter text-slate-900">J<span className="text-[#FF4500]">E</span></span>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2.5 bg-slate-100 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors"><FiX size={22}/></button>
              </div>
              
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-4">
                {isLoggedIn && user ? (
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-2xl shadow-lg">{user.name ? user.name.charAt(0).toUpperCase() : 'U'}</div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Welcome back</p>
                      <p className="font-black text-xl text-slate-900 leading-none">{user.name}</p>
                      <p className="text-xs text-slate-500 mt-1.5 font-medium">{user.email}</p>
                    </div>
                  </div>
                ) : (
                  <Link to="/login" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 w-full bg-slate-900 text-white p-4 rounded-xl justify-center font-black tracking-wide shadow-lg active:scale-95 transition-transform">
                    <FiUser size={20} /> SIGN IN / REGISTER
                  </Link>
                )}
                <div className="pt-2">
                  <LanguageSelector />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto py-6">
                <nav className="flex flex-col space-y-2 px-4">
                  <Link to="/" onClick={() => setIsMobileMenuOpen(false)} className="px-4 py-3.5 text-slate-800 font-black tracking-wide hover:bg-slate-100 rounded-xl flex items-center gap-4 text-lg"><FiHome className="text-slate-400" size={22}/> Home</Link>
                  <Link to="/shop" onClick={() => setIsMobileMenuOpen(false)} className="px-4 py-3.5 text-slate-800 font-black tracking-wide hover:bg-slate-100 rounded-xl flex items-center gap-4 text-lg"><FiGrid className="text-slate-400" size={22}/> Shop All</Link>
                  <Link to="/profile" onClick={() => setIsMobileMenuOpen(false)} className="px-4 py-3.5 text-slate-800 font-black tracking-wide hover:bg-slate-100 rounded-xl flex items-center gap-4 text-lg"><FiUser className="text-slate-400" size={22}/> My Account</Link>
                  {/* 🔥 FIX: Mobile menu wishlist link updated to /wishlist */}
                  <Link to="/wishlist" onClick={() => setIsMobileMenuOpen(false)} className="px-4 py-3.5 text-slate-800 font-black tracking-wide hover:bg-slate-100 rounded-xl flex items-center gap-4 text-lg"><FiHeart className="text-slate-400" size={22}/> Wishlist</Link>
                </nav>
              </div>

              {isLoggedIn && (
                <div className="p-6 border-t border-slate-100">
                  <button onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }} className="w-full py-4 text-red-600 font-black bg-red-50 hover:bg-red-100 rounded-xl transition-colors tracking-widest flex justify-center items-center gap-2">
                    <FiX size={18} /> LOGOUT
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;