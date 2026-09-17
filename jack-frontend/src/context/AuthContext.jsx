// jack-frontend/src/context/AuthContext.jsx
import React, { createContext } from 'react';
import { useUser } from './UserContext';

export const AuthContext = createContext();

// 🔥 PHASE 4 FIX: AuthContext is a seamless proxy for UserContext adhering to secure HttpOnly cookie architecture.
export const AuthProvider = ({ children }) => {
  const { user, isLoggedIn, isAdmin, loginUser, logoutUser, isLoadingSession } = useUser();

  // 🔥 Wrapped login for HttpOnly session architecture
  const handleLogin = async (email, password) => {
    try {
      const result = await loginUser(email, password);
      return result;
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.message || error.message || 'Login failed' 
      };
    }
  };

  // 🔥 Wrapped logout to clear non-sensitive local storage data securely
  const handleLogout = async () => {
    localStorage.removeItem('jack_user');
    localStorage.removeItem('jack_remembered_identifier');
    
    if (logoutUser) {
      await logoutUser();
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user,
      isLoggedIn: isLoggedIn !== undefined ? isLoggedIn : !!user,
      isAdminAuth: isAdmin, 
      login: handleLogin, 
      logout: handleLogout, 
      loading: isLoadingSession 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;