// src/context/CompareContext.jsx
import React, { createContext, useContext, useState } from 'react';

const CompareContext = createContext();
export const useCompare = () => useContext(CompareContext);

export const CompareProvider = ({ children }) => {
  const [compareList, setCompareList] = useState([]);

  // Add product to comparison list (Max 2 products limit)
  const addToCompare = (product) => {
    const productId = product.id || product._id;
    const exists = compareList.find(p => (p.id || p._id) === productId);

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
    setCompareList(compareList.filter(p => (p.id || p._id) !== id));
  };

  const clearCompare = () => setCompareList([]);

  return (
    <CompareContext.Provider value={{ compareList, addToCompare, removeFromCompare, clearCompare }}>
      {children}
    </CompareContext.Provider>
  );
};