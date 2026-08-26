import React, { useState, useEffect } from 'react';
import { FiDownload, FiBell } from 'react-icons/fi';

export const PWAPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
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
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBanner(false);
    }
    setDeferredPrompt(null);
  };

  const requestPushPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        alert('Push notifications enabled! You will receive instant order and price alerts.');
      }
    }
  };

  if (!showInstallBanner) return null;

  return (
    <div className="fixed bottom-6 right-6 bg-slate-900 text-white p-4 rounded-2xl shadow-2xl z-50 flex items-center gap-4 max-w-sm border border-slate-800">
      <div className="w-10 h-10 bg-[#FF4500] rounded-xl flex items-center justify-center font-black text-white">JE</div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-xs text-white">Install Jack Essentials</p>
        <p className="text-[11px] text-slate-400">Add to Home Screen for lightning-fast shopping & offline cart.</p>
      </div>
      <button 
        onClick={handleInstallClick} 
        className="bg-[#FF4500] hover:bg-[#e03d00] text-white px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1 transition-colors"
      >
        <FiDownload size={14} /> Install
      </button>
    </div>
  );
};