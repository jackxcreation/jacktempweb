import { API_URL } from '../../config';

const getHeaders = () => {
  const token = localStorage.getItem('token') || localStorage.getItem('jack_token');
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
  }
};

export default conversationApi;