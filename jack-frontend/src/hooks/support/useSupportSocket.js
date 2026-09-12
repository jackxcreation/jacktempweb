import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

export const useSupportSocket = ({ API_URL, isOpen, user, onAdminReply, onSystemEvent }) => {
  const socketRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    // Clean base URL for socket connection (stripping endpoint paths if present)
    const baseUrl = API_URL ? API_URL.replace(/\/support\/message$/, '').replace(/\/chat$/, '') : '';
    const token = localStorage.getItem('token') || localStorage.getItem('admin_token') || localStorage.getItem('jack_token') || '';

    socketRef.current = io(baseUrl, {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      const userId = user?.id || user?._id || `guest_${socket.id}`;
      socket.emit('join_user_room', userId);
    });

    // Listen for live admin replies
    socket.on('receive_admin_reply', (msg) => {
      if (onAdminReply) onAdminReply(msg);
    });

    // Listen for agent joined events
    socket.on('agent_joined', (event) => {
      if (onSystemEvent) onSystemEvent({ type: 'agent_joined', agent: event.agent });
    });

    // Listen for ticket resolution
    socket.on('ticket_resolved', () => {
      if (onSystemEvent) onSystemEvent({ type: 'ticket_resolved' });
    });

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [isOpen, user, API_URL, onAdminReply, onSystemEvent]);

  // Escalate function to trigger ticket creation and live agent handoff
  const escalate = useCallback((payload) => {
    if (socketRef.current) {
      socketRef.current.emit('escalate_to_human', payload);
    }
  }, []);

  return { escalate };
};