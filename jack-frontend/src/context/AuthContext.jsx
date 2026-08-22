import React, { createContext, useState, useEffect } from 'react';
import axiosInstance from '../api/axiosInstance';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isAdminAuth, setIsAdminAuth] = useState(false);
  const [loading, setLoading] = useState(true);

  // ==========================================
  // 🔥 PHASE 8: Async Backend Session Validation
  // ==========================================
  const validateAdminSession = async () => {
    const token = localStorage.getItem('adminToken');
    
    // Do not treat token existence as authentication
    if (!token) {
      setIsAdminAuth(false);
      setLoading(false);
      return;
    }

    try {
      // 🔥 PHASE 8: Validate session with backend (e.g., /auth/me or any protected admin route)
      // Never trust local role state; let the server confirm if this token belongs to an Admin.
      const response = await axiosInstance.get('/auth/me'); 
      
      // Strict Role Check (Backend must confirm role === 'admin')
      if (response.data && response.data.role === 'admin') {
        setIsAdminAuth(true);
      } else {
        throw new Error('Unauthorized role. Not an admin.');
      }
    } catch (error) {
      console.warn("🚨 Admin session invalid, expired, or tampered. Logging out.");
      logout(); // 🔥 PHASE 8: Clear token on 401/error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    validateAdminSession();

    // 🔥 PHASE 8: Listen for global auto-logout events (Triggered by axiosInstance on 401)
    const handleAuthChange = () => {
      if (!localStorage.getItem('adminToken')) {
        setIsAdminAuth(false);
      }
    };

    window.addEventListener('jack_auth_change', handleAuthChange);
    window.addEventListener('storage', handleAuthChange);

    return () => {
      window.removeEventListener('jack_auth_change', handleAuthChange);
      window.removeEventListener('storage', handleAuthChange);
    };
  }, []);

  const login = async (email, password) => {
    try {
      const response = await axiosInstance.post('/auth/login', { email, password });
      
      if (response.data.success) {
        // 🔥 PHASE 8: Defense in depth - Ensure we don't accidentally login a customer to admin panel
        if (response.data.user && response.data.user.role !== 'admin') {
          return { success: false, message: 'Access Denied: You do not have admin privileges.' };
        }

        localStorage.setItem('adminToken', response.data.token);
        setIsAdminAuth(true);
        return { success: true };
      }
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.message || error.response?.data?.error || 'Login failed' 
      };
    }
  };

  const logout = () => {
    // 🔥 PHASE 8: Session Revocation / Cleanup
    localStorage.removeItem('adminToken');
    setIsAdminAuth(false);
    
    // Broadcast auth change to clear any other synchronized states
    window.dispatchEvent(new Event('jack_auth_change'));
  };

  return (
    <AuthContext.Provider value={{ isAdminAuth, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};