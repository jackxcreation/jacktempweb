import { API_URL } from '../../config';

const getHeaders = () => {
  const token = typeof window !== 'undefined' 
    ? (localStorage.getItem('token') || localStorage.getItem('jack_token') || localStorage.getItem('admin_token') || localStorage.getItem('jwt')) 
    : null;

  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
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
        credentials: 'include'
      });
      
      if (!response.ok) throw new Error('Failed to fetch conversation history');
      return await response.json();
    } catch (error) {
      console.error('conversationApi.getHistory error:', error);
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
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Failed to start conversation');
      return await response.json();
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
        credentials: 'include',
        body: JSON.stringify(messagePayload)
      });

      if (!response.ok) throw new Error('Failed to send message');
      return await response.json();
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
        credentials: 'include',
        body: JSON.stringify({ reason })
      });

      if (!response.ok) throw new Error('Failed to escalate conversation');
      return await response.json();
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
      const response = await fetch(`${API_URL}/support/conversations/${conversationId}/resolve`, {
        method: 'PUT',
        headers: getHeaders(),
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to resolve conversation');
      return await response.json();
    } catch (error) {
      console.error('conversationApi.resolveConversation error:', error);
      return { success: false, error: error.message };
    }
  }
};

export default conversationApi;