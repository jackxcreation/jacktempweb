import { io } from 'socket.io-client';
import { API_URL } from '../config';

let socketInstance = null;

export const supportSocketService = {
  connect: (userId) => {
    if (!socketInstance) {
      socketInstance = io(API_URL, {
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
        transports: ['websocket', 'polling'],
      });

      socketInstance.on('connect', () => {
        console.log('Support Socket connected');
        if (userId) {
          socketInstance.emit('join_user_room', userId);
        }
      });

      socketInstance.on('connect_error', (err) => {
        console.error('Socket connection error:', err);
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
  }
};

export default supportSocketService;