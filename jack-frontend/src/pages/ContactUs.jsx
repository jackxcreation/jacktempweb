import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMail, FiMessageSquare, FiClock, FiMapPin, FiSend, FiCheckCircle } from 'react-icons/fi';
import { Link } from 'react-router-dom';

const ContactUs = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Fake API delay
    setTimeout(() => {
      setIsSubmitting(false);
      setToast(true);
      e.target.reset();
      setTimeout(() => setToast(false), 4000);
    }, 1500);
  };

  const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6 } } };
  const stagger = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.15 } } };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-200 font-sans pb-20 relative overflow-hidden">
      
      {/* SUCCESS TOAST */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -50 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-[#FF4500] text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 font-bold"
          >
            <FiCheckCircle size={20} />
            Message sent successfully! We'll connect soon.
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER */}
      <div className="relative pt-32 pb-16 px-6 text-center border-b border-slate-800">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl h-48 bg-[#FF4500] opacity-[0.05] blur-[100px] pointer-events-none"></div>
        <motion.div initial="hidden" animate="visible" variants={fadeUp} className="relative z-10 max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4">Let's Connect</h1>
          <p className="text-slate-400 text-lg">Whether you need order assistance, want to collaborate, or just want to drop some feedback, we are all ears.</p>
        </motion.div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-16 grid lg:grid-cols-12 gap-12">
        
        {/* LEFT COLUMN - CONTACT INFO */}
        <motion.div initial="hidden" animate="visible" variants={stagger} className="lg:col-span-5 space-y-6">
          
          {/* Support Ticket (Primary Highlight) */}
          <motion.div variants={fadeUp} className="bg-gradient-to-br from-slate-800 to-slate-900 p-8 rounded-3xl border border-[#FF4500]/30 shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF4500] opacity-10 rounded-bl-full group-hover:scale-110 transition-transform"></div>
            <FiMessageSquare className="text-[#FF4500] w-8 h-8 mb-4 relative z-10" />
            <h3 className="text-2xl font-bold text-white mb-2 relative z-10">Customer Support</h3>
            <p className="text-slate-400 mb-6 relative z-10 text-sm">
              The fastest way to get help! Raise a ticket and our dedicated team will resolve your issue within <strong>1 Hour</strong>.
            </p>
            <Link to="/support" className="inline-block bg-[#FF4500] hover:bg-orange-600 text-white font-bold py-2 px-6 rounded-lg transition-colors relative z-10">
              Raise a Ticket
            </Link>
          </motion.div>

          {/* Business & Collab */}
          <motion.div variants={fadeUp} className="bg-slate-800/30 p-6 rounded-3xl border border-slate-700">
            <div className="flex items-center gap-4 mb-2">
              <FiMail className="text-blue-400 w-6 h-6" />
              <h3 className="text-lg font-bold text-white">Business & Collabs</h3>
            </div>
            <p className="text-slate-400 text-sm ml-10">
              For influencer promotions, wholesale, or brand partnerships, use the contact form or email us. (Response in 24 hrs)
            </p>
          </motion.div>

          {/* Timings */}
          <motion.div variants={fadeUp} className="bg-slate-800/30 p-6 rounded-3xl border border-slate-700">
            <div className="flex items-center gap-4 mb-2">
              <FiClock className="text-green-400 w-6 h-6" />
              <h3 className="text-lg font-bold text-white">Operating Hours</h3>
            </div>
            <p className="text-slate-400 text-sm ml-10">
              <strong>Monday to Sunday:</strong> 9:00 AM to 11:00 PM <br/>
              Our support executives and AI are always awake for you!
            </p>
          </motion.div>

          {/* Location */}
          <motion.div variants={fadeUp} className="bg-slate-800/30 p-6 rounded-3xl border border-slate-700">
            <div className="flex items-center gap-4 mb-2">
              <FiMapPin className="text-purple-400 w-6 h-6" />
              <h3 className="text-lg font-bold text-white">Headquarters</h3>
            </div>
            <p className="text-slate-400 text-sm ml-10">
              Jack Essentials <br/>
              Cuttack, Odisha, 754132, India
            </p>
          </motion.div>

        </motion.div>

        {/* RIGHT COLUMN - CONTACT FORM */}
        <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="lg:col-span-7">
          <div className="bg-slate-800/40 p-8 md:p-10 rounded-3xl border border-slate-700">
            <h2 className="text-2xl font-bold text-white mb-6">Drop us a Line</h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Your Name</label>
                  <input type="text" required placeholder="John Doe" className="w-full bg-slate-900/50 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-[#FF4500] transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Email Address</label>
                  <input type="email" required placeholder="john@example.com" className="w-full bg-slate-900/50 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-[#FF4500] transition-colors" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Topic</label>
                <select className="w-full bg-slate-900/50 border border-slate-700 text-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:border-[#FF4500] transition-colors appearance-none">
                  <option value="general">General Inquiry</option>
                  <option value="collab">Business & Promotions</option>
                  <option value="feedback">Website Feedback</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Message</label>
                <textarea required rows="4" placeholder="How can we help you?" className="w-full bg-slate-900/50 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-[#FF4500] transition-colors resize-none"></textarea>
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full bg-[#FF4500] hover:bg-orange-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]">
                {isSubmitting ? (
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>Send Message <FiSend /></>
                )}
              </button>
            </form>
          </div>
        </motion.div>

      </div>
    </div>
  );
};

export default ContactUs;