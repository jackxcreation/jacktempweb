// hooks/useSupportSocket.js
import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

export const useSupportSocket = ({ API_URL, isOpen, user, onAdminReply, onSystemEvent }) => {
  const socketRef = useRef(null);
  const processedMessageIds = useRef(new Set()); // Deduplication registry

  useEffect(() => {
    if (!isOpen) return;

    // Connect
    socketRef.current = io(API_URL, {
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      transports: ['websocket', 'polling']
    });

    const userIdForSocket = user?.id || 'guest_user';

    socketRef.current.on('connect', () => {
      socketRef.current.emit('join_user_room', userIdForSocket);
      onSystemEvent({ type: 'network', status: 'connected' });
    });

    socketRef.current.on('disconnect', () => {
      onSystemEvent({ type: 'network', status: 'disconnected' });
    });

    // Existing Admin Reply payload
    socketRef.current.on('receive_admin_reply', (data) => {
      const msgId = data.id || `admin-${Date.now()}-${Math.random()}`;
      if (processedMessageIds.current.has(msgId)) return;
      processedMessageIds.current.add(msgId);
      
      onAdminReply({
        id: msgId,
        sender: 'admin',
        text: data.text,
        time: data.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'text'
      });
    });

    // New Contract: Agent assignment
    socketRef.current.on('agent_joined', (data) => {
      onSystemEvent({ type: 'agent_joined', agent: data.agent });
    });

    // New Contract: Ticket resolved
    socketRef.current.on('ticket_resolved', () => {
      onSystemEvent({ type: 'ticket_resolved' });
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
      }
    };
  }, [API_URL, isOpen, user?.id]);

  const escalate = useCallback((payload) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('escalate_to_human', payload);
    }
  }, []);

  return { escalate };
};