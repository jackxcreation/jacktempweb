// src/context/CartContext.jsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiCheckCircle } from 'react-icons/fi';
import { API_URL } from '../config';
import { getOptimizedImageUrl } from '../utils/imageOptimizer';

const CartContext = createContext();
export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  
  const getCartKey = () => {
    try {
      const storedUser = JSON.parse(localStorage.getItem('jack_user'));
      return storedUser && storedUser.id ? `jack_cart_${storedUser.id}` : 'jack_cart_guest';
    } catch (e) {
      return 'jack_cart_guest';
    }
  };

  const [cart, setCart] = useState(() => {
    try {
      const savedCart = localStorage.getItem(getCartKey());
      return savedCart ? JSON.parse(savedCart) : [];
    } catch (error) {
      console.error("Failed to parse cart from localStorage:", error);
      return [];
    }
  });
  
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    const optimizedCart = cart.map(item => {
      if (item.image && String(item.image).startsWith('data:image')) {
        const { image, images, ...rest } = item; 
        return rest;
      }
      return item;
    });

    try {
      localStorage.setItem(getCartKey(), JSON.stringify(optimizedCart));
    } catch (error) {
      console.error("Cart storage limit exceeded!", error);
    }
  }, [cart]);

  useEffect(() => {
    const handleAuthChange = () => {
      const currentKey = getCartKey();
      const activeKey = localStorage.getItem('active_cart_key') || 'jack_cart_guest';

      if (currentKey !== activeKey) {
        localStorage.setItem('active_cart_key', currentKey);
        try {
          const savedCart = localStorage.getItem(currentKey);
          setCart(savedCart ? JSON.parse(savedCart) : []); 
        } catch (e) {
          setCart([]);
        }
      }
    };

    window.addEventListener('storage', handleAuthChange);
    window.addEventListener('jack_auth_change', handleAuthChange); 
    
    handleAuthChange();

    return () => {
      window.removeEventListener('storage', handleAuthChange);
      window.removeEventListener('jack_auth_change', handleAuthChange);
    };
  }, []);

  useEffect(() => {
    const syncCartToBackend = async () => {
      try {
        const storedUser = JSON.parse(localStorage.getItem('jack_user'));
        const token = localStorage.getItem('token') || localStorage.getItem('jack_token') || localStorage.getItem('admin_token');
        
        if (storedUser && storedUser.id && token) {
          const optimizedPayloadItems = cart.map(item => ({
            productId: item.id || item._id,
            quantity: item.quantity
          }));

          await fetch(`${API_URL}/sync-cart`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({
              userId: storedUser.id, 
              items: optimizedPayloadItems 
            })
          });
        }
      } catch (error) {
        console.error("Cart sync failed:", error);
      }
    };

    const syncTimeout = setTimeout(() => {
      syncCartToBackend();
    }, 1000);

    return () => clearTimeout(syncTimeout);
  }, [cart]);

  const cartCount = cart.reduce((total, item) => total + (item.quantity || 1), 0);
  
  const cartTotalPaise = cart.reduce((total, item) => {
    let pPaise = item.pricePaise;
    if (pPaise === undefined || pPaise === null) {
      const cleanPriceString = String(item.price || '0').replace(/[^0-9.]/g, '');
      pPaise = Math.round(Number(cleanPriceString) * 100);
    }
    return total + (pPaise * (item.quantity || 1));
  }, 0);

  const cartTotal = cartTotalPaise / 100;

  const addToCart = (product) => {
    if (!product) return;
    const productId = product.id || product._id;
    const rawImage = product.image || (product.images && product.images[0]) || '';
    const optimizedImage = getOptimizedImageUrl(rawImage, 320);

    let pricePaise = product.pricePaise;
    if (pricePaise === undefined || pricePaise === null) {
      const cleanPrice = String(product.price || '0').replace(/[^0-9.]/g, '');
      pricePaise = Math.round(Number(cleanPrice) * 100);
    }
    
    let mrpPaise = product.mrpPaise;
    if (mrpPaise === undefined || mrpPaise === null) {
      const cleanMrp = String(product.mrp || '0').replace(/[^0-9.]/g, '');
      mrpPaise = product.mrp ? Math.round(Number(cleanMrp) * 100) : pricePaise;
    }

    setCart((prevCart) => {
      const existingItem = prevCart.find(item => String(item.id) === String(productId));
      if (existingItem) {
        return prevCart.map(item => 
          String(item.id) === String(productId) ? { ...item, quantity: (item.quantity || 1) + 1 } : item
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
    setToastMessage(`${product.title || product.name || 'Item'} added to cart!`); 
    setTimeout(() => setToastMessage(''), 3000);
  };

  const removeFromCart = (id) => {
    setCart((prevCart) => prevCart.filter(item => String(item.id) !== String(id)));
    setToastMessage('Item removed from cart');
    setTimeout(() => setToastMessage(''), 3000);
  };

  const updateQuantity = (id, action) => {
    setCart((prevCart) => prevCart.map(item => {
      if (String(item.id) === String(id)) {
        const currentQty = item.quantity || 1;
        const newQuantity = action === 'increase' ? currentQty + 1 : currentQty - 1;
        return { ...item, quantity: Math.max(1, newQuantity) }; 
      }
      return item;
    }));
  };

  const clearCart = () => {
    setCart([]);
    try {
      localStorage.removeItem(getCartKey()); 
    } catch (e) {}
  };

  return (
    <CartContext.Provider value={{ 
      cart, addToCart, removeFromCart, updateQuantity, clearCart, cartCount, cartTotal, cartTotalPaise 
    }}>
      {children}
      
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

export default CartProvider;