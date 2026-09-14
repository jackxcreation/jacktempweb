// jack-frontend/src/context/CompareContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';

const CompareContext = createContext();
export const useCompare = () => useContext(CompareContext);

export const CompareProvider = ({ children }) => {
  // Load initial compare list from localStorage safely
  const [compareList, setCompareList] = useState(() => {
    try {
      const saved = localStorage.getItem('jack_compare_list');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Persist to localStorage whenever compareList changes
  useEffect(() => {
    try {
      localStorage.setItem('jack_compare_list', JSON.stringify(compareList));
    } catch (error) {
      console.error("Failed to save compare list to localStorage:", error);
    }
  }, [compareList]);

  // Add product to comparison list (Max 2 products limit)
  const addToCompare = (product) => {
    if (!product) return { success: false, message: "Invalid product." };
    const productId = product.id || product._id;
    if (!productId) return { success: false, message: "Product ID missing." };

    const exists = compareList.find(p => String(p.id || p._id) === String(productId));

    if (exists) {
      return { success: false, message: "Product is already in comparison list." };
    }

    if (compareList.length >= 2) {
      // Replace the first item if already 2 products are selected
      setCompareList([compareList[1], product]);
      return { success: true, message: "Replaced older product for comparison." };
    } else {
      setCompareList([...compareList, product]);
      return { success: true, message: "Added to comparison." };
    }
  };

  const removeFromCompare = (id) => {
    setCompareList(prev => prev.filter(p => String(p.id || p._id) !== String(id)));
  };

  const clearCompare = () => setCompareList([]);

  return (
    <CompareContext.Provider value={{ compareList, addToCompare, removeFromCompare, clearCompare }}>
      {children}
    </CompareContext.Provider>
  );
};

export default CompareProvider;