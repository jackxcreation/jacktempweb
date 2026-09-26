// src/utils/support/ticketApi.js
import { API_URL } from '../../config';

// 🔥 FIX: Removed insecure localStorage token extraction. 
// We now rely purely on HTTP-Only cookies sent automatically via credentials: 'include'.
const getHeaders = () => {
  return {
    'Content-Type': 'application/json'
  };
};

/**
 * 🔥 NEW HELPER: Robust Error Parser & Smart Data Extractor
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
  const responseData = await response.json();
  
  // 🔥 SMART EXTRACTOR: Unwrap the standardized backend response { success: true, data: {...} }
  return responseData?.data || responseData;
};

export const ticketApi = {
  /**
   * Fetch the current status and details of a support ticket
   */
  getTicketStatus: async (ticketId, signal) => {
    try {
      // 🔥 FIX: Changed /support/tickets to /tickets to match backend ticket.js
      const response = await fetch(`${API_URL}/tickets/${ticketId}`, {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include', // 🔥 Enforces HttpOnly Cookie
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
      // 🔥 FIX: Changed /support/tickets to /tickets
      const response = await fetch(`${API_URL}/tickets`, {
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
      // 🔥 FIX: Changed /support/tickets to /tickets
      const response = await fetch(`${API_URL}/tickets`, {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include',
        signal
      });
      
      const payload = await handleResponse(response);
      
      // 🔥 FIX & SMART EXTRACTOR: Ensures we always return an array to prevent UI map() crashes
      const ticketsArray = Array.isArray(payload) ? payload : (payload?.tickets || []);
      
      return { success: true, tickets: ticketsArray }; 
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
      // 🔥 FIX: Changed /support/tickets/:id/messages to /tickets/:id/messages
      const response = await fetch(`${API_URL}/tickets/${ticketId}/messages`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include', 
        signal,
        // 🔥 FIX: Backend ticketMessageSchema specifically expects 'text'
        body: JSON.stringify({ text: messageText })
      });
      return await handleResponse(response);
    } catch (error) {
      console.error('ticketApi.addTicketMessage error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * 🔥 NEW: Update Ticket Status and Assign Agents
   * Direct connection to PUT /api/tickets/:id/status in backend
   */
  updateTicketStatus: async (ticketId, updateData, signal) => {
    try {
      const response = await fetch(`${API_URL}/tickets/${ticketId}/status`, {
        method: 'PUT',
        headers: getHeaders(),
        credentials: 'include',
        signal,
        // updateData can include: status, priority, assignedAgent, assignedAgentId
        body: JSON.stringify(updateData) 
      });
      return await handleResponse(response);
    } catch (error) {
      console.error('ticketApi.updateTicketStatus error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Submit CSAT (Customer Satisfaction) rating for a resolved ticket
   */
  updateCSAT: async (ticketId, csatRating, signal) => {
    try {
      // 🔥 FIX: Changed /support/tickets to /tickets
      const response = await fetch(`${API_URL}/tickets/${ticketId}`, {
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
      // 🔥 CRITICAL FIX: Changed from PATCH to PUT /tickets/:id/status 
      // Exactly matches the router.put('/api/tickets/:id/status') in backend
      const response = await fetch(`${API_URL}/tickets/${ticketId}/status`, {
        method: 'PUT',
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
  },

  /**
   * 🔥 NEW: Add Internal Note for Agents
   */
  addInternalNote: async (ticketId, noteText, signal) => {
    try {
      const response = await fetch(`${API_URL}/tickets/${ticketId}/notes`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        signal,
        body: JSON.stringify({ note: noteText })
      });
      return await handleResponse(response);
    } catch (error) {
      console.error('ticketApi.addInternalNote error:', error);
      return { success: false, error: error.message };
    }
  }
};

export default ticketApi;