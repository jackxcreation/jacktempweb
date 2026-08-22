import React from "react";
import { motion } from "framer-motion";
import { FiShield, FiDatabase, FiShare2, FiEye, FiUserCheck, FiLifeBuoy, FiArrowRight } from "react-icons/fi";
import { Link } from "react-router-dom";

export default function PrivacyPolicy() {
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
            <FiShield className="text-[#FF4500] w-8 h-8" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed">
            Welcome to Jack Essentials. Your privacy is critically important to us. Here is how we protect, manage, and use your data to give you a secure shopping experience.
          </p>
        </motion.div>
      </div>

      {/* CONTENT SECTION */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        <motion.div 
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={staggerContainer}
          className="space-y-8"
        >
          
          {/* Rule 1 */}
          <motion.section variants={fadeUp} className="bg-slate-800/30 p-8 rounded-3xl border border-slate-700/50 hover:border-blue-500/50 transition-colors">
            <div className="flex items-center mb-4">
              <FiDatabase className="text-blue-400 w-6 h-6 mr-3" />
              <h2 className="text-2xl font-bold text-white">1. Information We Collect</h2>
            </div>
            <p className="text-slate-400 leading-relaxed text-sm md:text-base mb-4">
              To provide you with a seamless shopping experience, we collect essential information when you create an account or place an order:
            </p>
            <ul className="list-disc pl-6 text-slate-400 space-y-2 text-sm md:text-base">
              <li><strong>Personal Details:</strong> Name, Email Address, and Mobile Number.</li>
              <li><strong>Delivery Details:</strong> Shipping and Billing Addresses.</li>
              <li><strong>Behavioral Data:</strong> Your shopping interests and search history to recommend products via our AI ecosystem.</li>
            </ul>
          </motion.section>

          {/* Rule 2 */}
          <motion.section variants={fadeUp} className="bg-slate-800/30 p-8 rounded-3xl border border-slate-700/50 hover:border-green-500/50 transition-colors">
            <div className="flex items-center mb-4">
              <FiShare2 className="text-green-400 w-6 h-6 mr-3" />
              <h2 className="text-2xl font-bold text-white">2. How We Share Your Data</h2>
            </div>
            <p className="text-slate-400 leading-relaxed text-sm md:text-base mb-4">
              We do <strong>not</strong> sell your personal data. We only share necessary details with trusted, verified partners to fulfill your orders:
            </p>
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div className="bg-slate-900/50 p-5 rounded-2xl border border-slate-800">
                <span className="font-bold text-slate-200 block mb-1">🚚 Logistics & Shipping</span>
                <span className="text-sm text-slate-500">Address and Contact details are shared with delivery partners (e.g., Shiprocket, Delhivery).</span>
              </div>
              <div className="bg-slate-900/50 p-5 rounded-2xl border border-slate-800">
                <span className="font-bold text-slate-200 block mb-1">💳 Secure Payments</span>
                <span className="text-sm text-slate-500">Payments are processed via secure gateways like Razorpay. We never store your card details.</span>
              </div>
            </div>
          </motion.section>

          {/* Rule 3 */}
          <motion.section variants={fadeUp} className="bg-slate-800/30 p-8 rounded-3xl border border-slate-700/50 hover:border-purple-500/50 transition-colors">
            <div className="flex items-center mb-4">
              <FiEye className="text-purple-400 w-6 h-6 mr-3" />
              <h2 className="text-2xl font-bold text-white">3. Cookies & Tracking</h2>
            </div>
            <p className="text-slate-400 leading-relaxed text-sm md:text-base">
              Yes, we use cookies! 🍪 These small files help us remember your login sessions, keep items in your cart, and understand your preferences. This allows us to make the Jack Essentials website faster and smarter. You can disable cookies in your browser, but some features may not work properly.
            </p>
          </motion.section>

          {/* Rule 4 */}
          <motion.section variants={fadeUp} className="bg-slate-800/30 p-8 rounded-3xl border border-slate-700/50 hover:border-yellow-500/50 transition-colors">
            <div className="flex items-center mb-4">
              <FiUserCheck className="text-yellow-400 w-6 h-6 mr-3" />
              <h2 className="text-2xl font-bold text-white">4. Age Restrictions</h2>
            </div>
            <p className="text-slate-400 leading-relaxed text-sm md:text-base">
              Jack Essentials is a general audience e-commerce platform. While there is no strict age limit to browse, users under the age of 18 should use the website and make purchases under the supervision and approval of a parent or legal guardian.
            </p>
          </motion.section>

          {/* Rule 5 (CTA) */}
          <motion.section variants={fadeUp} className="bg-gradient-to-br from-slate-800 to-slate-900 p-8 rounded-3xl border border-[#FF4500]/30 shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF4500] opacity-10 rounded-bl-full group-hover:scale-110 transition-transform"></div>
            <div className="flex items-center mb-4 relative z-10">
              <FiLifeBuoy className="text-[#FF4500] w-6 h-6 mr-3" />
              <h2 className="text-2xl font-bold text-white">5. Data Deletion & Support</h2>
            </div>
            <p className="text-slate-400 leading-relaxed text-sm md:text-base mb-6 relative z-10">
              Have questions about your privacy? Want to update your information or request the complete deletion of your account data? We are completely transparent and here to help.
            </p>
            <Link to="/support" className="inline-flex items-center gap-2 bg-[#FF4500] hover:bg-orange-600 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg relative z-10">
              Raise a Support Ticket <FiArrowRight />
            </Link>
          </motion.section>

        </motion.div>

        {/* FOOTER NOTE */}
        <motion.div 
          initial={{ opacity: 0 }} 
          whileInView={{ opacity: 1 }} 
          viewport={{ once: true }}
          className="mt-16 text-center border-t border-slate-800 pt-8"
        >
          <p className="text-slate-500 text-sm">
            Last Updated: {new Date().toLocaleDateString()} <br />
            Jack Essentials ™ - Cuttack, Odisha
          </p>
        </motion.div>
      </div>
    </div>
  );
}