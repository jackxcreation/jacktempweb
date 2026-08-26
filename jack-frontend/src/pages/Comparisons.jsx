import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiCheck, FiX, FiTrendingUp, FiArrowRight } from 'react-icons/fi';
import Navbar from '../components/Navbar';
import axiosInstance from '../api/axiosInstance';

const Comparisons = ({ isLoggedIn, setIsLoggedIn }) => {
  const [comparisons, setComparisons] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.scrollTo(0, 0);
    const fetchComparisons = async () => {
      try {
        const res = await axiosInstance.get('/api/content?type=comparison');
        if (res.data.success) setComparisons(res.data.posts);
      } catch (err) {
        console.error("Failed to load comparisons");
      } finally {
        setLoading(false);
      }
    };
    fetchComparisons();
  }, []);

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-sans pb-24">
      <Navbar isLoggedIn={isLoggedIn} setIsLoggedIn={setIsLoggedIn} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="bg-orange-100 text-[#FF4500] text-xs font-black px-3 py-1.5 rounded-full uppercase tracking-widest mb-3 inline-block">Expert Face-offs</span>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Product Comparisons & Verdicts</h1>
          <p className="text-slate-500 text-sm mt-3 font-medium">Detailed specs, pros, cons, and unbiased comparisons to help you buy the right product.</p>
        </div>

        {loading ? (
          <div className="text-center py-20"><div className="w-10 h-10 border-4 border-slate-200 border-t-[#FF4500] rounded-full animate-spin mx-auto"></div></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {comparisons.map((item) => (
              <div key={item._id} className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                  <img src={item.featuredImage} alt={item.title} className="w-full h-48 object-cover rounded-2xl mb-6 bg-slate-50" />
                  <h2 className="text-xl font-black text-slate-900 mb-2">{item.title}</h2>
                  <p className="text-slate-500 text-sm mb-6 line-clamp-2">{item.excerpt}</p>
                </div>
                <Link to={`/comparisons/${item.slug}`} className="bg-slate-900 hover:bg-[#FF4500] text-white font-bold py-3.5 px-6 rounded-xl text-center transition-all flex items-center justify-center gap-2 text-sm">
                  Read Full Comparison <FiArrowRight />
                </Link>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Comparisons;