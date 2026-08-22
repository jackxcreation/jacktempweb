import React from "react";
import { motion } from "framer-motion";
import { FiAlertTriangle, FiDollarSign, FiFileText, FiGlobe, FiShield } from "react-icons/fi";

export default function TermsOfService() {
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
            <FiFileText className="text-[#FF4500] w-8 h-8" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tight">
            Terms of Service
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed">
            Welcome to Jack Essentials. Please read these terms carefully. By accessing or using our website, you agree to be bound by the rules and policies outlined below.
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
          <motion.section variants={fadeUp} className="bg-slate-800/30 p-8 rounded-3xl border border-slate-700/50 hover:border-slate-600 transition-colors">
            <div className="flex items-center mb-4">
              <FiAlertTriangle className="text-yellow-500 w-6 h-6 mr-3" />
              <h2 className="text-2xl font-bold text-white">1. Order Acceptance & Cancellations</h2>
            </div>
            <p className="text-slate-400 leading-relaxed text-sm md:text-base">
              While we strive for 100% accuracy, technical glitches or pricing errors may occasionally occur. <strong>Jack Essentials reserves the right to cancel any order</strong> resulting from such errors. If your order is canceled, our support team will personally contact you to explain the situation and assist you in finding an alternative product that meets your needs.
            </p>
          </motion.section>

          {/* Rule 2 */}
          <motion.section variants={fadeUp} className="bg-slate-800/30 p-8 rounded-3xl border border-slate-700/50 hover:border-slate-600 transition-colors">
            <div className="flex items-center mb-4">
              <FiDollarSign className="text-green-400 w-6 h-6 mr-3" />
              <h2 className="text-2xl font-bold text-white">2. Payments & Cash on Delivery (COD)</h2>
            </div>
            <p className="text-slate-400 leading-relaxed text-sm md:text-base">
              We offer both secure prepaid options and Cash on Delivery (COD). Please note:
            </p>
            <ul className="list-disc pl-6 mt-3 text-slate-400 space-y-2 text-sm md:text-base">
              <li>COD is available for a maximum order limit of <strong>₹10,000</strong>.</li>
              <li>Certain exclusive or heavy products may be restricted to prepaid-only based on our internal fulfillment policies.</li>
            </ul>
          </motion.section>

          {/* Rule 3 */}
          <motion.section variants={fadeUp} className="bg-slate-800/30 p-8 rounded-3xl border border-slate-700/50 hover:border-red-900/30 transition-colors relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-bl-full pointer-events-none"></div>
            <div className="flex items-center mb-4 relative z-10">
              <FiShield className="text-red-400 w-6 h-6 mr-3" />
              <h2 className="text-2xl font-bold text-white">3. Account Suspension & Fraud</h2>
            </div>
            <p className="text-slate-400 leading-relaxed text-sm md:text-base relative z-10">
              We maintain a zero-tolerance policy against fake orders, abusive behavior toward our support staff, and fraudulent activities. Jack Essentials holds the right to permanently <strong>delete and block accounts</strong> engaging in such behavior. In cases of severe misconduct or actions that harm our company's reputation, we will initiate strict legal action against the offender.
            </p>
          </motion.section>

          {/* Rule 4 */}
          <motion.section variants={fadeUp} className="bg-slate-800/30 p-8 rounded-3xl border border-slate-700/50 hover:border-slate-600 transition-colors">
            <div className="flex items-center mb-4">
              <FiFileText className="text-blue-400 w-6 h-6 mr-3" />
              <h2 className="text-2xl font-bold text-white">4. Intellectual Property Rights</h2>
            </div>
            <p className="text-slate-400 leading-relaxed text-sm md:text-base">
              The brand name <strong>"Jack™"</strong>, <strong>"Jack Essentials"</strong>, our logos, graphics, website design, and all associated digital assets are the exclusive intellectual property of Jack Essentials. Unauthorized copying, scraping, or commercial use of our assets is strictly prohibited and will result in immediate legal consequences.
            </p>
          </motion.section>

          {/* Rule 5 */}
          <motion.section variants={fadeUp} className="bg-slate-800/30 p-8 rounded-3xl border border-slate-700/50 hover:border-[#FF4500]/50 transition-colors">
            <div className="flex items-center mb-4">
              <FiGlobe className="text-[#FF4500] w-6 h-6 mr-3" />
              <h2 className="text-2xl font-bold text-white">5. Governing Law & Jurisdiction</h2>
            </div>
            <p className="text-slate-400 leading-relaxed text-sm md:text-base">
              These Terms of Service are governed by the laws of India. Any disputes or legal proceedings arising from the use of our website or services shall be subject to the exclusive jurisdiction of the competent courts located in <strong>Cuttack, Odisha, India</strong>.
            </p>
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
            If you have any questions regarding these terms, please contact our support team.
          </p>
        </motion.div>
      </div>
    </div>
  );
}