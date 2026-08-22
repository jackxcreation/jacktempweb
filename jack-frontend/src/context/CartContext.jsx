import React, { createContext, useState, useContext, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiCheckCircle } from 'react-icons/fi'; // 🔥 ADDED ICON
import { API_URL } from '../config';

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

  // 🔥 FIX 3: THE MAGIC OBSERVER (Login/Logout detect karke cart switch karega)
  useEffect(() => {
    const checkAuthInterval = setInterval(() => {
      const currentKey = getCartKey();
      const activeKey = localStorage.getItem('active_cart_key') || 'jack_cart_guest';

      // Agar user login ya logout karta hai, toh key change hogi
      if (currentKey !== activeKey) {
        localStorage.setItem('active_cart_key', currentKey);
        const savedCart = localStorage.getItem(currentKey);
        setCart(savedCart ? JSON.parse(savedCart) : []); // Naye user ka cart load karo
      }
    }, 500); // Har half-second mein check karega (invisible to the user)

    return () => clearInterval(checkAuthInterval);
  }, []);

  // 🔥 Backend Sync Logic (As it was, but safer)
  useEffect(() => {
    const syncCartToBackend = async () => {
      const storedUser = JSON.parse(localStorage.getItem('jack_user'));
      
      const currentCartTotal = cart.reduce((total, item) => {
        const priceString = String(item.price).replace(/[^0-9]/g, '');
        return total + (parseInt(priceString, 10) * item.quantity);
      }, 0);

      if (storedUser && storedUser.id) {
        try {
          await fetch(`${API_URL}/sync-cart`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user: storedUser,
              items: cart, 
              totalValue: currentCartTotal
            })
          });
        } catch (error) {
          console.error("Cart sync failed:", error);
        }
      }
    };

    syncCartToBackend();
  }, [cart]);

  // Calculations
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const cartTotal = cart.reduce((total, item) => {
    const priceString = String(item.price).replace(/[^0-9]/g, ''); 
    return total + (parseInt(priceString, 10) * item.quantity);
  }, 0);

  // 1. Add to Cart
  const addToCart = (product) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find(item => item.id === product.id);
      if (existingItem) {
        return prevCart.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prevCart, { ...product, quantity: 1 }];
    });
    setToastMessage(`${product.title} added to cart!`); // Cleaned emoji for premium UI
    setTimeout(() => setToastMessage(''), 3000);
  };

  // 2. Remove from Cart
  const removeFromCart = (id) => {
    setCart((prevCart) => prevCart.filter(item => item.id !== id));
    setToastMessage('Item removed from cart');
    setTimeout(() => setToastMessage(''), 3000);
  };

  // 3. Update Quantity (+ / -)
  const updateQuantity = (id, action) => {
    setCart((prevCart) => prevCart.map(item => {
      if (item.id === id) {
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
      cart, addToCart, removeFromCart, updateQuantity, clearCart, cartCount, cartTotal 
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