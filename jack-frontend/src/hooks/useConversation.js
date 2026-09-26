// src/hooks/support/useConversation.js
import { useState, useCallback, useEffect } from 'react';
import axiosInstance from "../api/axiosInstance"; // 🔥 Backend API connection

/**
 * 🔥 UPGRADE: Added `contextId` parameter. 
 * Pass `orderId` or `ticketId` here so each order gets its own isolated chat session!
 * Default is 'general' for non-order specific queries.
 */
export const useConversation = (user, contextId = 'general') => {
  
  // Dynamic storage key prevents Chat Bleeding between different orders
  const storageKey = `jack_conv_id_${contextId}`;

  // Stable ID generator
  const generateConversationId = useCallback(() => {
    const rawId = user?.id || user?._id || 'gst';
    const userIdFragment = String(rawId).slice(-4);
    const contextFragment = String(contextId).slice(-6); // Adds order context to ID
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 7);
    
    return `conv-${userIdFragment}-${contextFragment}-${timestamp}-${randomStr}`;
  }, [user, contextId]);

  // Initialize a unique conversation ID for the session
  const [conversationId, setConversationId] = useState(() => {
    if (typeof window !== 'undefined') {
      const cached = sessionStorage.getItem(storageKey);
      if (cached) return cached;
      
      const newId = generateConversationId();
      sessionStorage.setItem(storageKey, newId);
      return newId;
    }
    return generateConversationId();
  });

  // 🔥 ENHANCEMENT: Dynamically sync and load the correct session when contextId changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const cached = sessionStorage.getItem(storageKey);
      if (cached) {
        setConversationId(cached);
      } else {
        const newId = generateConversationId();
        sessionStorage.setItem(storageKey, newId);
        setConversationId(newId);
      }
    }
  }, [storageKey, generateConversationId]);

  // Sync sessionStorage whenever conversationId updates
  useEffect(() => {
    if (typeof window !== 'undefined' && conversationId) {
      sessionStorage.setItem(storageKey, conversationId);
    }
  }, [conversationId, storageKey]);

  // Function to completely reset the conversation (e.g., when clicking "Start New Conversation")
  const resetConversation = useCallback(() => {
    const newId = generateConversationId();
    setConversationId(newId);
    
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(storageKey, newId);
    }
    return newId;
  }, [generateConversationId, storageKey]);

  // 🔥 NEW FUNCTION: Fetch Active Conversation from Backend
  // Prevents losing chat history if the user clears storage or logs in from another device.
  const fetchActiveConversation = useCallback(async () => {
    // Guest users rely purely on sessionStorage
    if (!user || user.isGuest) return null; 

    try {
      // Connects to the actual mounted backend route: /api/support/conversations/active
      const response = await axiosInstance.get(`/support/conversations/active?contextId=${contextId}`);
      
      if (response.data?.success && response.data?.conversationId) {
        const activeId = response.data.conversationId;
        setConversationId(activeId);
        
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(storageKey, activeId);
        }
        return activeId;
      }
    } catch (error) {
      // It's normal to not have an active conversation, so we just log a warning, not an error.
      console.warn("No active conversation found on backend or fetch failed.", error.message);
    }
    return null;
  }, [user, contextId, storageKey]);

  // Auto-fetch active conversation on mount if user is logged in
  useEffect(() => {
    if (user && !user.isGuest) {
      fetchActiveConversation();
    }
  }, [user, fetchActiveConversation]);

  return {
    conversationId,
    resetConversation,
    setConversationId,
    fetchActiveConversation // 🔥 Exported the new backend sync function
  };
};

export default useConversation;