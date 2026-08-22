import React, { createContext, useContext } from 'react';
import { API_URL } from '../config'; 
import { useQuery } from '@tanstack/react-query'; // 🔥 PHASE 8: TanStack Query for caching

const SettingsContext = createContext();

export const SettingsProvider = ({ children }) => {

  // ==========================================
  // 🔥 PHASE 8: Replaced useState & useEffect with useQuery
  // Settings rarely change, so caching them saves database load!
  // ==========================================
  const { data: settings = null, refetch: refreshSettings } = useQuery({
    queryKey: ['settings'], // Unique cache key
    queryFn: async ({ signal }) => {
      // 🔥 Passed 'signal' to cancel stale requests if needed
      const res = await fetch(`${API_URL}/settings`, { signal }); 
      if (!res.ok) throw new Error("Failed to fetch settings");
      return res.json();
    },
    staleTime: 1000 * 60 * 15, // 🔥 15 Minutes Cache! (Settings baar-baar load nahi hongi)
    retry: 2, // Network issue ho toh 2 baar retry karega
  });

  return (
    // 'refreshSettings' ka naam same rakha hai taaki Admin Panel directly update kar sake
    <SettingsContext.Provider value={{ settings, refreshSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);