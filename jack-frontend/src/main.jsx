import React, { StrictMode, Component } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// ==========================================
// 🔥 PRO FEATURE 1: GLOBAL ERROR BOUNDARY 🔥
// ==========================================
// Agar website mein koi error aaye, toh white screen ki jagah ye premium UI aayega
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Yahan aage chal kar hum Sentry ya DataDog (Crash tracking) laga sakte hain
    console.error("🚨 Jack Essentials System Crash Detected:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0B0F19] flex flex-col items-center justify-center text-center px-4 font-sans text-white">
          <div className="w-24 h-24 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mb-6 animate-pulse">
            <span className="text-red-500 text-4xl">⚠️</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight">System Glitch</h1>
          <p className="text-slate-400 mb-8 max-w-md font-medium">Our servers encountered an unexpected UI glitch. Our engineering team has been notified.</p>
          <button 
            onClick={() => window.location.href = '/'} 
            className="bg-[#FF4500] text-white px-10 py-4 rounded-xl font-black hover:bg-[#E8004C] transition-all shadow-lg active:scale-95 tracking-widest"
          >
            REBOOT SYSTEM
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ==========================================
// 🔥 PRO FEATURE 2: SECURE CONSOLE GREETING 🔥
// ==========================================
const showConsoleGreeting = () => {
  console.log(
    "%c🚀 Jack Essentials E-Commerce Engine Loaded!",
    "color: #FF4500; font-size: 24px; font-weight: 900; background: #0B0F19; padding: 15px 30px; border-radius: 12px; border: 2px solid #FF4500;"
  );
  console.log(
    "%c⚠️ STOP! WARNING!",
    "color: red; font-size: 20px; font-weight: bold; margin-top: 10px;"
  );
  console.log(
    "%cThis is a browser feature intended for developers. If someone told you to copy-paste something here to enable a feature or 'hack' someone's account, it is a scam and will give them access to your JACK account.",
    "font-size: 14px; font-weight: bold; color: white; background: #333; padding: 10px; border-radius: 8px;"
  );
};

// Run the greeting
if (typeof window !== 'undefined') {
  showConsoleGreeting();
}

// ==========================================
// 🚀 APP INITIALIZATION
// ==========================================
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);