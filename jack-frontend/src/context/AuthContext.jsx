import React, { createContext } from 'react';
import { useUser } from './UserContext';

export const AuthContext = createContext();

// 🔥 PHASE 4 FIX: AuthContext is now just a seamless proxy for UserContext.
// This permanently solves the duplicate state issue (Point 43 & 44) 
// without breaking any old admin imports that rely on AuthContext.
export const AuthProvider = ({ children }) => {
  const { isAdmin, loginUser, logoutUser, isLoadingSession } = useUser();

  return (
    <AuthContext.Provider value={{ 
      isAdminAuth: isAdmin, 
      login: loginUser, 
      logout: logoutUser, 
      loading: isLoadingSession 
    }}>
      {children}
    </AuthContext.Provider>
  );
};