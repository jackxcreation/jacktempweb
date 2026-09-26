// jack-frontend/src/App.jsx
import React, { useState, useEffect, Suspense, lazy, Component, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate, Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';

// Vercel Analytics & Performance
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Analytics } from "@vercel/analytics/react";

// 🔥 PHASE 8: TANSTACK QUERY FOR CACHING & STALE TIME
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Providers
import { CartProvider } from './context/CartContext';
import { UserProvider, UserContext } from './context/UserContext';
import { ProductProvider } from './context/ProductContext';
import { SettingsProvider } from './context/SettingsContext';
import { CompareProvider } from './context/CompareContext'; // Compare Context Provider

// Components
import Navbar from './components/Navbar'; // 🔥 Global Navbar import
import Footer from './components/Footer';
import { SmartPriceDropToast } from './components/SmartPriceDropToast'; // Real-time Price Drop Toast Notification
import { SmartStockAlertToast } from './components/SmartStockAlertToast'; // Real-time Stock Alert Toast Notification
import { PWAPrompt } from './components/PWAPrompt'; // PWA Install & Push Notification Prompt
import { WhatsAppWidget } from './components/WhatsAppWidget'; // WhatsApp Support Floating Widget

// Code-Split Pages via React.lazy for Performance Optimization
const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ProductDetails = lazy(() => import('./pages/ProductDetails'));
const Cart = lazy(() => import('./pages/Cart'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Shop = lazy(() => import('./pages/Shop'));
const Profile = lazy(() => import('./pages/Profile/Profile'));
const OrderDetails = lazy(() => import('./pages/OrderDetails'));
const HelpCenter = lazy(() => import('./pages/HelpCenter'));
const ReturnsPage = lazy(() => import('./pages/ReturnsPage'));
const SecureAccount = lazy(() => import('./pages/SecureAccount'));
const UnlockAccount = lazy(() => import('./pages/UnlockAccount'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const AboutUs = lazy(() => import('./pages/AboutUs'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const ContactUs = lazy(() => import('./pages/ContactUs'));
const TrackOrder = lazy(() => import('./pages/TrackOrder')); // Real-time tracking page load
const Wishlist = lazy(() => import('./pages/Wishlist')); // Wishlist Page lazy load
const Comparisons = lazy(() => import('./pages/Comparisons')); // SEO Comparisons Hub Page

// --- Phase 8: TanStack Query Setup ---
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes caching before background refetch
      refetchOnWindowFocus: false, // Prevents excessive API calls
      retry: 1, // Only retry once on failure
    },
  },
});

// --- Enterprise Core Utilities ---

const storage = {
  get: (key) => {
    try {
      if (typeof window === 'undefined') return null;
      const value = window.localStorage.getItem(key);
      return (value === 'undefined' || value === 'null') ? null : value;
    } catch (e) {
      console.warn(`[Storage Read Error]: ${key}`, e);
      return null;
    }
  },
  set: (key, value) => {
    try {
      if (typeof window !== 'undefined' && value !== undefined) {
        window.localStorage.setItem(key, value);
      }
    } catch (e) {
      console.warn(`[Storage Write Error]: ${key}`, e);
    }
  },
  remove: (key) => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn(`[Storage Remove Error]: ${key}`, e);
    }
  }
};

// --- Infrastructure Components ---

class GlobalErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[Fatal Application Error]:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#F8F9FA] px-6 text-center font-sans">
          <div className="w-16 h-16 mb-6 text-[#FF4500]">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-3">Something went wrong</h1>
          <p className="text-slate-600 mb-8 max-w-md">
            We encountered an unexpected error. Our engineering team has been notified.
          </p>
          <button
            onClick={() => {
              window.location.replace('/');
            }}
            className="bg-slate-900 hover:bg-[#FF4500] text-white px-8 py-3 rounded-xl font-bold transition-all focus:ring-4 focus:ring-slate-300 outline-none cursor-pointer"
          >
            Return to Homepage
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const PageLoader = () => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] w-full gap-4" aria-live="polite" aria-busy="true">
    <div className="w-10 h-10 border-4 border-slate-200 border-t-[#FF4500] rounded-full animate-spin"></div>
    <span className="text-slate-400 font-medium text-sm tracking-wide">Loading...</span>
  </div>
);

const ScrollManager = () => {
  const { pathname } = useLocation();
  
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);
  
  return null;
};

const EnterpriseAnalyticsManager = () => {
  const location = useLocation();

  useEffect(() => {
    // 1. Core Traffic Attribution
    try {
      const params = new URLSearchParams(location.search);
      const source = params.get('utm_source'); 
      const medium = params.get('utm_medium'); 
      const campaign = params.get('utm_campaign'); 
      
      if (source) {
        storage.set('jack_traffic_source', JSON.stringify({
          source: source.toLowerCase(),
          medium: medium ? medium.toLowerCase() : 'unknown',
          campaign: campaign || 'none',
          clickDate: new Date().toISOString(),
          landingPage: location.pathname
        }));
      } else if (!storage.get('jack_traffic_source') && typeof document !== 'undefined') {
        const referrer = document.referrer.toLowerCase();
        let trafficData = { 
          source: 'Direct/Unknown', 
          medium: 'organic', 
          campaign: 'none', 
          clickDate: new Date().toISOString(),
          landingPage: location.pathname
        };

        if (referrer.includes('facebook.com') || referrer.includes('fb.me')) {
          trafficData = { ...trafficData, source: 'facebook', medium: 'social_organic' };
        } else if (referrer.includes('instagram.com') || referrer.includes('l.instagram.com')) {
          trafficData = { ...trafficData, source: 'instagram', medium: 'social_organic' };
        } else if (referrer.includes('google.com')) {
          trafficData = { ...trafficData, source: 'google', medium: 'organic_search' };
        }

        storage.set('jack_traffic_source', JSON.stringify(trafficData));
      }
    } catch (error) {
      console.warn('[Analytics Manager]: Error processing traffic source', error);
    }

    // 2. Global Event Bus Preparation (Amazon-style Datalayer)
    window.EnterpriseDataLayer = window.EnterpriseDataLayer || [];
    window.EnterpriseAnalytics = {
      trackEvent: (eventName, payload) => {
        const eventContext = {
          event: eventName,
          timestamp: new Date().toISOString(),
          path: location.pathname,
          deviceType: window.innerWidth < 768 ? 'mobile' : 'desktop',
          ...payload
        };
        window.EnterpriseDataLayer.push(eventContext);
        
        if (import.meta?.env?.DEV) {
          console.debug(`[Analytics Event]: ${eventName}`, eventContext);
        }
      },
      viewProduct: (productData) => window.EnterpriseAnalytics.trackEvent('ViewProduct', productData),
      addToCart: (cartData) => window.EnterpriseAnalytics.trackEvent('AddToCart', cartData),
      checkout: (checkoutData) => window.EnterpriseAnalytics.trackEvent('CheckoutInitiated', checkoutData),
      purchase: (orderData) => window.EnterpriseAnalytics.trackEvent('PurchaseCompleted', orderData),
    };

    window.EnterpriseAnalytics.trackEvent('PageView', { title: document.title });

  }, [location]);

  return null; 
};

const SEOManager = () => {
  const location = useLocation();
  
  useEffect(() => {
    let canonicalLink = document.querySelector("link[rel='canonical']");
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', window.location.origin + location.pathname);
  }, [location.pathname]);

  return null;
};

// --- Layout & Routing Architecture ---

const StoreLayout = () => {
  const location = useLocation();
  const { user } = useContext(UserContext);
  const isLoggedIn = !!user;
  
  // 🔥 Automatically hide Navbar, Footer, and widgets on authentication routes for a clean D2C UX
  const hideLayoutElements = ['/login', '/register', '/forgot-password', '/secure-account', '/unlock-account'].includes(location.pathname);

  return (
    <div className="flex flex-col min-h-screen w-full bg-white">
      {!hideLayoutElements && <Navbar isLoggedIn={isLoggedIn} />}
      
      <main className="flex-grow flex flex-col relative w-full outline-none" tabIndex="-1">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
      
      {!hideLayoutElements && <Footer />}
      {!hideLayoutElements && <SmartPriceDropToast />} 
      {!hideLayoutElements && <SmartStockAlertToast />}
      {!hideLayoutElements && <PWAPrompt />}
      {!hideLayoutElements && <WhatsAppWidget />} 
    </div>
  );
};

const RequireAuth = ({ children }) => {
  const location = useLocation();
  const { user, loading } = useContext(UserContext);

  if (loading) {
    return <PageLoader />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  
  return children;
};

const NotFound = () => (
  <div className="flex flex-col min-h-[70vh] items-center justify-center bg-[#F8F9FA] text-center px-4 font-sans relative overflow-hidden">
    <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-[#FF4500] rounded-full mix-blend-multiply filter blur-[128px] opacity-10 pointer-events-none"></div>
    <motion.h1 
      initial={{ scale: 0.8, opacity: 0 }} 
      animate={{ scale: 1, opacity: 1 }} 
      className="text-9xl font-black text-slate-200 tracking-tighter select-none"
    >
      404
    </motion.h1>
    <motion.div 
      initial={{ y: 20, opacity: 0 }} 
      animate={{ y: 0, opacity: 1 }} 
      transition={{ delay: 0.2 }} 
      className="relative z-10 -mt-8"
    >
      <h2 className="text-3xl font-black text-slate-900 mb-3">Page Not Found</h2>
      <p className="text-slate-500 font-medium mb-8">The page you are looking for doesn't exist or has been moved.</p>
      <a 
        href="/" 
        className="bg-slate-900 hover:bg-[#FF4500] text-white px-8 py-4 rounded-xl font-bold transition-all shadow-lg active:scale-95 inline-block focus:ring-4 focus:ring-slate-300 outline-none cursor-pointer"
      >
        RETURN TO STORE
      </a>
    </motion.div>
  </div>
);

// --- Main Application Entry ---

const App = () => {
  return (
    <GlobalErrorBoundary>
      {/* 🔥 PHASE 8: Wrapped App in QueryClientProvider */}
      <QueryClientProvider client={queryClient}>
        <ProductProvider>
          <UserProvider>
            <CartProvider>
              <SettingsProvider>
                <CompareProvider>
                  <Router>
                    <ScrollManager /> 
                    <EnterpriseAnalyticsManager /> 
                    <SEOManager />
                    
                    <Routes>
                      {/* StoreLayout uses UserContext as single source of truth */}
                      <Route element={<StoreLayout />}>
                        
                        <Route path="/" element={<Home />} />
                        <Route path="/shop" element={<Shop />} />
                        <Route path="/product/:id" element={<ProductDetails />} />
                        <Route path="/cart" element={<Cart />} />
                        <Route path="/wishlist" element={
                          <RequireAuth>
                            <Wishlist />
                          </RequireAuth>
                        } />
                        
                        {/* SEO Content Engine Routes */}
                        <Route path="/comparisons" element={<Comparisons />} />

                        <Route path="/help-center" element={<HelpCenter />} />
                        <Route path="/returns" element={<ReturnsPage />} />
                        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                        <Route path="/terms" element={<TermsOfService />} />
                        <Route path="/about" element={<AboutUs />} />
                        <Route path="/contact" element={<ContactUs />} />
                        <Route path="/track-order" element={
                          <RequireAuth>
                            <TrackOrder />
                          </RequireAuth>
                        } />

                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Register />} />
                        <Route path="/forgot-password" element={<ForgotPassword />} /> 
                        <Route path="/secure-account" element={<SecureAccount />} />
                        <Route path="/unlock-account" element={<UnlockAccount />} />
                        
                        <Route path="/checkout" element={
                          <RequireAuth>
                            <Checkout />
                          </RequireAuth>
                        } />
                        <Route path="/profile" element={
                          <RequireAuth>
                            <Profile />
                          </RequireAuth>
                        } />
                        <Route path="/order/:id" element={
                          <RequireAuth>
                            <OrderDetails />
                          </RequireAuth>
                        } />
                        
                        <Route path="*" element={<NotFound />} />
                      </Route>
                    </Routes>

                    <SpeedInsights />
                    <Analytics />
                  </Router>
                </CompareProvider>
              </SettingsProvider>
            </CartProvider>
          </UserProvider>
        </ProductProvider>
      </QueryClientProvider>
    </GlobalErrorBoundary>
  );
};

export default App;