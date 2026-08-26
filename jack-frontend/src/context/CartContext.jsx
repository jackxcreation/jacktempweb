import React, { createContext, useState, useContext, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiCheckCircle } from 'react-icons/fi';
import { API_URL } from '../config';
import { getOptimizedImageUrl } from '../utils/imageOptimizer';

const CartContext = createContext();
export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  
  // 🔥 FIX 1: Har user ke liye ek unique Cart Key generate hogi
  const getCartKey = () => {
    const storedUser = JSON.parse(localStorage.getItem('jack_user'));
    return storedUser && storedUser.id ? `jack_cart_${storedUser.id}` : 'jack_cart_guest';
  };

  const [cart, setCart] = useState(() => {
    const savedCart = localStorage.getItem(getCartKey());
    return savedCart ? JSON.parse(savedCart) : [];
  });
  
  const [toastMessage, setToastMessage] = useState('');

  // ✅ NAYA BULLETPROOF CODE (Cloudinary URL ko allow karega)
  useEffect(() => {
    const optimizedCart = cart.map(item => {
      // Agar image ka data Base64 hai, sirf tabhi delete karo memory bachane ke liye
      if (item.image && String(item.image).startsWith('data:image')) {
        const { image, images, ...rest } = item; 
        return rest;
      }
      // Agar Cloudinary URL ya normal link hai, toh rehne do
      return item;
    });

    try {
      localStorage.setItem(getCartKey(), JSON.stringify(optimizedCart));
    } catch (error) {
      console.error("Cart storage limit exceeded!", error);
    }
  }, [cart]);

  // 🔥 PHASE 8 FIX: Removed 500ms polling interval. Using secure Auth State Event Listeners instead.
  useEffect(() => {
    const handleAuthChange = () => {
      const currentKey = getCartKey();
      const activeKey = localStorage.getItem('active_cart_key') || 'jack_cart_guest';

      // Agar user login ya logout کرتا hai, toh key change hogi
      if (currentKey !== activeKey) {
        localStorage.setItem('active_cart_key', currentKey);
        const savedCart = localStorage.getItem(currentKey);
        setCart(savedCart ? JSON.parse(savedCart) : []); // Naye user ka cart load karo
      }
    };

    // Listeners directly catch login/logout instead of wasting CPU every 500ms
    window.addEventListener('storage', handleAuthChange);
    // Custom event dispatch if login happens in same tab
    window.addEventListener('jack_auth_change', handleAuthChange); 
    
    handleAuthChange(); // Initial check

    return () => {
      window.removeEventListener('storage', handleAuthChange);
      window.removeEventListener('jack_auth_change', handleAuthChange);
    };
  }, []);

  // 🔥 PHASE 8 FIX: Backend Sync Logic (Added Headers, Removed Full User Object, Sent only ID & QTY)
  useEffect(() => {
    const syncCartToBackend = async () => {
      const storedUser = JSON.parse(localStorage.getItem('jack_user'));
      const token = localStorage.getItem('token');
      
      if (storedUser && storedUser.id && token) {
        try {
          // PHASE 8: Send product IDs and quantities only to backend (Save bandwidth & DB space)
          const optimizedPayloadItems = cart.map(item => ({
            productId: item.id || item._id,
            quantity: item.quantity
          }));

          await fetch(`${API_URL}/sync-cart`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}` // 🔥 PHASE 8: Add Authorization header to cart sync
            },
            body: JSON.stringify({
              userId: storedUser.id, // 🔥 PHASE 8: Do not send complete user object
              items: optimizedPayloadItems 
            })
          });
        } catch (error) {
          console.error("Cart sync failed:", error);
        }
      }
    };

    // Debounce to prevent API spamming if user clicks "+/-" multiple times quickly
    const syncTimeout = setTimeout(() => {
      syncCartToBackend();
    }, 1000);

    return () => clearTimeout(syncTimeout);
  }, [cart]);

  // Calculations
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  
  // 🔥 Canonical Paisa-safe financial metrics handling
  const cartTotalPaise = cart.reduce((total, item) => {
    const pricePaise = item.pricePaise || (item.price ? Math.round(Number(item.price) * 100) : 0);
    return total + (pricePaise * item.quantity);
  }, 0);

  const cartTotal = cart.reduce((total, item) => {
    const priceString = String(item.price || item.pricePaise || 0).replace(/[^0-9]/g, ''); 
    return total + (parseInt(priceString, 10) * item.quantity);
  }, 0);

  // 1. Add to Cart with Image Optimization support
  const addToCart = (product) => {
    if (!product) return;
    const productId = product.id || product._id;
    const rawImage = product.image || (product.images && product.images[0]) || '';
    const optimizedImage = getOptimizedImageUrl(rawImage, 320);

    const pricePaise = product.pricePaise || (product.price ? Math.round(Number(product.price) * 100) : 0);
    const mrpPaise = product.mrpPaise || (product.mrp ? Math.round(Number(product.mrp) * 100) : pricePaise);

    setCart((prevCart) => {
      const existingItem = prevCart.find(item => String(item.id) === String(productId));
      if (existingItem) {
        return prevCart.map(item => 
          String(item.id) === String(productId) ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prevCart, { 
        ...product, 
        id: productId,
        image: optimizedImage,
        pricePaise,
        mrpPaise,
        quantity: 1 
      }];
    });
    setToastMessage(`${product.title} added to cart!`); 
    setTimeout(() => setToastMessage(''), 3000);
  };

  // 2. Remove from Cart
  const removeFromCart = (id) => {
    setCart((prevCart) => prevCart.filter(item => String(item.id) !== String(id)));
    setToastMessage('Item removed from cart');
    setTimeout(() => setToastMessage(''), 3000);
  };

  // 3. Update Quantity (+ / -)
  const updateQuantity = (id, action) => {
    setCart((prevCart) => prevCart.map(item => {
      if (String(item.id) === String(id)) {
        const newQuantity = action === 'increase' ? item.quantity + 1 : item.quantity - 1;
        return { ...item, quantity: Math.max(1, newQuantity) }; 
      }
      return item;
    }));
  };

  // 4. Clear Cart
  const clearCart = () => {
    setCart([]);
    localStorage.removeItem(getCartKey()); // Sirf usi user ka cart delete hoga
  };

  return (
    <CartContext.Provider value={{ 
      cart, addToCart, removeFromCart, updateQuantity, clearCart, cartCount, cartTotal, cartTotalPaise 
    }}>
      {children}
      
      {/* 🔥 NEW PREMIUM SLEEK TOAST ANIMATION 🔥 */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-slate-900/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-2xl z-[100] flex items-center gap-3 border border-slate-700"
          >
            <div className="bg-green-500/20 p-2 rounded-full text-green-400 flex-shrink-0">
              <FiCheckCircle size={20} />
            </div>
            
            <div className="flex flex-col overflow-hidden w-full">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                Success
              </span>
              <span className="text-sm font-bold text-white truncate w-full">
                {toastMessage} 
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </CartContext.Provider>
  );
};