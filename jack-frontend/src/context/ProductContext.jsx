import React, { createContext, useContext, useState } from 'react';
import { API_URL } from '../config';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'; // 🔥 PHASE 8: Added TanStack Query

const ProductContext = createContext();
export const useProducts = () => useContext(ProductContext);

export const ProductProvider = ({ children }) => {
  const queryClient = useQueryClient();

  // Helper to securely get token for Admin actions (Add/Delete)
  const getToken = () => localStorage.getItem('adminToken') || localStorage.getItem('token');

  // ==========================================
  // 1. DATABASE SE SARE PRODUCTS MANGWANA (GET) - 🔥 PHASE 8: Cached & Cancellable
  // ==========================================
  const { 
    data: productsData = [], 
    isLoading: loading, 
    refetch: fetchProducts 
  } = useQuery({
    queryKey: ['products'], // Cache key
    queryFn: async ({ signal }) => {
      // 🔥 PHASE 8 & OWASP SYNC: Passed limit=100 query parameter and paginated flag to match backend hard cap and structured response
      const response = await fetch(`${API_URL}/products?limit=100&paginated=true`, { signal });
      if (!response.ok) throw new Error('Network response was not ok');
      const result = await response.json();
      // Handle both paginated object structure and legacy array response safely
      return Array.isArray(result) ? result : (result.products || []);
    },
    staleTime: 1000 * 60 * 5, // 5 minutes caching (Avoids loading all data repeatedly)
  });

  const products = Array.isArray(productsData) ? productsData : [];

  // ==========================================
  // 1.1 FLIPKART-SCALE SERVER-SIDE FILTERED PRODUCTS FETCHING 🔥 (TANSTACK QUERY READY)
  // ==========================================
  const fetchFilteredProducts = async (params = {}) => {
    try {
      const queryParams = new URLSearchParams(params).toString();
      
      // Check if we can query via queryClient cache or fetch directly from backend Atlas Search endpoint
      const response = await fetch(`${API_URL}/products?${queryParams}&paginated=true`);
      if (!response.ok) throw new Error('Failed to fetch filtered products');
      const result = await response.json();
      
      return Array.isArray(result) ? { products: result, total: result.length, page: 1, pages: 1 } : result;
    } catch (error) {
      console.error("❌ Error fetching filtered products from server:", error);
      return { products: [], total: 0, page: 1, pages: 1 };
    }
  };

  // ==========================================
  // 2. NAYA PRODUCT MONGODB MEIN SAVE KARNA (POST) - 🔥 PHASE 8: Mutations
  // ==========================================
  const addMutation = useMutation({
    mutationFn: async (newProduct) => {
      const response = await fetch(`${API_URL}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}` // Security added for admin actions
        },
        body: JSON.stringify(newProduct),
      });
      if (!response.ok) throw new Error('Failed to add product');
      return response.json();
    },
    onSuccess: (savedProduct) => {
      // Turant UI update bina refresh ke (Optimistic Update)
      queryClient.setQueryData(['products'], (oldData = []) => {
        const oldProducts = Array.isArray(oldData) ? oldData : (oldData.products || []);
        return [savedProduct, ...oldProducts];
      });
      // Invalidate queries to sync search cache
      queryClient.invalidateQueries({ queryKey: ['products'] });
    }
  });

  const addProduct = async (newProduct) => {
    try {
      await addMutation.mutateAsync(newProduct);
      return true;
    } catch (error) {
      console.error("❌ Error adding product to MongoDB:", error);
      return false;
    }
  };

  // ==========================================
  // 3. PRODUCT KO MONGODB SE DELETE KARNA (DELETE) - 🔥 PHASE 8: Mutations
  // ==========================================
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const response = await fetch(`${API_URL}/products/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getToken()}` // Security added for admin actions
        }
      });
      if (!response.ok) throw new Error('Failed to delete product');
      return id;
    },
    onSuccess: (deletedId) => {
      // Turant UI update bina refresh ke
      queryClient.setQueryData(['products'], (oldData = []) => {
        const oldProducts = Array.isArray(oldData) ? oldData : (oldData.products || []);
        return oldProducts.filter(product => product.id !== deletedId && product._id !== deletedId);
      });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    }
  });

  const deleteProduct = async (id) => {
    try {
      await deleteMutation.mutateAsync(id);
    } catch (error) {
      console.error("❌ Error deleting product from MongoDB:", error);
    }
  };

  return (
    // Puraane API structure ke sath naya fetchFilteredProducts bhi provide kar diya hai
    <ProductContext.Provider value={{ products, addProduct, deleteProduct, loading, fetchProducts, fetchFilteredProducts }}>
      {children}
    </ProductContext.Provider>
  );
};