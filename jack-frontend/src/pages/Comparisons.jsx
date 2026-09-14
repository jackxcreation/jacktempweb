// jack-frontend/src/pages/Comparisons.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiArrowRight, FiSearch, FiAlertCircle, FiLayers } from 'react-icons/fi';
// 🔥 Canonical Axios Instance
import axiosInstance from '../api/axiosInstance';

const Comparisons = ({ isLoggedIn, setIsLoggedIn }) => {
  const [comparisons, setComparisons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState(''); // 🔥 Pro feature: Real-time search filter

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchComparisons();
  }, []);

  const fetchComparisons = async () => {
    setLoading(true);
    setError(null);
    try {
      // 🔥 Removed `/api` prefix because axiosInstance already maps to /api
      const res = await axiosInstance.get('/content?type=comparison');
      if (res?.data?.success) {
        setComparisons(res.data.posts || res.data.comparisons || []);
      } else {
        setComparisons(res.data || []);
      }
    } catch (err) {
      console.error("Failed to load comparisons:", err);
      setError("Failed to load comparison guides. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  // Filter comparisons based on search input
  const filteredComparisons = comparisons.filter(item => 
    item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.excerpt?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-sans pb-24">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
        {/* Header Section */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-2xl mx-auto mb-10"
        >
          <span className="bg-orange-100 text-[#FF4500] text-xs font-black px-3.5 py-1.5 rounded-full uppercase tracking-widest mb-3 inline-flex items-center gap-1.5 shadow-sm">
            <FiLayers size={14} /> Expert Face-offs
          </span>
          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight">Product Comparisons & Verdicts</h1>
          <p className="text-slate-500 text-sm sm:text-base mt-3 font-medium leading-relaxed">
            Detailed specs, pros, cons, and unbiased comparisons to help you buy the right product with complete confidence.
          </p>
        </motion.div>

        {/* 🔥 Pro Feature: Real-time Search Filter Bar */}
        {!loading && comparisons.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md mx-auto mb-12 relative"
          >
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder="Search comparisons (e.g., iPhone vs Samsung)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-2xl py-3.5 pl-12 pr-4 text-sm font-medium text-slate-900 shadow-sm focus:outline-none focus:border-[#FF4500] focus:ring-2 focus:ring-[#FF4500]/10 transition-all placeholder:text-slate-400"
            />
          </motion.div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-12 h-12 border-4 border-slate-200 border-t-[#FF4500] rounded-full animate-spin"></div>
            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Loading Expert Reviews...</p>
          </div>
        ) : error ? (
          /* Error State */
          <div className="max-w-md mx-auto bg-white p-8 rounded-3xl border border-red-100 shadow-sm text-center">
            <FiAlertCircle className="mx-auto text-red-500 mb-3" size={40} />
            <h3 className="text-lg font-black text-slate-900 mb-1">Oops! Something went wrong</h3>
            <p className="text-slate-500 text-xs mb-6 font-medium">{error}</p>
            <button 
              onClick={fetchComparisons}
              className="bg-slate-900 hover:bg-[#FF4500] text-white text-xs font-bold px-6 py-3 rounded-xl transition-all cursor-pointer"
            >
              Try Again
            </button>
          </div>
        ) : filteredComparisons.length === 0 ? (
          /* Empty State */
          <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm max-w-lg mx-auto p-8">
            <h3 className="text-xl font-black text-slate-900 mb-2">No Comparisons Found</h3>
            <p className="text-slate-500 text-sm mb-6">We couldn't find any comparison guides matching "{searchTerm}".</p>
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="bg-slate-900 hover:bg-[#FF4500] text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all cursor-pointer"
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          /* Comparisons Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {filteredComparisons.map((item, index) => (
              <motion.div 
                key={item._id || index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-xl hover:border-slate-200 transition-all duration-300 group"
              >
                <div>
                  <div className="w-full h-52 bg-slate-100 rounded-2xl mb-6 overflow-hidden relative">
                    <img 
                      src={item.featuredImage || 'https://via.placeholder.com/600x400?text=Jack+Essentials'} 
                      alt={item.title} 
                      loading="lazy"
                      onError={(e) => { e.target.src = 'https://via.placeholder.com/600x400?text=Jack+Essentials'; }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  </div>
                  
                  <h2 className="text-xl font-black text-slate-900 mb-3 group-hover:text-[#FF4500] transition-colors leading-snug">
                    {item.title}
                  </h2>
                  <p className="text-slate-500 text-sm mb-6 line-clamp-2 font-medium leading-relaxed">
                    {item.excerpt || item.description}
                  </p>
                </div>
                
                <Link 
                  to={`/comparisons/${item.slug || item._id}`} 
                  className="bg-slate-900 hover:bg-[#FF4500] text-white font-bold py-4 px-6 rounded-2xl text-center transition-all flex items-center justify-center gap-2 text-sm shadow-sm active:scale-95 cursor-pointer"
                >
                  Read Full Comparison <FiArrowRight className="group-hover:translate-x-1 transition-transform" />
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Comparisons;