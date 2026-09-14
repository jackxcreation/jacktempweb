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

/**
 * 🔥 NEW HELPER: Robust Error Parser
 * Safely extracts exact error messages from the backend (e.g., Mongoose validation errors)
 * instead of throwing a generic "Failed to fetch" error.
 */
const handleResponse = async (response) => {
  if (!response.ok) {
    let errorMessage = `API Request Failed (${response.status})`;
    try {
      const errData = await response.json();
      errorMessage = errData.error || errData.message || errorMessage;
    } catch (e) {
      // Fallback if backend doesn't return JSON
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }
  return await response.json();
};

export const ticketApi = {
  /**
   * Fetch the current status and details of a support ticket
   */
  getTicketStatus: async (ticketId, signal) => {
    try {
      const response = await fetch(`${API_URL}/support/tickets/${ticketId}`, {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include',
        signal
      });
      return await handleResponse(response);
    } catch (error) {
      console.error('ticketApi.getTicketStatus error:', error);
      // Return consistent object shape for UI state
      return { success: false, status: 'UNKNOWN', error: error.message };
    }
  },

  /**
   * Create a new support ticket
   */
  createTicket: async (ticketPayload, signal) => {
    try {
      const response = await fetch(`${API_URL}/support/tickets`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        signal,
        body: JSON.stringify(ticketPayload)
      });
      return await handleResponse(response);
    } catch (error) {
      console.error('ticketApi.createTicket error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Fetch all tickets for the logged-in user (or admin)
   */
  getUserTickets: async (signal) => {
    try {
      const response = await fetch(`${API_URL}/support/tickets`, {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include',
        signal
      });
      const data = await handleResponse(response);
      // 🔥 FIX: Ensures we always return an array to prevent UI map() crashes
      return data.tickets ? data : { success: true, tickets: data }; 
    } catch (error) {
      console.error('ticketApi.getUserTickets error:', error);
      return { success: false, tickets: [], error: error.message };
    }
  },

  /**
   * Add a reply/message to an existing ticket
   */
  addTicketMessage: async (ticketId, messageText, signal) => {
    try {
      const response = await fetch(`${API_URL}/support/tickets/${ticketId}/messages`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        signal,
        // 🔥 FIX: Sends both 'text' and 'content' to perfectly align with the SupportMessage backend schema
        body: JSON.stringify({ text: messageText, content: messageText })
      });
      return await handleResponse(response);
    } catch (error) {
      console.error('ticketApi.addTicketMessage error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Submit CSAT (Customer Satisfaction) rating for a resolved ticket
   */
  updateCSAT: async (ticketId, csatRating, signal) => {
    try {
      // 🔥 FIX: Aligned with the unified PATCH endpoint for ticket updates
      const response = await fetch(`${API_URL}/support/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: getHeaders(),
        credentials: 'include',
        signal,
        body: JSON.stringify({ csatRating })
      });
      return await handleResponse(response);
    } catch (error) {
      console.error('ticketApi.updateCSAT error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Close or resolve a ticket
   */
  closeTicket: async (ticketId, signal) => {
    try {
      // 🔥 CRITICAL FIX: Changed from PUT /close to standard PATCH /:id 
      // This exactly matches the router.patch('/:id') endpoint we built in the backend!
      const response = await fetch(`${API_URL}/support/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: getHeaders(),
        credentials: 'include',
        signal,
        body: JSON.stringify({ status: 'CLOSED' })
      });
      return await handleResponse(response);
    } catch (error) {
      console.error('ticketApi.closeTicket error:', error);
      return { success: false, error: error.message };
    }
  }
};

export default ticketApi;