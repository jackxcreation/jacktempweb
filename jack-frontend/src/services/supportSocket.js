// jack-frontend/src/utils/support/supportSocketService.js
import { io } from 'socket.io-client';
import { API_URL } from '../../config';

let socketInstance = null;

const getAuthToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('token') || 
           localStorage.getItem('admin_token') || 
           localStorage.getItem('jack_token') || 
           localStorage.getItem('jwt');
  }
  return null;
};

// 🔥 CRITICAL FIX: Ensure Socket connects to the root server, not the '/api' route
const getSocketUrl = () => {
  if (API_URL.endsWith('/api')) {
    return API_URL.slice(0, -4);
  }
  return API_URL;
};

export const supportSocketService = {
  /**
   * Connects to the Socket Server.
   * @param {string} userId - ID of the logged-in user
   * @param {string} role - 'customer' or 'admin' (vital for receiving dashboard events)
   */
  connect: (userId, role = 'customer') => {
    if (!socketInstance) {
      const token = getAuthToken();
      const SOCKET_URL = getSocketUrl();

      socketInstance = io(SOCKET_URL, {
        reconnectionAttempts: 7, // Slightly higher for mobile stability
        reconnectionDelay: 2000,
        transports: ['websocket', 'polling'], // Fallback to polling if corporate firewall blocks WSS
        auth: token ? { token } : {} 
      });

      socketInstance.on('connect', () => {
        console.log(`Support Socket connected as ${role} [${socketInstance.id}]`);
        
        // 1. Join personal room for private alerts
        if (userId) {
          socketInstance.emit('join_user_room', userId);
        }

        // 2. 🔥 UPGRADE: Admins must join the admin room to receive webhook alerts & live ticket updates
        if (role === 'admin') {
          socketInstance.emit('join_admin_room');
        }
      });

      socketInstance.on('disconnect', (reason) => {
        console.warn('Socket disconnected:', reason);
      });

      socketInstance.on('connect_error', (err) => {
        console.error('Socket connection error:', err.message);
      });
    }
    return socketInstance;
  },

  getSocket: () => {
    return socketInstance;
  },

  disconnect: () => {
    if (socketInstance) {
      socketInstance.disconnect();
      socketInstance = null;
    }
  },

  // ==========================================
  // 🔥 CHAT ROOM MANAGEMENT
  // ==========================================
  
  joinConversation: (conversationId) => {
    if (socketInstance && conversationId) {
      socketInstance.emit('join_conversation', conversationId);
    }
  },

  leaveConversation: (conversationId) => {
    if (socketInstance && conversationId) {
      socketInstance.emit('leave_conversation', conversationId);
    }
  },

  // ==========================================
  // 🔥 BULLETPROOF EVENT LISTENERS (Prevents Memory Leaks)
  // ==========================================

  /**
   * Safely subscribe to an event. Removes any existing listener for this event first 
   * to prevent duplicate React re-render triggers.
   */
  subscribe: (event, callback) => {
    if (socketInstance) {
      socketInstance.off(event); // 🔥 Prevents duplicate listeners
      socketInstance.on(event, callback);
    }
  },

  unsubscribe: (event) => {
    if (socketInstance) {
      socketInstance.off(event);
    }
  },

  emit: (event, data) => {
    if (socketInstance) {
      socketInstance.emit(event, data);
    }
  }
};

export default supportSocketService;