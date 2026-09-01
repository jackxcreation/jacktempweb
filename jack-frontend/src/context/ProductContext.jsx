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
  // 1. DATABASE SE LIGHTWEIGHT INITIAL PRODUCTS (GET) - 🔥 OPTIMIZED TO PREVENT MEMORY CHOKE
  // ==========================================
  const { 
    data: productsData = [], 
    isLoading: loading, 
    refetch: fetchProducts 
  } = useQuery({
    queryKey: ['products'], // Cache key
    queryFn: async ({ signal }) => {
      // 🔥 Scalability Fix: Capped initial lightweight fetch to 20 items to prevent memory bloat on startup
      const response = await fetch(`${API_URL}/products?limit=20&paginated=true`, { signal });
      if (!response.ok) throw new Error('Network response was not ok');
      const result = await response.json();
      // Handle both paginated object structure and legacy array response safely
      return Array.isArray(result) ? result : (result.products || []);
    },
    staleTime: 1000 * 60 * 5, // 5 minutes caching
  });

  const products = Array.isArray(productsData) ? productsData : [];

  // ==========================================
  // 1.1 FLIPKART/AMAZON-SCALE SERVER-SIDE PAGINATED & FILTERED FETCHING 🔥 (ENTERPRISE READY)
  // ==========================================
  const fetchFilteredProducts = async (params = {}) => {
    try {
      // 🔥 Amazon-like query parameters structure supporting page, limit, search, category, warehouse, stock, status
      const queryParams = new URLSearchParams({
        page: params.page || 1,
        limit: params.limit || 50,
        search: params.search || '',
        category: params.category || '',
        warehouse: params.warehouse || '',
        stock: params.stock || '',
        status: params.status || '',
        ...params,
        paginated: 'true'
      }).toString();
      
      const response = await fetch(`${API_URL}/products?${queryParams}`);
      if (!response.ok) throw new Error('Failed to fetch server-side paginated products');
      const result = await response.json();
      
      return Array.isArray(result) ? { products: result, total: result.length, page: 1, pages: 1 } : result;
    } catch (error) {
      console.error("❌ Error fetching server-side filtered products:", error);
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
    <ProductContext.Provider value={{ products, addProduct, deleteProduct, loading, fetchProducts, fetchFilteredProducts }}>
      {children}
    </ProductContext.Provider>
  );
};