import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_URL } from '../config'; // 🔥 Config se import kar rahe hain taaki consistency rahe 🔥

const SettingsContext = createContext();

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(null);

  const fetchSettings = async () => {
    try {
      // 🔥 FIX: /api hataya kyunki API_URL mein wo pehle se hai 🔥
      const res = await fetch(`${API_URL}/settings`); 
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (error) { console.error("Error fetching settings:", error); }
  };

  useEffect(() => { 
    fetchSettings(); 
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, refreshSettings: fetchSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);