import React, { createContext } from 'react';
import { useUser } from './UserContext';

export const AuthContext = createContext();

// 🔥 PHASE 4 FIX: AuthContext is a seamless proxy for UserContext with bulletproof token storage for subdomains.
export const AuthProvider = ({ children }) => {
  const { isAdmin, loginUser, logoutUser, isLoadingSession } = useUser();

  // 🔥 Wrapped login to catch token and store in localStorage for cross-domain subdomain persistence
  const handleLogin = async (email, password) => {
    try {
      const result = await loginUser(email, password);
      
      // If login succeeds, extract and cache token across all storage keys
      if (result && (result.success === true || result.token || result.accessToken)) {
        const rawToken = result.token || result.accessToken || result.data?.token || result.user?.token;
        if (rawToken) {
          localStorage.setItem('token', rawToken);
          localStorage.setItem('admin_token', rawToken);
          localStorage.setItem('jack_token', rawToken);
        }
      }
      return result;
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.message || error.message || 'Login failed' 
      };
    }
  };

  // 🔥 Wrapped logout to clear all token variants securely
  const handleLogout = async () => {
    localStorage.removeItem('token');
    localStorage.removeItem('admin_token');
    localStorage.removeItem('jack_token');
    localStorage.removeItem('jack_user');
    
    if (logoutUser) {
      await logoutUser();
    }
  };

  return (
    <AuthContext.Provider value={{ 
      isAdminAuth: isAdmin, 
      login: handleLogin, 
      logout: handleLogout, 
      loading: isLoadingSession 
    }}>
      {children}
    </AuthContext.Provider>
  );
};