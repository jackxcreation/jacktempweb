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

  // 🔥 HELPER: Get token from localStorage
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
            'Authorization': `Bearer ${token}` // 🔥 Send Token here
          },
          credentials: 'include' 
        });

        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
          setRecentlyViewed(userData.recentlyViewed || []);
          localStorage.setItem('jack_user', JSON.stringify(userData));
        } else {
          // Session invalid or expired
          localStorage.removeItem('jack_user');
          localStorage.removeItem('token');
          setUser(null);
        }
      } catch (error) {
        console.error("Session verification network error:", error);
      } finally {
        setIsLoadingSession(false);
      }
    };

    verifyUserSession();
  }, []);

  // 🔥 FIX: Safe ID getter for all useEffects (Only calls ONCE after session load)
  useEffect(() => {
    if (isLoadingSession) return; 

    const userId = user?.id || user?._id;
    if (userId && getToken()) {
      fetchUserOrders(userId);
      syncRecentlyViewed(userId);
      fetchWishlist(); 
    }
  }, [user?.id, user?._id, isLoadingSession]); 

  // 🔥 FETCH WISHLIST FROM BACKEND
  const fetchWishlist = async () => {
    try {
      const res = await fetch(`${API_URL}/wishlist`, {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}` // 🔥 Send Token
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

  // 🔥 TOGGLE ADD/REMOVE FROM WISHLIST
  const toggleWishlist = async (productId) => {
    try {
      const res = await fetch(`${API_URL}/wishlist/toggle`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}` // 🔥 Send Token
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
          'Authorization': `Bearer ${getToken()}` // 🔥 Send Token
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

  // HELPER: Connect socket securely with credentials
  const connectSecureSocket = () => {
    const token = getToken();
    if (token) {
      socket.auth = { token }; // 🔥 Secure socket with token
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
        // 🔥 FIX: Store the token so subsequent requests work!
        localStorage.setItem('token', data.token);

        setUser(data.user);
        setRecentlyViewed(data.user.recentlyViewed || []);
        localStorage.setItem('jack_user', JSON.stringify(data.user));
        
        // Connect socket after successful login
        connectSecureSocket();

        // 🚨 Note: Removed explicit fetchUserOrders/fetchWishlist here to stop Double-Fire (429 Error).
        // The useEffect will automatically handle fetching them once state updates.

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
        // 🔥 FIX: Store the token!
        localStorage.setItem('token', data.token);

        setUser(data.user);
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
    setOrders([]);
    setWishlist([]);
    setRecentlyViewed([]);
    localStorage.removeItem('jack_user');
    localStorage.removeItem('token'); // 🔥 Remove token on logout
    socket.disconnect(); 
  };

  const fetchUserOrders = async (userId) => {
    try {
      const res = await fetch(`${API_URL}/orders/user/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}` // 🔥 Send Token
        },
        credentials: 'include' 
      });
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();
      setOrders(data);
    } catch (error) { console.error("Error fetching orders:", error); }
  };

  // 🔥 BULLETPROOF PLACE ORDER 🔥
  const placeOrder = async (items, totalAmount, address, paymentMethod, trafficSource) => {
    if (!user) return { success: false, error: "Please login first" };

    const orderData = { 
      items, 
      totalAmount: totalAmount.toString(), 
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
          'Authorization': `Bearer ${getToken()}` // 🔥 Send Token
        },
        credentials: 'include', 
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
      const userId = user.id || user._id;
      await fetch(`${API_URL}/users/${userId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}` // 🔥 Send Token
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
          'Authorization': `Bearer ${getToken()}` // 🔥 Send Token
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
      connectSecureSocket(); // Securely connect
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
      user, orders, recentlyViewed, wishlist, isLoadingSession,
      loginUser, socialLoginUser, logoutUser, placeOrder, cancelOrder, addRecentlyViewed, 
      updateUserProfile, syncRecentlyViewed, fetchWishlist, toggleWishlist, socket
    }}>
      {children}
    </UserContext.Provider>
  );
};