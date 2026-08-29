import React, { createContext, useState, useContext, useEffect } from 'react';
import { API_URL } from '../config';
import { io } from 'socket.io-client';

const UserContext = createContext();
export const useUser = () => useContext(UserContext);

// Initialize socket without auto-connecting so we can inject cookies/auth later
const socket = io(API_URL.replace('/api', ''), { autoConnect: false, withCredentials: true });

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
  const [wishlist, setWishlist] = useState([]); 
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  
  // 🔥 PHASE 4 FIX: Consolidated Admin State into single Auth Context
  const [isAdmin, setIsAdmin] = useState(false);

  const getToken = () => localStorage.getItem('token');

  // 🔥 CLEAN SESSION VALIDATION VIA /auth/me AT STARTUP
  useEffect(() => {
    const verifyUserSession = async () => {
      try {
        const token = getToken();
        if (!token) {
          setIsLoadingSession(false);
          return;
        }

        const res = await fetch(`${API_URL}/auth/me`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
          },
          credentials: 'include' 
        });

        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
          setRecentlyViewed(userData.recentlyViewed || []);
          
          // 🔥 PHASE 4 FIX: Automatically identify if user is Admin
          setIsAdmin(userData.role === 'admin' || userData.role === 'manager');
          
          localStorage.setItem('jack_user', JSON.stringify(userData));
        } else {
          // Session invalid or expired
          localStorage.removeItem('jack_user');
          localStorage.removeItem('token');
          localStorage.removeItem('adminToken'); // Clear legacy token if exists
          setUser(null);
          setIsAdmin(false);
        }
      } catch (error) {
        console.error("Session verification network error:", error);
      } finally {
        setIsLoadingSession(false);
      }
    };

    verifyUserSession();
  }, []);

  useEffect(() => {
    if (isLoadingSession) return; 

    const userId = user?.id || user?._id;
    if (userId && getToken()) {
      fetchUserOrders(userId);
      syncRecentlyViewed(userId);
      fetchWishlist(); 
    }
  }, [user?.id, user?._id, isLoadingSession]); 

  const fetchWishlist = async () => {
    try {
      const res = await fetch(`${API_URL}/wishlist`, {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}` 
        },
        credentials: 'include'
      });
      const data = await res.json();
      if (data.success) {
        setWishlist(data.wishlist);
      }
    } catch (err) {
      console.error("Failed to load wishlist", err);
    }
  };

  const toggleWishlist = async (productId) => {
    try {
      const res = await fetch(`${API_URL}/wishlist/toggle`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        credentials: 'include',
        body: JSON.stringify({ productId })
      });
      const data = await res.json();
      if (data.success) {
        setWishlist(data.wishlist);
        return data.isAdded;
      }
    } catch (err) {
      console.error("Wishlist toggle error", err);
    }
  };

  const syncRecentlyViewed = async (userId) => {
    try {
      const res = await fetch(`${API_URL}/users/get-valid-recently-viewed/${userId}`, {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        credentials: 'include' 
      });
      if (res.ok) {
        const validProducts = await res.json();
        setRecentlyViewed(validProducts);
        const updatedUser = { ...user, recentlyViewed: validProducts };
        localStorage.setItem('jack_user', JSON.stringify(updatedUser));
      }
    } catch (error) { console.error("Sync Recently Viewed Error:", error); }
  };

  const connectSecureSocket = () => {
    const token = getToken();
    if (token) {
      socket.auth = { token }; 
      socket.connect();
    }
  };

  const loginUser = async (email, password) => {
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include' 
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);

        // 🔥 PHASE 4 FIX: Centralized Admin Auth Handshake
        const userIsAdmin = data.user.role === 'admin' || data.user.role === 'manager';
        if (userIsAdmin) {
          localStorage.setItem('adminToken', data.token); // Maintained for backward compatibility in Admin panel
        }
        setIsAdmin(userIsAdmin);

        setUser(data.user);
        setRecentlyViewed(data.user.recentlyViewed || []);
        localStorage.setItem('jack_user', JSON.stringify(data.user));
        
        connectSecureSocket();
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
        body: JSON.stringify({ name, email, googleId: firebaseId }),
        credentials: 'include' 
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        setUser(data.user);
        setIsAdmin(data.user.role === 'admin');
        setRecentlyViewed(data.user.recentlyViewed || []);
        localStorage.setItem('jack_user', JSON.stringify(data.user));
        connectSecureSocket();
        return { success: true, isNewUser: data.isNewUser }; 
      }
      return { success: false };
    } catch (error) { return { success: false }; }
  };

  const logoutUser = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (err) {
      console.error("Logout API error:", err);
    }

    setUser(null);
    setIsAdmin(false);
    setOrders([]);
    setWishlist([]);
    setRecentlyViewed([]);
    localStorage.removeItem('jack_user');
    localStorage.removeItem('token'); 
    localStorage.removeItem('adminToken'); // Clean admin token as well
    socket.disconnect(); 
  };

  const fetchUserOrders = async (userId) => {
    try {
      const res = await fetch(`${API_URL}/orders/user/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        credentials: 'include' 
      });
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();
      setOrders(data);
    } catch (error) { console.error("Error fetching orders:", error); }
  };

  // 🔥 FIXED: placeOrder now handles both raw cart items and pre-mapped items gracefully
  const placeOrder = async (items, totalAmount, address, paymentMethod, trafficSource) => {
    if (!user) return { success: false, error: "Please login first" };

    const orderItems = items.map((item) => ({
      productId: item.productId || item.id || item._id, // 🔥 Bulletproof mapping
      quantity: Number(item.quantity),
    }));

    const orderData = { 
      items: orderItems, 
      address,
      paymentMethod,
      userDetails: { name: user.name, email: user.email },
      trafficSource 
    };

    try {
      const res = await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        credentials: 'include', 
        body: JSON.stringify(orderData)
      });
      
      const newOrder = await res.json();
      
      if (!res.ok) {
        console.error("Order API Error:", newOrder);
        throw new Error(
          newOrder.error || 
          newOrder.message || 
          (newOrder.errors ? JSON.stringify(newOrder.errors) : null) || 
          "Failed to place order"
        );
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
      const userId = user.id || user._id;
      await fetch(`${API_URL}/users/${userId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        credentials: 'include',
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
      const userId = user.id || user._id;
      
      const res = await fetch(`${API_URL}/users/${userId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        credentials: 'include',
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
    if (isLoadingSession) return;

    const userId = user?.id || user?._id;
    if (userId && getToken()) {
      connectSecureSocket(); 
      socket.emit('join_user_room', userId);
      
      socket.on('force_logout', () => {
        logoutUser();
        alert("Your session was terminated for security.");
        window.location.href = '/login'; 
      });
    }
    return () => socket.off('force_logout');
  }, [user?.id, user?._id, isLoadingSession]); 

  return (
    <UserContext.Provider value={{ 
      user, orders, recentlyViewed, wishlist, isLoadingSession, isAdmin,
      loginUser, socialLoginUser, logoutUser, placeOrder, cancelOrder, addRecentlyViewed, 
      updateUserProfile, syncRecentlyViewed, fetchWishlist, toggleWishlist, socket
    }}>
      {children}
    </UserContext.Provider>
  );
};