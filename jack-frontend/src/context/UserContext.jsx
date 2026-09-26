// jack-frontend/src/context/UserContext.jsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import { API_URL } from '../config';
import { io } from 'socket.io-client';

// 🔥 FIXED: Added 'export' so App.jsx can import UserContext correctly
export const UserContext = createContext();
export const useUser = () => useContext(UserContext);

// Initialize socket without auto-connecting so we can inject cookies/auth later
const socket = io(API_URL ? API_URL.replace('/api', '') : 'http://localhost:5000', { autoConnect: false, withCredentials: true });

export const UserProvider = ({ children }) => {
  // 🔥 Removed insecure localStorage user parsing on initial boot. Start with null.
  const [user, setUser] = useState(null);
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const [orders, setOrders] = useState([]);
  const [wishlist, setWishlist] = useState([]); 
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  
  // 🔥 Consolidated Admin State into single Auth Context
  const [isAdmin, setIsAdmin] = useState(false);

  // 🔥 Auth is now handled purely via HTTP-only secure cookies (`credentials: 'include'`). 
  // No localStorage token extraction needed. Kept as a dummy helper for legacy compatibility if required.
  const getToken = () => null;

  // 🔥 CLEAN SESSION VALIDATION VIA /auth/me AT STARTUP USING HTTP-ONLY COOKIES
  useEffect(() => {
    const verifyUserSession = async () => {
      try {
        const res = await fetch(`${API_URL}/auth/me`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include' // 🔥 Crucial for sending HTTP-only cookies
        });

        if (res.ok) {
          const json = await res.json();
          // 🔥 SMART EXTRACTOR: Handle standardized API response format { success: true, data: {...} }
          const userData = json.data || json; 

          setUser(userData);
          setRecentlyViewed(userData.recentlyViewed || []);
          
          // Automatically identify if user is Admin
          setIsAdmin(userData.role === 'admin' || userData.role === 'manager' || userData.role === 'super_admin');
        } else {
          // Session invalid or expired
          setUser(null);
          setIsAdmin(false);
          setRecentlyViewed([]);
        }
      } catch (error) {
        console.error("Session verification network error:", error);
        setUser(null);
        setIsAdmin(false);
      } finally {
        setIsLoadingSession(false);
      }
    };

    verifyUserSession();
  }, []);

  useEffect(() => {
    if (isLoadingSession) return; 

    const userId = user?.id || user?._id;
    if (userId) {
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
          'Content-Type': 'application/json'
        },
        credentials: 'include' // 🔥 HTTP-only cookie authentication
      });
      const json = await res.json();
      if (json.success || res.ok) {
        const wishlistData = json.data?.wishlist || json.data || json.wishlist || [];
        setWishlist(wishlistData);
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
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ productId })
      });
      const json = await res.json();
      if (json.success || res.ok) {
        const wishlistData = json.data?.wishlist || json.data || json.wishlist || [];
        const isAdded = json.data?.isAdded !== undefined ? json.data.isAdded : json.isAdded;
        setWishlist(wishlistData);
        return isAdded;
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
          'Content-Type': 'application/json'
        },
        credentials: 'include' 
      });
      if (res.ok) {
        const json = await res.json();
        const validProducts = json.data || json;
        setRecentlyViewed(validProducts);
        setUser(prev => prev ? { ...prev, recentlyViewed: validProducts } : null);
      }
    } catch (error) { console.error("Sync Recently Viewed Error:", error); }
  };

  const connectSecureSocket = () => {
    // Socket automatically transmits cookies if withCredentials is true
    if (!socket.connected) {
      socket.connect();
    }
  };

  const loginUser = async (email, password) => {
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include' // 🔥 Server sets HTTP-only secure cookie
      });
      const json = await res.json();
      if (res.ok || json.success) {
        // 🔥 SMART EXTRACTOR
        const loggedInUser = json.data?.user || json.data || json.user;
        const userIsAdmin = loggedInUser.role === 'admin' || loggedInUser.role === 'manager' || loggedInUser.role === 'super_admin';
        
        setIsAdmin(userIsAdmin);
        setUser(loggedInUser);
        setRecentlyViewed(loggedInUser.recentlyViewed || []);
        
        connectSecureSocket();
        return { success: true };
      }
      return { success: false, message: json.error || json.message || "Login failed" }; 
    } catch (error) { return { success: false, message: "Server connection error" }; }
  };

  const socialLoginUser = async (name, email, firebaseId) => {
    try {
      const res = await fetch(`${API_URL}/auth/social/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, googleId: firebaseId }),
        credentials: 'include' 
      });
      const json = await res.json();
      if (res.ok || json.success) {
        const loggedInUser = json.data?.user || json.data || json.user;
        setUser(loggedInUser);
        setIsAdmin(loggedInUser.role === 'admin' || loggedInUser.role === 'manager' || loggedInUser.role === 'super_admin');
        setRecentlyViewed(loggedInUser.recentlyViewed || []);
        
        connectSecureSocket();
        return { success: true, isNewUser: json.data?.isNewUser || json.isNewUser }; 
      }
      return { success: false, message: json.error || json.message || "Social login failed" };
    } catch (error) { return { success: false, message: "Server connection error" }; }
  };

  // ==========================================
  // 🔥 LOGOUT WITH SERVER SESSION INVALIDATION
  // ==========================================
  const logoutUser = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include' // Tells server to destroy the HTTP-only cookie session
      });
    } catch (err) {
      console.error("Logout API error:", err);
    }

    setUser(null);
    setIsAdmin(false);
    setOrders([]);
    setWishlist([]);
    setRecentlyViewed([]);
    
    // Clear any legacy items if accidentally present
    localStorage.removeItem('jack_user');
    localStorage.removeItem('token'); 
    localStorage.removeItem('adminToken');
    localStorage.removeItem('jack_token');

    if (socket.connected) {
      socket.disconnect(); 
    }
  };

  const fetchUserOrders = async (userId) => {
    try {
      const res = await fetch(`${API_URL}/orders/user/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include' 
      });
      if (!res.ok) throw new Error("Fetch failed");
      const json = await res.json();
      
      // 🔥 SMART EXTRACTOR for Orders Array
      const orderList = json.data?.orders || json.data || json.orders || (Array.isArray(json) ? json : []);
      setOrders(Array.isArray(orderList) ? orderList : []);
    } catch (error) { console.error("Error fetching orders:", error); }
  };

  // 🔥 placeOrder handles both raw cart items and pre-mapped items gracefully
  const placeOrder = async (items, totalAmount, address, paymentMethod, trafficSource) => {
    if (!user) return { success: false, error: "Please login first" };

    const orderItems = items.map((item) => ({
      productId: item.productId || item.id || item._id, // Bulletproof mapping
      quantity: Number(item.quantity || 1),
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
          'Content-Type': 'application/json'
        },
        credentials: 'include', 
        body: JSON.stringify(orderData)
      });
      
      const json = await res.json();
      
      if (!res.ok || !json.success) {
        console.error("Order API Error:", json);
        throw new Error(
          json.error || 
          json.message || 
          (json.errors ? JSON.stringify(json.errors) : null) || 
          "Failed to place order"
        );
      }
      
      // 🔥 SMART EXTRACTOR for new order object
      const finalOrder = json.data?.order || json.data || json.order || json;
      setOrders(prevOrders => [finalOrder, ...prevOrders]); 
      return { success: true, order: finalOrder };
    } catch (error) { 
      console.error("Order Place Error:", error);
      return { success: false, error: error.message }; 
    }
  };

  const addRecentlyViewed = async (product) => {
    if (!user || !product) return; 
    const pId = product.id || product._id;
    const exists = recentlyViewed.find(p => String(p.id || p._id) === String(pId));
    if (exists) return;

    const { image, images, ...safeProduct } = product;
    const newHistory = [safeProduct, ...recentlyViewed].slice(0, 4);
    
    setRecentlyViewed(newHistory);
    try {
      const userId = user.id || user._id;
      await fetch(`${API_URL}/users/${userId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ recentlyViewed: newHistory })
      });
      setUser(prev => prev ? { ...prev, recentlyViewed: newHistory } : null);
    } catch (error) { console.error("Error updating history:", error); }
  };

  const updateUserProfile = async (updatedData) => {
    if (!user) return false;
    try {
      const userId = user.id || user._id;
      
      const res = await fetch(`${API_URL}/users/${userId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(updatedData)
      });
      const json = await res.json();
      if (!res.ok) return false;
      
      const updatedUser = json.data || json;
      setUser(prev => prev ? { ...prev, ...updatedUser } : null);
      return true;
    } catch (error) { return false; }
  };

  const cancelOrder = (orderId) => {
    setOrders(prevOrders => 
      prevOrders.map(order => (order.id === orderId || order._id === orderId) ? { ...order, status: 'Cancelled' } : order)
    );
  };

  useEffect(() => {
    if (isLoadingSession) return;

    const userId = user?.id || user?._id;
    if (userId) {
      connectSecureSocket(); 
      socket.emit('join_user_room', userId);
      
      const handleForceLogout = () => {
        logoutUser();
        alert("Your session was terminated for security.");
        window.location.href = '/login'; 
      };

      socket.on('force_logout', handleForceLogout);
      
      return () => {
        socket.off('force_logout', handleForceLogout);
      };
    }
  }, [user?.id, user?._id, isLoadingSession]); 

  return (
    <UserContext.Provider value={{ 
      user, orders, recentlyViewed, wishlist, isLoadingSession, isAdmin, getToken,
      loginUser, socialLoginUser, logoutUser, placeOrder, cancelOrder, addRecentlyViewed, 
      updateUserProfile, syncRecentlyViewed, fetchWishlist, toggleWishlist, socket
    }}>
      {children}
    </UserContext.Provider>
  );
};

export default UserProvider;