import React from 'react';
import { motion } from 'framer-motion';
import { FiRefreshCw, FiBox, FiCheckCircle, FiShield, FiArrowRight, FiClock, FiXCircle, FiAlertCircle } from 'react-icons/fi';
import { Link } from 'react-router-dom';

const ReturnsPage = () => {
  // Animation Variants
  const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.15 } }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-200 font-sans pb-20 overflow-hidden">
      
      {/* HEADER SECTION */}
      <div className="relative pt-32 pb-16 px-6 text-center border-b border-slate-800">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl h-48 bg-[#FF4500] opacity-[0.05] blur-[100px] pointer-events-none"></div>
        <motion.div initial="hidden" animate="visible" variants={fadeUp} className="relative z-10 max-w-3xl mx-auto">
          <div className="w-16 h-16 bg-slate-800/50 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-slate-700">
            <FiRefreshCw className="text-[#FF4500] w-8 h-8" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tight">
            Return, Refund & Cancellation
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed">
            At Jack Essentials, your satisfaction is our ultimate priority. Shop with absolute confidence knowing we have got your back.
          </p>
        </motion.div>
      </div>

      {/* CONTENT GRID */}
      <div className="max-w-5xl mx-auto px-6 py-16">
        <motion.div 
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={staggerContainer}
          className="grid md:grid-cols-2 gap-6"
        >
          
          {/* Card 1: 7-Day Returns */}
          <motion.div variants={fadeUp} className="bg-slate-800/30 p-8 rounded-3xl border border-slate-700/50 hover:border-green-500/50 transition-colors md:col-span-2">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center mr-4">
                <FiBox className="text-green-500 w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-white">7-Day Free Returns</h2>
            </div>
            <p className="text-slate-400 leading-relaxed mb-6">
              We offer a 100% Free & Hassle-free return policy within 7 days of delivery. No hidden pickup charges! Just ensure the product meets these conditions:
            </p>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="flex items-start gap-3">
                <FiCheckCircle className="text-green-500 flex-shrink-0 mt-1" />
                <span className="text-sm text-slate-300">Unused & Unwashed</span>
              </div>
              <div className="flex items-start gap-3">
                <FiCheckCircle className="text-green-500 flex-shrink-0 mt-1" />
                <span className="text-sm text-slate-300">Original Packaging</span>
              </div>
              <div className="flex items-start gap-3">
                <FiCheckCircle className="text-green-500 flex-shrink-0 mt-1" />
                <span className="text-sm text-slate-300">All Tags Intact</span>
              </div>
            </div>
          </motion.div>

          {/* Card 2: Lightning Fast Refunds */}
          <motion.div variants={fadeUp} className="bg-slate-800/30 p-8 rounded-3xl border border-slate-700/50 hover:border-blue-500/50 transition-colors">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mr-4">
                <FiClock className="text-blue-500 w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white">Lightning Fast Refunds</h2>
            </div>
            <p className="text-slate-400 leading-relaxed text-sm">
              Once our delivery partner picks up the return item, your refund is processed almost instantly! Usually, it takes <strong>4-5 working days</strong> to reflect in your original payment source. In some wallet/UPI cases, refunds are credited within minutes of pickup.
            </p>
          </motion.div>

          {/* Card 3: Flexible Cancellations */}
          <motion.div variants={fadeUp} className="bg-slate-800/30 p-8 rounded-3xl border border-slate-700/50 hover:border-[#FF4500]/50 transition-colors">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-[#FF4500]/10 rounded-xl flex items-center justify-center mr-4">
                <FiXCircle className="text-[#FF4500] w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white">Flexible Cancellations</h2>
            </div>
            <p className="text-slate-400 leading-relaxed text-sm">
              Change of mind? No problem. You can easily cancel your order directly from your <em>Order History</em> before it is dispatched. <br/><br/>
              <strong>Already Shipped?</strong> You can still cancel it by contacting our Help Center, and we will stop the delivery—no questions asked.
            </p>
          </motion.div>

          {/* Card 4: Non-Returnable Items */}
          <motion.div variants={fadeUp} className="bg-slate-800/30 p-8 rounded-3xl border border-slate-700/50 hover:border-yellow-500/50 transition-colors md:col-span-2 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-bl-full pointer-events-none"></div>
            <div className="flex items-center mb-6 relative z-10">
              <div className="w-12 h-12 bg-yellow-500/10 rounded-xl flex items-center justify-center mr-4">
                <FiAlertCircle className="text-yellow-500 w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white">Non-Returnable Items</h2>
            </div>
            <p className="text-slate-400 leading-relaxed text-sm relative z-10">
              To maintain strict hygiene standards and product safety, certain items cannot be returned once purchased. These include: <strong>Innerwear, Grooming Accessories, Fragrances, and specific Clearance Sale items.</strong> Please check the product description carefully before ordering these items.
            </p>
          </motion.div>

        </motion.div>

        {/* CTA SECTION */}
        <motion.div 
          initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
          className="mt-12 bg-gradient-to-r from-slate-800 to-slate-900 border border-slate-700 p-8 rounded-3xl flex flex-col md:flex-row justify-between items-center gap-6 shadow-2xl"
        >
          <div>
            <h4 className="font-black text-white text-2xl mb-2">Need to raise a request?</h4>
            <p className="text-slate-400 text-sm">Our support team is available to assist you instantly.</p>
          </div>
          <Link to="/support" className="bg-[#FF4500] hover:bg-orange-600 px-8 py-4 rounded-full font-bold text-white flex items-center gap-2 transition-all shadow-lg hover:shadow-orange-500/25 active:scale-95 whitespace-nowrap">
            Visit Help Center <FiArrowRight />
          </Link>
        </motion.div>

        {/* TRUST BADGES */}
        <motion.div 
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          className="mt-12 flex justify-center items-center gap-8 text-slate-500 text-xs md:text-sm font-bold uppercase tracking-widest"
        >
          <div className="flex items-center gap-2"><FiShield className="text-[#FF4500]" size={18}/> 100% Secure</div>
          <div className="flex items-center gap-2"><FiBox className="text-[#FF4500]" size={18}/> Free Pickup</div>
        </motion.div>
        
      </div>
    </div>
  );
};

export default ReturnsPage;