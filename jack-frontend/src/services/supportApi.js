// jack-frontend/src/utils/support/supportApi.js
import { API_URL } from '../../config';

const getAuthToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('token') || 
           localStorage.getItem('admin_token') || 
           localStorage.getItem('jack_token') || 
           localStorage.getItem('jwt');
  }
  return null;
};

const getHeaders = () => {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

/**
 * 🔥 NEW HELPER: Robust Error Parser
 * Extract exact backend error messages instead of failing silently.
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
  return await response.json();
};

export const supportApi = {
  /**
   * Send a message to the AI Support backend
   */
  sendMessage: async ({ message, chatHistory, systemInstruction, contextOrder, userData, languageStyle, signal }) => {
    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        signal, // For request cancellation/aborting on unmount
        body: JSON.stringify({
          message,
          chatHistory,
          systemInstruction,
          contextOrder,
          userData,
          languageStyle
        }),
      });

      return await handleResponse(response);
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('sendMessage request was cancelled');
        return null;
      }
      console.error('Support API sendMessage failed:', error.message);
      throw error;
    }
  },

  /**
   * Search Knowledge Base / FAQs for instant answers
   * 🔥 FIX: Always returns an array to prevent UI .map() crashes
   */
  searchKnowledgeBase: async (query, category = '', signal) => {
    try {
      const params = new URLSearchParams();
      if (query) params.append('q', query);
      if (category) params.append('category', category); // Matches the updated backend route

      const response = await fetch(`${API_URL}/support/knowledge/search?${params.toString()}`, {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include',
        signal
      });

      const data = await handleResponse(response);
      return Array.isArray(data) ? data : []; 
    } catch (error) {
      if (error.name === 'AbortError') return [];
      console.error('supportApi.searchKnowledgeBase error:', error.message);
      return []; // Safe fallback for React states
    }
  },

  /**
   * 🔥 NEW API METHOD: Fetch all unique tags/categories for UI Dropdowns
   * Connects to the advanced /tags backend route we built earlier
   */
  getKnowledgeTags: async (signal) => {
    try {
      const response = await fetch(`${API_URL}/support/knowledge/tags`, {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include',
        signal
      });
      
      const data = await handleResponse(response);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      if (error.name === 'AbortError') return [];
      console.error('supportApi.getKnowledgeTags error:', error.message);
      return [];
    }
  },

  /**
   * Submit CSAT or feedback for support conversation
   */
  submitFeedback: async (conversationId, rating, comment = '', signal) => {
    try {
      const response = await fetch(`${API_URL}/support/conversations/${conversationId}/feedback`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        signal,
        body: JSON.stringify({ rating, comment })
      });

      return await handleResponse(response);
    } catch (error) {
      if (error.name === 'AbortError') return { success: false, error: 'Cancelled' };
      console.error('supportApi.submitFeedback error:', error.message);
      return { success: false, error: error.message };
    }
  }
};

export default supportApi;