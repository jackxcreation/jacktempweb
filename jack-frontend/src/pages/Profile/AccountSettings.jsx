import React from 'react';
import { motion } from 'framer-motion';

const AccountSettings = () => {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="bg-white p-6 sm:p-10 rounded-3xl shadow-sm border border-slate-100">
      <h2 className="text-2xl font-black text-slate-900 mb-2">Account Security</h2>
      <p className="text-sm text-slate-500 font-medium mb-8 border-b border-slate-100 pb-4">Manage your preferences and security settings.</p>
      
      <div className="space-y-4">
        <div className="flex justify-between items-center p-5 border border-slate-100 rounded-2xl hover:border-slate-300 transition-colors bg-slate-50/50">
          <div>
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">WhatsApp Order Updates <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded font-black tracking-widest uppercase">New</span></h4>
            <p className="text-xs text-slate-500 mt-1 font-medium">Get live tracking links and OTPs on WhatsApp.</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" defaultChecked />
            <div className="w-12 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FF4500]"></div>
          </label>
        </div>

        <div className="flex justify-between items-center p-5 border border-slate-100 rounded-2xl hover:border-slate-300 transition-colors bg-slate-50/50">
          <div>
            <h4 className="font-bold text-slate-900 text-sm">Promotional Emails</h4>
            <p className="text-xs text-slate-500 mt-1 font-medium">Receive exclusive VIP offers and early sale access.</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" />
            <div className="w-12 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FF4500]"></div>
          </label>
        </div>

        <div className="flex justify-between items-center p-5 border border-slate-100 rounded-2xl hover:border-slate-300 transition-colors bg-slate-50/50">
          <div>
            <h4 className="font-bold text-slate-900 text-sm">Two-Factor Authentication</h4>
            <p className="text-xs text-slate-500 mt-1 font-medium">Add an extra layer of security to your account.</p>
          </div>
          <button className="text-xs font-bold bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:border-indigo-500 hover:text-indigo-600 transition-colors">Setup</button>
        </div>

        <div className="pt-8 mt-4 border-t border-slate-100 text-right">
          <button onClick={() => window.confirm('Are you sure you want to permanently delete your account?')} className="text-red-500 font-bold text-xs hover:bg-red-50 px-4 py-2 rounded-lg transition-colors border border-transparent hover:border-red-100">
            Deactivate / Delete Account
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default AccountSettings;