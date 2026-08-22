import React, { createContext, useState, useContext, useEffect } from 'react';
import { API_URL } from '../config';
import { io } from 'socket.io-client';

const UserContext = createContext();
export const useUser = () => useContext(UserContext);

const socket = io(API_URL.replace('/api', ''));

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('jack_user');
    return storedUser ? JSON.parse(storedUser) : null;
  });

  const [recentlyViewed, setRecentlyViewed] = useState(() => {
    const storedUser = localStorage.getItem('jack_user');
    return storedUser ? JSON.parse(storedUser).recentlyViewed || [] : [];
  });

  const [orders, setOrders] = useState([]);

  // 🔥 FIX: Safe ID getter for all useEffects
  useEffect(() => {
    const userId = user?.id || user?._id;
    if (userId) {
      fetchUserOrders(userId);
      syncRecentlyViewed(userId);
    }
  }, [user?.id, user?._id]); 

  const syncRecentlyViewed = async (userId) => {
    try {
      const res = await fetch(`${API_URL}/users/get-valid-recently-viewed/${userId}`);
      if (res.ok) {
        const validProducts = await res.json();
        setRecentlyViewed(validProducts);
        const updatedUser = { ...user, recentlyViewed: validProducts };
        localStorage.setItem('jack_user', JSON.stringify(updatedUser));
      }
    } catch (error) { console.error("Sync Recently Viewed Error:", error); }
  };

  const loginUser = async (email, password) => {
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        setRecentlyViewed(data.user.recentlyViewed || []);
        localStorage.setItem('jack_user', JSON.stringify(data.user));
        localStorage.setItem('token', data.token || 'real_user_token'); 
        
        // 🔥 FIX: Safe ID fallback
        const validId = data.user.id || data.user._id;
        fetchUserOrders(validId);
        
        return { success: true };
      }
      return { success: false, message: data.error || data.message || "Login failed" }; 
    } catch (error) { return { success: false, message: "Server error" }; }
  };

  const socialLoginUser = async (name, email, firebaseId) => {
    try {
      const res = await fetch(`${API_URL}/auth/social-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, googleId: firebaseId }) 
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        setRecentlyViewed(data.user.recentlyViewed || []);
        localStorage.setItem('jack_user', JSON.stringify(data.user));
        localStorage.setItem('token', data.token || 'oauth_token');
        
        // 🔥 FIX: Safe ID fallback
        const validId = data.user.id || data.user._id;
        fetchUserOrders(validId);
        
        return { success: true, isNewUser: data.isNewUser }; 
      }
      return { success: false };
    } catch (error) { return { success: false }; }
  };

  const logoutUser = () => {
    setUser(null);
    setOrders([]);
    setRecentlyViewed([]);
    localStorage.removeItem('jack_user');
    localStorage.removeItem('token');
  };

  const fetchUserOrders = async (userId) => {
    try {
      const res = await fetch(`${API_URL}/orders/user/${userId}`);
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();
      setOrders(data);
    } catch (error) { console.error("Error fetching orders:", error); }
  };

  // 🔥 BULLETPROOF PLACE ORDER 🔥
  const placeOrder = async (items, totalAmount, address, paymentMethod, trafficSource) => {
    if (!user) return { success: false, error: "Please login first" };
    
    // Defensive ID check
    const userId = user.id || user._id;

    const orderData = { 
      userId, 
      items, 
      totalAmount: totalAmount.toString(), 
      status: "Processing",
      address,
      paymentMethod,
      userDetails: { name: user.name, email: user.email },
      trafficSource 
    };

    try {
      const res = await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });
      
      const newOrder = await res.json();
      
      if (!res.ok) {
        throw new Error(newOrder.message || "Failed to place order");
      }
      
      setOrders(prevOrders => [newOrder, ...prevOrders]); 
      return { success: true, order: newOrder };
    } catch (error) { 
      console.error("Order Place Error:", error);
      return { success: false, error: error.message }; 
    }
  };

  const addRecentlyViewed = async (product) => {
    if (!user) return; 
    const exists = recentlyViewed.find(p => p.id === product.id);
    if (exists) return;

    const { image, images, ...safeProduct } = product;
    const newHistory = [safeProduct, ...recentlyViewed].slice(0, 4);
    
    setRecentlyViewed(newHistory);
    try {
      // 🔥 FIX: Safe ID fallback
      const userId = user.id || user._id;
      await fetch(`${API_URL}/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recentlyViewed: newHistory })
      });
      const updatedUser = { ...user, recentlyViewed: newHistory };
      setUser(updatedUser);
      localStorage.setItem('jack_user', JSON.stringify(updatedUser));
    } catch (error) { console.error("Error updating history:", error); }
  };

  const updateUserProfile = async (updatedData) => {
    if (!user) return false;
    try {
      // 🔥 FIX: MAIN ISSUE RESOLVED HERE 🔥
      const userId = user.id || user._id;
      
      const res = await fetch(`${API_URL}/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });
      const data = await res.json();
      if (!res.ok) return false;
      const newData = { ...user, ...data };
      setUser(newData);
      localStorage.setItem('jack_user', JSON.stringify(newData));
      return true;
    } catch (error) { return false; }
  };

  const cancelOrder = (orderId) => {
    setOrders(prevOrders => 
      prevOrders.map(order => order.id === orderId ? { ...order, status: 'Cancelled' } : order)
    );
  };

  useEffect(() => {
    const userId = user?.id || user?._id;
    if (userId) {
      socket.emit('join_user_room', userId);
      socket.on('force_logout', () => {
        logoutUser();
        alert("Your session was terminated for security.");
        window.location.href = '/login'; 
      });
    }
    return () => socket.off('force_logout');
  }, [user?.id, user?._id]); 

  return (
    <UserContext.Provider value={{ 
      user, orders, recentlyViewed, 
      loginUser, socialLoginUser, logoutUser, placeOrder, cancelOrder, addRecentlyViewed, 
      updateUserProfile, syncRecentlyViewed 
    }}>
      {children}
    </UserContext.Provider>
  );
};