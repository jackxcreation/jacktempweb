// src/utils/support/conversationApi.js
import { API_URL } from '../../config';

// 🔥 FIX: Removed insecure localStorage token extraction. 
// HTTP-Only cookies will be sent automatically via credentials: 'include'.
const getHeaders = () => {
  return {
    'Content-Type': 'application/json'
  };
};

/**
 * 🔥 NEW HELPER: Robust Error Parser & Smart Data Extractor
 * Safely extracts exact error messages from the backend
 * and automatically unwraps standardized { success: true, data: {...} } responses.
 */
const handleResponse = async (response) => {
  if (!response.ok) {
    let errorMessage = `API Request Failed (${response.status})`;
    try {
      const errData = await response.json();
      errorMessage = errData.error || errData.message || errorMessage;
    } catch (e) {
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }
  const responseData = await response.json();
  
  // 🔥 SMART EXTRACTOR
  return responseData?.data || responseData;
};

export const conversationApi = {
  /**
   * Fetch history for a specific conversation session
   */
  getHistory: async (conversationId) => {
    try {
      const response = await fetch(`${API_URL}/support/conversations/${conversationId}`, {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include' // 🔥 Enforces HttpOnly Cookie
      });
      
      const data = await handleResponse(response);
      return data;
    } catch (error) {
      console.error('conversationApi.getHistory error:', error);
      // Safe fallback for UI state
      return { success: false, data: [] };
    }
  },

  /**
   * 🔥 NEW API METHOD: Start or initialize a new support conversation
   */
  startConversation: async (payload = {}) => {
    try {
      const response = await fetch(`${API_URL}/support/conversations`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include', // 🔥 Enforces HttpOnly Cookie
        body: JSON.stringify(payload)
      });

      return await handleResponse(response);
    } catch (error) {
      console.error('conversationApi.startConversation error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * 🔥 NEW API METHOD: Send a message within a conversation session
   */
  sendMessage: async (conversationId, messagePayload) => {
    try {
      const response = await fetch(`${API_URL}/support/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include', // 🔥 Enforces HttpOnly Cookie
        body: JSON.stringify(messagePayload)
      });

      return await handleResponse(response);
    } catch (error) {
      console.error('conversationApi.sendMessage error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * 🔥 NEW API METHOD: Escalate conversation to human agent queue
   */
  escalateConversation: async (conversationId, reason = 'User requested human agent') => {
    try {
      const response = await fetch(`${API_URL}/support/conversations/${conversationId}/escalate`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include', // 🔥 Enforces HttpOnly Cookie
        body: JSON.stringify({ reason })
      });

      return await handleResponse(response);
    } catch (error) {
      console.error('conversationApi.escalateConversation error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * 🔥 NEW API METHOD: Mark a conversation as resolved or closed
   */
  resolveConversation: async (conversationId) => {
    try {
      // 🔥 CRITICAL FIX: Changed from PUT to POST to match the backend router
      const response = await fetch(`${API_URL}/support/conversations/${conversationId}/resolve`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include' // 🔥 Enforces HttpOnly Cookie
      });

      return await handleResponse(response);
    } catch (error) {
      console.error('conversationApi.resolveConversation error:', error);
      return { success: false, error: error.message };
    }
  }
};

export default conversationApi;