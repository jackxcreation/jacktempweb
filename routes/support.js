const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken'); // 🔥 Added for token parsing
// 🔥 FIX: Added SupportMessage and Ticket to imports so Admin can read/reply to them
const { User, SupportConversation, SupportMessage, Ticket } = require('../models'); 
const { handleIncomingMessage } = require('../services/support/supportOrchestrator');
const escalationService = require('../services/support/escalationService');

// ==========================================
// 🛡️ OPTIONAL AUTH MIDDLEWARE (Allows both Guests & Users)
// ==========================================
const optionalAuth = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
    } catch (error) {
      // Token is invalid/expired, but we don't throw an error. 
      // They will just be treated as a Guest.
    }
  }
  next();
};

// ==========================================
// 🛡️ ADVANCED ADMIN AUTH MIDDLEWARE
// ==========================================
const adminAuth = async (req, res, next) => {
  await optionalAuth(req, res, () => {
    // Check if logged in user has admin, support, or manager role
    if (req.user && ['admin', 'support', 'manager'].includes(req.user.role)) {
      next();
    } else {
      return res.status(403).json({ error: 'Not authorized as an admin or support agent' });
    }
  });
};

// ==========================================
// 💬 MAIN CUSTOMER CHAT ENDPOINT
// ==========================================
router.post('/message', optionalAuth, async (req, res, next) => {
  try {
    let { message, conversationId, guestId, languageStyle } = req.body;
    const customerId = req.user ? req.user._id : null;

    // 🔥 FIX: Auto-generate a guestId if neither customerId nor guestId is provided
    if (!customerId && !guestId) {
      guestId = `guest_${Math.random().toString(36).substring(2, 15)}`;
    }

    if (!message) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const io = req.app.get('io');
    
    const result = await handleIncomingMessage({
      text: message,
      customerId,
      guestId,
      conversationId,
      languageStyle, // 🔥 Passed to orchestrator for localized AI responses
      socket: io
    });

    // 🔥 FIX: Return the guestId so the frontend can save it for future requests
    res.status(200).json({
      ...result,
      guestId: customerId ? null : guestId 
    });
  } catch (error) {
    console.error("Support Message Route Error:", error);
    next(error);
  }
});

// ==========================================
// 🚨 EXPLICIT MANUAL ESCALATION ENDPOINT
// ==========================================
router.post('/escalate', optionalAuth, async (req, res, next) => {
  try {
    const { conversationId } = req.body;
    const io = req.app.get('io');
    
    const conversation = await SupportConversation.findOne({ conversationId });
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    const result = await escalationService.triggerEscalation(conversation, 'EXPLICIT_REQUEST', io);
    res.status(200).json(result);
  } catch (error) {
    console.error("Support Escalate Route Error:", error);
    next(error);
  }
});

// ==========================================
// 👑 ADVANCED ADMIN DASHBOARD ROUTES (NEW)
// ==========================================

// 1. Fetch all tickets for the Admin Panel (Includes Guest & PENDING tickets)
router.get('/admin/tickets', adminAuth, async (req, res, next) => {
  try {
    // Fetch tickets that are NOT closed
    const tickets = await Ticket.find({
      status: { $ne: 'CLOSED' }
    })
    .sort({
      priority: -1, // HIGH / URGENT priority first
      slaDeadline: 1, // Closest SLA deadline first
      createdAt: -1 // Newest first
    })
    .lean();

    // Calculate quick stats for Admin UI tiles
    const stats = {
      totalActive: tickets.length,
      highPriority: tickets.filter(t => t.priority === 'HIGH' || t.priority === 'URGENT').length,
      unassigned: tickets.filter(t => !t.assignedAgentId).length
    };

    res.status(200).json({ success: true, stats, tickets });
  } catch (error) {
    console.error("Admin Fetch Tickets Error:", error);
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

// 2. Fetch full chat history for a specific ticket/conversation
router.get('/admin/messages/:conversationId', adminAuth, async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const messages = await SupportMessage.find({ conversationId })
      .sort({ createdAt: 1 }) // Chronological order
      .lean();
      
    res.status(200).json({ success: true, messages });
  } catch (error) {
    console.error("Admin Fetch Messages Error:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// 3. Agent sends a reply to the customer
router.post('/admin/reply', adminAuth, async (req, res, next) => {
  try {
    const { conversationId, content } = req.body;
    const io = req.app.get('io');

    if (!content) return res.status(400).json({ error: 'Message content is required' });

    // Save the agent's message in the database
    const newMessage = await SupportMessage.create({
      conversationId,
      senderType: 'AGENT',
      senderId: req.user._id.toString(),
      content: content,
      contentType: 'text'
    });

    // Auto-update ticket status to OPEN if it was PENDING, and assign this agent
    await Ticket.findOneAndUpdate(
      { conversationId },
      { 
        $set: { 
          status: 'OPEN', 
          assignedAgentId: req.user._id, 
          assignedAgent: req.user.name 
        } 
      }
    );

    // 🔥 Real-time Broadcast: Instantly pop up the agent's message on the customer's screen
    io.to(conversationId).emit('receive_message', {
      _id: newMessage._id,
      conversationId: newMessage.conversationId,
      senderType: 'AGENT',
      content: newMessage.content,
      createdAt: newMessage.createdAt
    });

    res.status(200).json({ success: true, message: newMessage });
  } catch (error) {
    console.error("Admin Reply Error:", error);
    res.status(500).json({ error: "Failed to send reply" });
  }
});

module.exports = router;