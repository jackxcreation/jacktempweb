// jack-frontend/src/hooks/support/useConversation.js
import { useState, useCallback, useEffect } from 'react';

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

  return {
    conversationId,
    resetConversation,
    setConversationId
  };
};