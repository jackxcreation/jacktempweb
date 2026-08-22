import React, { createContext, useContext } from 'react';
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
    data: products = [], 
    isLoading: loading, 
    refetch: fetchProducts 
  } = useQuery({
    queryKey: ['products'], // Cache key
    queryFn: async ({ signal }) => {
      // 🔥 PHASE 8: Passed 'signal' to cancel stale requests if user navigates away quickly
      const response = await fetch(`${API_URL}/products`, { signal });
      if (!response.ok) throw new Error('Network response was not ok');
      return response.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes caching (Avoids loading all data repeatedly)
  });

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
      queryClient.setQueryData(['products'], (oldProducts = []) => [savedProduct, ...oldProducts]);
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
      queryClient.setQueryData(['products'], (oldProducts = []) => 
        oldProducts.filter(product => product.id !== deletedId && product._id !== deletedId)
      );
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
    // Puraane API structure ko same rakha hai taaki baaki components break na hon
    <ProductContext.Provider value={{ products, addProduct, deleteProduct, loading, fetchProducts }}>
      {children}
    </ProductContext.Provider>
  );
};