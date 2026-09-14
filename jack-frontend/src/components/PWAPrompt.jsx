// jack-frontend/src/components/PWAPrompt.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiDownload, FiX } from 'react-icons/fi';

export const PWAPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    // Check if user previously dismissed the prompt during this session or earlier
    const isDismissed = localStorage.getItem('pwa_dismissed');
    const isInstalled = localStorage.getItem('pwa_installed');
    if (isDismissed || isInstalled) return;

    const handleBeforeInstallPrompt = (e) => {
      // Prevent Chrome from automatically showing the prompt right away
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Show custom install banner
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
    
    // Show the browser install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted the PWA install prompt');
    } else {
      console.log('User dismissed the PWA install prompt');
    }
    
    // Clear the deferred prompt and hide banner
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  const handleDismiss = () => {
    setShowInstallBanner(false);
    // Remember dismissal in localStorage
    localStorage.setItem('pwa_dismissed', 'true');
  };

  return (
    <AnimatePresence>
      {showInstallBanner && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="fixed bottom-6 left-6 z-[9999] max-w-sm w-full bg-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-2xl border border-slate-800 flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-[#FF4500]/10 border border-[#FF4500]/30 text-[#FF4500] flex items-center justify-center flex-shrink-0 shadow-inner">
            <FiDownload size={22} className="animate-bounce" />
          </div>
          
          <div className="flex-1 overflow-hidden">
            <h4 className="font-black text-sm text-white tracking-wide">📱 Install Jack Essentials</h4>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              Get a faster shopping experience and offline access!
            </p>
          </div>

          <div className="flex flex-col gap-2 flex-shrink-0">
            <button
              onClick={handleInstallClick}
              className="bg-[#FF4500] hover:bg-orange-600 text-white font-black text-xs px-3.5 py-2 rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              Install
            </button>
            <button
              onClick={handleDismiss}
              className="text-slate-400 hover:text-white font-bold text-[11px] transition-colors cursor-pointer text-center"
            >
              Not now
            </button>
          </div>

          <button
            onClick={handleDismiss}
            aria-label="Close"
            className="absolute top-2 right-2 text-slate-500 hover:text-slate-300 p-1 cursor-pointer"
          >
            <FiX size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PWAPrompt;