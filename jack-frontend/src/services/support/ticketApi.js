import { API_URL } from '../../config';

const getHeaders = () => {
  const token = localStorage.getItem('token') || localStorage.getItem('jack_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

export const ticketApi = {
  /**
   * Fetch the current status of a support ticket
   */
  getTicketStatus: async (ticketId) => {
    try {
      const response = await fetch(`${API_URL}/support/tickets/${ticketId}`, {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include'
      });
      
      if (!response.ok) throw new Error('Failed to fetch ticket status');
      return await response.json();
    } catch (error) {
      console.error('ticketApi.getTicketStatus error:', error);
      return { success: false, status: 'UNKNOWN' };
    }
  }
};

export default ticketApi;