// jack-frontend/src/hooks/support/useSupportSocket.js
import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

export const useSupportSocket = ({ API_URL, isOpen, user, conversationId, onAdminReply, onSystemEvent }) => {
  const socketRef = useRef(null);
  const processedMessageIds = useRef(new Set()); // Deduplication registry

  // 🔥 CRITICAL FIX 1: Stable Callback Refs
  // Prevents the Socket from disconnecting/reconnecting every time the parent component's state changes.
  const onAdminReplyRef = useRef(onAdminReply);
  const onSystemEventRef = useRef(onSystemEvent);

  useEffect(() => {
    onAdminReplyRef.current = onAdminReply;
    onSystemEventRef.current = onSystemEvent;
  }, [onAdminReply, onSystemEvent]);

  useEffect(() => {
    if (!isOpen) return;

    // 🔥 CRITICAL FIX 2: Bulletproof Base URL resolution
    // Safely strips '/api', '/support/message', or '/chat' to get the true root domain for Socket.io
    let baseUrl = API_URL || '';
    baseUrl = baseUrl.replace(/\/api(\/.*)?$/, '').replace(/\/support\/message$/, '').replace(/\/chat$/, '');

    // Retrieve auth token securely for socket handshake
    const token = typeof window !== 'undefined'
      ? (localStorage.getItem('token') || localStorage.getItem('admin_token') || localStorage.getItem('jack_token') || localStorage.getItem('jwt') || '')
      : '';

    // Connect with authentication and robust retry config
    socketRef.current = io(baseUrl, {
      auth: { token },
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      transports: ['websocket', 'polling']
    });

    const socket = socketRef.current;
    const userIdForSocket = user?.id || user?._id || `guest_${socket.id || Date.now()}`;

    socket.on('connect', () => {
      socket.emit('join_user_room', userIdForSocket);
      
      // Automatically join active conversation room if provided
      if (conversationId) {
        socket.emit('join_conversation', conversationId);
      }

      if (onSystemEventRef.current) {
        onSystemEventRef.current({ type: 'network', status: 'connected' });
      }
    });

    socket.on('disconnect', () => {
      if (onSystemEventRef.current) {
        onSystemEventRef.current({ type: 'network', status: 'disconnected' });
      }
    });

    // Unified handler for admin/agent replies with deduplication
    const handleAdminMessage = (data) => {
      if (!data) return;
      const msgId = data.id || data._id || data.messageId || `admin-${Date.now()}-${Math.random()}`;
      
      if (processedMessageIds.current.has(msgId)) return;
      processedMessageIds.current.add(msgId);
      
      // 🔥 FIX 3: Memory Leak Protection
      // Cap the deduplication Set size to 500 so it doesn't grow infinitely in long sessions
      if (processedMessageIds.current.size > 500) {
        const firstItem = processedMessageIds.current.values().next().value;
        processedMessageIds.current.delete(firstItem);
      }
      
      if (onAdminReplyRef.current) {
        onAdminReplyRef.current({
          id: msgId,
          sender: 'admin',
          text: data.text || data.content || '',
          time: data.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: data.type || 'text',
          structuredData: data.structuredData || null
        });
      }
    };

    // Listen for all standard admin reply contracts
    socket.on('receive_admin_reply', handleAdminMessage);
    
    // 🔥 FIX 4: Safe uppercase checking prevents undefined method crashes
    const safeMessageHandler = (data) => {
      const sender = String(data?.senderType || data?.sender || '').toUpperCase();
      if (['AGENT', 'ADMIN', 'SYSTEM'].includes(sender)) {
        handleAdminMessage(data);
      }
    };

    socket.on('support:message', safeMessageHandler);
    socket.on('receive_message', safeMessageHandler);

    // New Contract: Agent assignment
    socket.on('agent_joined', (data) => {
      if (onSystemEventRef.current) {
        onSystemEventRef.current({ type: 'agent_joined', agent: data?.agent || data });
      }
    });

    // New Contract: Ticket resolved
    socket.on('ticket_resolved', (data) => {
      if (onSystemEventRef.current) {
        onSystemEventRef.current({ type: 'ticket_resolved', data });
      }
    });

    return () => {
      if (socket) {
        if (conversationId) {
          socket.emit('leave_conversation', conversationId);
        }
        socket.removeAllListeners();
        socket.disconnect();
        socketRef.current = null;
      }
    };
  // 🔥 Removed the unstable callbacks from dependency array!
  }, [API_URL, isOpen, user?.id, user?._id, conversationId]); 

  const escalate = useCallback((payload) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('escalate_to_human', payload);
    }
  }, []);

  const joinRoom = useCallback((targetConvId) => {
    if (socketRef.current?.connected && targetConvId) {
      socketRef.current.emit('join_conversation', targetConvId);
    }
  }, []);

  return { escalate, joinRoom, socket: socketRef.current };
};