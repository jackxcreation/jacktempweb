// src/hooks/support/useSupportSocket.js
import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

export const useSupportSocket = ({ 
  API_URL, 
  isOpen = true, 
  user, 
  conversationId, 
  onAdminReply, 
  onSystemEvent,
  // 🔥 Admin Dashboard Props
  onNewMessage,
  onTicketUpdate,
  onNewTicket
} = {}) => {
  const socketRef = useRef(null);
  const processedMessageIds = useRef(new Set()); // Deduplication registry

  // Stable Callback Refs for BOTH Customer and Admin events
  const onAdminReplyRef = useRef(onAdminReply);
  const onSystemEventRef = useRef(onSystemEvent);
  const onNewMessageRef = useRef(onNewMessage);
  const onTicketUpdateRef = useRef(onTicketUpdate);
  const onNewTicketRef = useRef(onNewTicket);

  useEffect(() => {
    onAdminReplyRef.current = onAdminReply;
    onSystemEventRef.current = onSystemEvent;
    onNewMessageRef.current = onNewMessage;
    onTicketUpdateRef.current = onTicketUpdate;
    onNewTicketRef.current = onNewTicket;
  }, [onAdminReply, onSystemEvent, onNewMessage, onTicketUpdate, onNewTicket]);

  useEffect(() => {
    if (!isOpen) return;

    // Bulletproof Base URL resolution
    let baseUrl = API_URL || (typeof window !== 'undefined' ? window.location.origin : '');
    baseUrl = baseUrl.replace(/\/api(\/.*)?$/, '').replace(/\/support\/message$/, '').replace(/\/chat$/, '');

    // Retrieve auth token safely
    const token = typeof window !== 'undefined'
      ? (localStorage.getItem('token') || localStorage.getItem('admin_token') || localStorage.getItem('jack_token') || localStorage.getItem('jwt') || '')
      : '';

    // Added withCredentials: true for Cookie-based Auth & Standardized Transport
    socketRef.current = io(baseUrl, {
      auth: { token },
      withCredentials: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      transports: ['websocket', 'polling']
    });

    const socket = socketRef.current;
    const userIdForSocket = user?.id || user?._id || `guest_${socket.id || Date.now()}`;

    socket.on('connect', () => {
      // 1. Join user-specific room
      socket.emit('join_user_room', userIdForSocket);
      
      // 2. Automatically join active conversation room if provided
      if (conversationId) {
        socket.emit('join_conversation', conversationId);
      }

      // Automatically attempt to subscribe to Admin channels (restricted securely server-side)
      socket.emit('subscribe_admin_channels');

      if (onSystemEventRef.current) {
        onSystemEventRef.current({ type: 'network', status: 'connected' });
      }
    });

    socket.on('disconnect', () => {
      if (onSystemEventRef.current) {
        onSystemEventRef.current({ type: 'network', status: 'disconnected' });
      }
    });

    // ========================================================
    // 🛎️ CUSTOMER-FACING EVENT HANDLERS
    // ========================================================
    const handleAdminMessage = (data) => {
      if (!data) return;
      const msgId = data.id || data._id || data.messageId || `admin-${Date.now()}-${Math.random()}`;
      
      if (processedMessageIds.current.has(msgId)) return;
      processedMessageIds.current.add(msgId);
      
      // Memory Leak Protection
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

    socket.on('receive_admin_reply', handleAdminMessage);
    
    const safeMessageHandler = (data) => {
      const sender = String(data?.senderType || data?.sender || '').toUpperCase();
      if (['AGENT', 'ADMIN', 'SYSTEM'].includes(sender)) {
        handleAdminMessage(data);
      }
    };

    socket.on('support:message', safeMessageHandler);
    socket.on('receive_message', safeMessageHandler);

    socket.on('agent_joined', (data) => {
      if (onSystemEventRef.current) {
        onSystemEventRef.current({ type: 'agent_joined', agent: data?.agent || data });
      }
    });

    socket.on('ticket_resolved', (data) => {
      if (onSystemEventRef.current) {
        onSystemEventRef.current({ type: 'ticket_resolved', data });
      }
    });

    // ========================================================
    // 🛡️ ADMIN-FACING EVENT HANDLERS (Direct Backend Connection)
    // ========================================================
    socket.on('ticket.message.added', (data) => {
      if (onNewMessageRef.current) {
        onNewMessageRef.current(data);
      }
    });

    socket.on('ticket.status.updated', (data) => {
      if (onTicketUpdateRef.current) {
        onTicketUpdateRef.current({ 
          ticketId: data.ticketId, 
          updates: { status: data.status, assignedAgent: data.assignedAgent }
        });
      }
    });

    socket.on('ticket.created', (data) => {
      if (onNewTicketRef.current) {
        onNewTicketRef.current(data);
      }
    });

    socket.on('new_ticket_alert', (data) => {
      if (onNewTicketRef.current) {
        onNewTicketRef.current(data);
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
  }, [API_URL, isOpen, user?.id, user?._id]); 

  // 🔥 FIX: Dynamic Room Switcher Effect (Jo pichle room ko leave karke naye conversation room ko join karega)
  useEffect(() => {
    const socket = socketRef.current;
    if (socket && socket.connected && conversationId) {
      socket.emit('join_conversation', conversationId);
    }
  }, [conversationId]);

  // ========================================================
  // 🚀 OUTGOING EMITTERS
  // ========================================================
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

  const emitTyping = useCallback((isTyping, room) => {
    if (socketRef.current?.connected && room) {
      socketRef.current.emit('support:typing', { room, isTyping });
    }
  }, []);

  return { escalate, joinRoom, emitTyping, socket: socketRef.current };
};

export default useSupportSocket;