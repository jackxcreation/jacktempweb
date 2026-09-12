import { API_URL } from '../config';

const getAuthToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('token') || localStorage.getItem('admin_token') || localStorage.getItem('jack_token');
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
        signal, // For request cancellation/aborting
        body: JSON.stringify({
          message,
          chatHistory,
          systemInstruction,
          contextOrder,
          userData,
          languageStyle
        }),
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Request was cancelled');
        return null;
      }
      console.error('Support API sendMessage failed:', error);
      throw error;
    }
  }
};

export default supportApi;