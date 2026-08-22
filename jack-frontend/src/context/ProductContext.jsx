import React, { createContext, useState, useContext, useEffect } from 'react';
import { API_URL } from '../config';

const ProductContext = createContext();
export const useProducts = () => useContext(ProductContext);

export const ProductProvider = ({ children }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. DATABASE SE SARE PRODUCTS MANGWANA (GET)
  const fetchProducts = async () => {
    try {
      // 👉 FIX: API_URL ke aage '/products' lagaya hai!
      const response = await fetch(`${API_URL}/products`);
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
      }
      setLoading(false);
    } catch (error) {
      console.error("❌ Error fetching products from MongoDB:", error);
      setLoading(false);
    }
  };

  // Jaise hi website khulegi, data MongoDB se aayega
  useEffect(() => {
    fetchProducts();
  }, []);

  // 2. NAYA PRODUCT MONGODB MEIN SAVE KARNA (POST)
  const addProduct = async (newProduct) => {
    try {
      // 👉 FIX: Yahan bhi '/products' joda hai
      const response = await fetch(`${API_URL}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newProduct),
      });
      
      if (response.ok) {
        const savedProduct = await response.json();
        // Website par turant update karne ke liye state change karo
        setProducts([savedProduct, ...products]);
        return true;
      }
    } catch (error) {
      console.error("❌ Error adding product to MongoDB:", error);
      return false;
    }
  };

  // 3. PRODUCT KO MONGODB SE DELETE KARNA (DELETE)
  const deleteProduct = async (id) => {
    try {
      // 👉 FIX: Yahan bhi '/products' joda hai
      const response = await fetch(`${API_URL}/products/${id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        // Website se turant hatane ke liye state se filter karo
        setProducts(products.filter(product => product.id !== id));
      }
    } catch (error) {
      console.error("❌ Error deleting product from MongoDB:", error);
    }
  };

  return (
    // 'fetchProducts' ko bhi export kar diya taaki admin panel manually refresh kar sake
    <ProductContext.Provider value={{ products, addProduct, deleteProduct, loading, fetchProducts }}>
      {children}
    </ProductContext.Provider>
  );
};