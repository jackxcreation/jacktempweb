const authenticateSocket = require('./socketAuth');
const EVENTS = require('./supportEvents');
const SupportTicket = require('../models/SupportTicket');
const SupportConversation = require('../models/SupportConversation');

module.exports = (io) => {
  // 1. Apply Security Middleware
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    const identifier = socket.user.email || socket.user.name;
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

    // 3. Customer Conversation Room Joining
    socket.on(EVENTS.JOIN_USER_ROOM, (userId) => {
      // Admins can join any room to assist; users can only join their own
      if (socket.user.role === 'admin' || socket.user.id === userId || socket.user.role === 'guest') {
        socket.join(userId);
      }
    });

    // 4. Admin Live Reply Routing
    socket.on(EVENTS.ADMIN_REPLY, async (data) => {
      try {
        if (socket.user.role !== 'admin') return;

        const ticket = await SupportTicket.findById(data.ticketId);
        if (ticket) {
          const targetRoom = data.userId || ticket.customerId?.toString() || ticket.conversationId;
          
          // Emit message directly to the customer's chat interface
          io.to(targetRoom).emit(EVENTS.RECEIVE_ADMIN_REPLY, {
            id: `admin-${Date.now()}`,
            sender: 'admin',
            text: data.text,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          });
          
          // Update conversation timestamp for sorting in the admin inbox
          await SupportConversation.findOneAndUpdate(
            { conversationId: ticket.conversationId },
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
        if (socket.user.role !== 'admin') return;
        
        // Broadcast to the customer that a human is now viewing the chat
        io.to(data.conversationId).emit(EVENTS.AGENT_JOINED, {
          agent: {
            id: socket.user._id,
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
       // Broadcast to everyone in the room except the sender
       socket.to(data.room).emit(EVENTS.TYPING, { 
         sender: socket.user.role, 
         isTyping: data.isTyping 
       });
    });

    socket.on('disconnect', () => {
      // Socket.IO automatically handles leaving rooms upon disconnect
    });
  });
};