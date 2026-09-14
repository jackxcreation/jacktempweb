// jack-frontend/src/hooks/support/useSupportSocket.js
import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

export const useSupportSocket = ({ API_URL, isOpen, user, conversationId, onAdminReply, onSystemEvent }) => {
  const socketRef = useRef(null);
  
  // 🔥 CRITICAL FIX: Store callbacks in refs to prevent the "Infinite Reconnect Loop" bug.
  // This ensures the socket doesn't disconnect/reconnect every time the parent component re-renders.
  const onAdminReplyRef = useRef(onAdminReply);
  const onSystemEventRef = useRef(onSystemEvent);

  useEffect(() => {
    onAdminReplyRef.current = onAdminReply;
    onSystemEventRef.current = onSystemEvent;
  }, [onAdminReply, onSystemEvent]);

  useEffect(() => {
    if (!isOpen) return;

    // 🔥 CRITICAL FIX: Safely strip '/api', '/support/message', or '/chat' to get the true root domain for Socket.io
    let baseUrl = API_URL || '';
    baseUrl = baseUrl.replace(/\/api(\/.*)?$/, '').replace(/\/support\/message$/, '').replace(/\/chat$/, '');
    
    // Extended token check including 'jwt'
    const token = typeof window !== 'undefined'
      ? (localStorage.getItem('token') || localStorage.getItem('admin_token') || localStorage.getItem('jack_token') || localStorage.getItem('jwt') || '')
      : '';

    socketRef.current = io(baseUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('Chat Widget Socket connected:', socket.id);
      const userId = user?.id || user?._id || `guest_${socket.id}`;
      socket.emit('join_user_room', userId);
      
      // Automatically join active conversation room if provided
      if (conversationId) {
        socket.emit('join_conversation', conversationId);
      }
    });

    // Unified handler utilizing the stable refs
    const handleAdminMessage = (msg) => {
      if (onAdminReplyRef.current && msg) {
        onAdminReplyRef.current(msg);
      }
    };

    socket.on('receive_admin_reply', handleAdminMessage);
    
    socket.on('receive_message', (msg) => {
      // 🔥 FIX: Ensures we safely check sender/senderType without throwing undefined errors
      const sender = String(msg?.senderType || msg?.sender || '').toUpperCase();
      if (['AGENT', 'ADMIN', 'SYSTEM'].includes(sender)) {
        handleAdminMessage(msg);
      }
    });
    
    socket.on('support:message', handleAdminMessage);

    // Listen for agent joined events
    socket.on('agent_joined', (event) => {
      if (onSystemEventRef.current) {
        onSystemEventRef.current({ type: 'agent_joined', agent: event?.agent || event });
      }
    });

    // Listen for ticket resolution
    socket.on('ticket_resolved', (event) => {
      if (onSystemEventRef.current) {
        onSystemEventRef.current({ type: 'ticket_resolved', data: event });
      }
    });

    return () => {
      if (socket) {
        if (conversationId) {
          socket.emit('leave_conversation', conversationId);
        }
        socket.disconnect();
        socketRef.current = null;
      }
    };
  }, [isOpen, user, conversationId, API_URL]); // 🔥 Removed callbacks from dependency array!

  // Escalate function to trigger ticket creation and live agent handoff
  const escalate = useCallback((payload) => {
    if (socketRef.current) {
      socketRef.current.emit('escalate_to_human', payload);
    }
  }, []);

  // Dynamically join conversation rooms if ID updates
  const joinRoom = useCallback((targetConversationId) => {
    if (socketRef.current && targetConversationId) {
      socketRef.current.emit('join_conversation', targetConversationId);
    }
  }, []);

  return { escalate, joinRoom, socket: socketRef.current };
};