const authenticateSocket = require('./socketAuth');
const EVENTS = require('./supportEvents');
const SupportTicket = require('../models/SupportTicket');
const SupportConversation = require('../models/SupportConversation');
const messageService = require('../services/support/messageService');

module.exports = (io) => {
  // 1. Apply Security Middleware
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    const identifier = socket.user.email || socket.user.name || socket.id;
    console.log(`🔒 Support Socket Connected: ${identifier} (${socket.id})`);

    // 2. Admin Global Room Subscription
    if (socket.user.role === 'admin') {
      socket.join('admin_room');
    }

    socket.on(EVENTS.SUBSCRIBE_ADMIN_CHANNELS, () => {
      if (socket.user.role === 'admin') {
        socket.join('support_queue');
      }
    });

    // 3. Customer & Admin Conversation/User Room Joining
    socket.on(EVENTS.JOIN_USER_ROOM, (roomTarget) => {
      // Admins can join any room to assist; users can join their own user ID or conversation ID
      if (socket.user.role === 'admin' || socket.user.id === roomTarget || socket.user.role === 'guest' || roomTarget) {
        socket.join(roomTarget);
      }
    });

    // 🔥 NEW HELPER EVENT: Explicitly join a specific conversation room
    socket.on('join_conversation', (conversationId) => {
      if (conversationId) {
        socket.join(conversationId);
      }
    });

    // 4. Admin Live Reply Routing & Database Persistence
    socket.on(EVENTS.ADMIN_REPLY, async (data) => {
      try {
        if (socket.user.role !== 'admin') return;

        const ticket = data.ticketId ? await SupportTicket.findById(data.ticketId) : null;
        const conversationId = data.conversationId || ticket?.conversationId;
        const targetRoom = data.userId || ticket?.customerId?.toString() || conversationId;
        
        if (conversationId && data.text) {
          // 🔥 PERSISTENCE FIX: Save admin reply message to database so history is preserved
          try {
            await messageService.saveMessage({
              conversationId: conversationId,
              senderType: 'ADMIN',
              senderId: socket.user._id || socket.user.id,
              content: data.text,
              contentType: 'text'
            });
          } catch (dbErr) {
            console.error("Failed to persist admin reply in database:", dbErr.message);
          }

          const messagePayload = {
            id: `admin-${Date.now()}`,
            messageId: `msg-${Date.now()}`,
            senderType: 'ADMIN',
            senderId: socket.user._id || socket.user.id,
            content: data.text,
            contentType: 'text',
            createdAt: new Date(),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };

          // Emit message directly to the conversation room and target user room
          io.to(conversationId).emit(EVENTS.RECEIVE_ADMIN_REPLY, messagePayload);
          if (targetRoom && targetRoom !== conversationId) {
            io.to(targetRoom).emit(EVENTS.RECEIVE_ADMIN_REPLY, messagePayload);
          }
          
          // Update conversation timestamp for sorting in the admin inbox
          await SupportConversation.findOneAndUpdate(
            { conversationId: conversationId },
            { lastMessageAt: Date.now() }
          );
        }
      } catch (err) {
        console.error("Support Socket Admin Reply Error:", err);
      }
    });

    // 5. Agent Joined Notification
    socket.on(EVENTS.AGENT_JOINED, async (data) => {
      try {
        if (socket.user.role !== 'admin' || !data || !data.conversationId) return;
        
        // Broadcast to the customer that a human agent is now viewing/active in the chat
        io.to(data.conversationId).emit(EVENTS.AGENT_JOINED, {
          agent: {
            id: socket.user._id || socket.user.id,
            name: socket.user.name,
            department: 'Support'
          }
        });
      } catch (err) {
        console.error("Support Socket Agent Join Error:", err);
      }
    });

    // 6. Live Typing Indicator
    socket.on(EVENTS.TYPING, (data) => {
      if (data && data.room) {
        // Broadcast to everyone in the room except the sender
        socket.to(data.room).emit(EVENTS.TYPING, { 
          sender: socket.user.role, 
          isTyping: Boolean(data.isTyping) 
        });
      }
    });

    socket.on('disconnect', () => {
      // Socket.IO automatically handles leaving rooms upon disconnect
    });
  });
};