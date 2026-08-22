import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { FiCpu, FiGlobe, FiHeart, FiTarget, FiZap, FiShoppingBag } from "react-icons/fi";

export default function AboutUs() {
  // Animation Variants
  const fadeUp = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.2 } }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-200 font-sans pb-20 overflow-hidden">
      
      {/* 1. HERO SECTION */}
      <div className="relative pt-32 pb-20 px-6 text-center lg:pt-40 lg:pb-28">
        {/* Glow Effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl h-64 bg-[#FF4500] opacity-10 blur-[120px] pointer-events-none"></div>
        
        <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="relative z-10 max-w-4xl mx-auto">
          <motion.span variants={fadeUp} className="text-[#FF4500] font-bold tracking-widest uppercase text-sm mb-4 block">
            The Jack Essentials Story
          </motion.span>
          <motion.h1 variants={fadeUp} className="text-4xl md:text-6xl lg:text-7xl font-black text-white leading-tight mb-6 tracking-tighter">
            We Didn't Just Build a Store. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF4500] to-orange-400">
              We Built the Future.
            </span>
          </motion.h1>
          <motion.p variants={fadeUp} className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            From daily essentials to premium lifestyle upgrades, we are redefining how the world shops—one smart click at a time.
          </motion.p>
        </motion.div>
      </div>

      {/* 2. THE ORIGIN STORY (Emotional Core) */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        <motion.div 
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={fadeUp}
          className="bg-slate-800/50 border border-slate-700/50 rounded-3xl p-8 md:p-14 relative overflow-hidden"
        >
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-black text-white">It Started With a Simple Question.</h2>
              <p className="text-slate-400 leading-relaxed text-lg">
                While scrolling through giant platforms like Amazon and Flipkart, our founder realized a massive gap. Shopping felt robotic, cluttered, and disconnected. He thought, <em>"Why can't we build something better? Something smarter and more personal?"</em>
              </p>
              <p className="text-slate-400 leading-relaxed text-lg">
                That single thought sparked a revolution. Jack Essentials wasn't funded by million-dollar investors. It was built from scratch, fueled by countless sleepless nights, endless lines of code, and an unbreakable vision to create a world-class shopping experience.
              </p>
            </div>
            
            {/* The Founder Highlight */}
            <div className="bg-[#0B0F19] p-8 rounded-2xl border border-slate-700 shadow-2xl relative group hover:border-[#FF4500]/50 transition-colors duration-500">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#FF4500] opacity-10 rounded-bl-full group-hover:opacity-20 transition-opacity"></div>
              <FiHeart className="text-[#FF4500] w-10 h-10 mb-6" />
              <h3 className="text-xl font-bold text-white mb-2">Chandan Tripathy</h3>
              <p className="text-[#FF4500] font-medium text-sm uppercase tracking-wider mb-4">Founder & Lead Developer</p>
              <p className="text-slate-400 text-sm leading-relaxed italic">
                "Coming from a middle-class family in Cuttack, Odisha, I didn't have massive resources. Just a laptop, a dream, and the stubbornness to build an e-commerce platform that could compete on a global scale. Jack Essentials is proof that if you can code it, you can conquer it."
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* 3. OUR VISION & STRENGTHS */}
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-black text-white mb-4">Why We Stand Out</h2>
          <p className="text-slate-400 max-w-2xl mx-auto">We aren't just selling products; we are crafting an ecosystem. Here is how we are changing the game.</p>
        </div>

        <motion.div 
          initial="hidden" whileInView="visible" viewport={{ once: true }} variants={staggerContainer}
          className="grid md:grid-cols-3 gap-6"
        >
          {/* Card 1 */}
          <motion.div variants={fadeUp} className="bg-slate-800/30 p-8 rounded-3xl border border-slate-700 hover:bg-slate-800/60 transition-colors">
            <div className="w-14 h-14 bg-[#FF4500]/10 rounded-2xl flex items-center justify-center mb-6">
              <FiCpu className="text-[#FF4500] w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">100% AI-Driven Workflow</h3>
            <p className="text-slate-400 text-sm leading-relaxed mb-4">
              We are actively building a revolutionary AI ecosystem. Soon, you won't need menus. You'll simply chat with our AI to order, track, cancel, or find the perfect product instantly.
            </p>
            <span className="inline-block px-3 py-1 bg-[#FF4500]/20 text-[#FF4500] text-xs font-bold uppercase tracking-wider rounded-full">In Production</span>
          </motion.div>

          {/* Card 2 */}
          <motion.div variants={fadeUp} className="bg-slate-800/30 p-8 rounded-3xl border border-slate-700 hover:bg-slate-800/60 transition-colors">
            <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6">
              <FiShoppingBag className="text-blue-500 w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Everything, For Everyone</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              We don't restrict ourselves to one niche. From cutting-edge electronics and trending fashion to daily home essentials, we curate top-tier products to cater to every modern household's needs.
            </p>
          </motion.div>

          {/* Card 3 */}
          <motion.div variants={fadeUp} className="bg-slate-800/30 p-8 rounded-3xl border border-slate-700 hover:bg-slate-800/60 transition-colors">
            <div className="w-14 h-14 bg-green-500/10 rounded-2xl flex items-center justify-center mb-6">
              <FiGlobe className="text-green-500 w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Born in India, Built for the World</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              While our roots are proudly grounded in Cuttack, our vision has no borders. We are actively scaling our infrastructure to take Jack Essentials from a national favorite to a multinational powerhouse.
            </p>
          </motion.div>
        </motion.div>
      </div>

      {/* 4. CALL TO ACTION */}
      <motion.div 
        initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
        className="max-w-4xl mx-auto px-6 py-16 text-center"
      >
        <div className="bg-gradient-to-r from-[#FF4500] to-orange-500 rounded-3xl p-10 md:p-16 shadow-2xl relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">Be Part of Our Journey</h2>
            <p className="text-white/90 text-lg mb-8 max-w-xl mx-auto">
              We are building the future of e-commerce, and we want you with us. Experience the difference today.
            </p>
            <Link to="/shop">
              <button className="bg-white text-[#FF4500] font-black text-lg px-8 py-4 rounded-full shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300">
                Start Shopping Now
              </button>
            </Link>
          </div>
          {/* Abstract Background Shapes */}
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3 w-64 h-64 bg-white/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 translate-y-1/3 -translate-x-1/3 w-48 h-48 bg-black/20 rounded-full blur-2xl"></div>
        </div>
      </motion.div>

    </div>
  );
}