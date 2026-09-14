// jack-frontend/src/components/PWAPrompt.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiDownload, FiBell, FiX } from 'react-icons/fi';

export const PWAPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    // Check if user previously dismissed or installed the PWA
    if (localStorage.getItem('pwa_dismissed') || localStorage.getItem('pwa_installed')) {
      return;
    }

    // 1. Register Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => console.log('Service Worker registered successfully:', reg))
        .catch((err) => console.error('Service Worker registration failed:', err));
    }

    // 2. Capture Add to Home Screen (A2HS) Prompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for successful installation event
    window.addEventListener('appinstalled', () => {
      setShowInstallBanner(false);
      setDeferredPrompt(null);
      localStorage.setItem('pwa_installed', 'true');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBanner(false);
      localStorage.setItem('pwa_installed', 'true');
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowInstallBanner(false);
    localStorage.setItem('pwa_dismissed', 'true');
  };

  // 🔥 Preserved completely as requested (Push notification permission handler)
  const requestPushPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        alert('Push notifications enabled! You will receive instant order and price alerts.');
      }
    }
  };

  return (
    <AnimatePresence>
      {showInstallBanner && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="fixed bottom-6 right-6 bg-slate-900 text-white p-4 rounded-2xl shadow-2xl z-50 flex items-center gap-4 max-w-sm border border-slate-800 relative"
        >
          <div className="w-10 h-10 bg-[#FF4500] rounded-xl flex items-center justify-center font-black text-white flex-shrink-0 shadow-sm">JE</div>
          
          <div className="flex-1 min-w-0">
            <p className="font-bold text-xs text-white">Install Jack Essentials</p>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">Add to Home Screen for lightning-fast shopping & offline cart.</p>
          </div>

          <button 
            onClick={handleInstallClick} 
            className="bg-[#FF4500] hover:bg-[#e03d00] text-white px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer flex-shrink-0 active:scale-95 shadow-sm"
          >
            <FiDownload size={14} /> Install
          </button>

          <button
            onClick={handleDismiss}
            aria-label="Close"
            className="absolute -top-2 -right-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white p-1 rounded-full border border-slate-700 transition-colors cursor-pointer"
          >
            <FiX size={14} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PWAPrompt;