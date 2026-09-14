const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const SupportConversation = require('../models/SupportConversation');
const SupportMessage = require('../models/SupportMessage');
const { protect, admin } = require('../middleware/authMiddleware');

// ==========================================
// 🛡️ OPTIONAL AUTH MIDDLEWARE (For Guests & Users)
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
      // Invalid token, proceed as guest
    }
  }
  next();
};

// ==========================================
// 📋 1. Get ALL Active Conversations (Admin/Agent Facing)
// ==========================================
router.get('/admin/active', protect, admin, async (req, res, next) => {
  try {
    // 🔥 FIX: Handled both uppercase/lowercase statuses and populated customer details for UI
    const activeConversations = await SupportConversation.find({ 
      status: { $nin: ['RESOLVED', 'CLOSED', 'resolved', 'closed'] } 
    })
    .populate('customerId', 'name email phone') // Fetch user details for the Admin UI
    .sort({ updatedAt: -1 })
    .lean();
    
    res.status(200).json(activeConversations);
  } catch (error) {
    console.error("Admin Fetch Conversations Error:", error);
    next(error);
  }
});

// ==========================================
// 🙋‍♂️ 2. 🔥 NEW: Assign/Claim a Conversation (Agent/Admin)
// ==========================================
router.post('/:id/assign', protect, admin, async (req, res, next) => {
  try {
    const conversation = await SupportConversation.findOneAndUpdate(
      { conversationId: req.params.id },
      { 
        $set: { 
          assignedAgentId: req.user._id,
          assignedAgentName: req.user.name,
          status: 'ACTIVE' 
        } 
      },
      { new: true }
    );

    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    const io = req.app.get('io');
    if (io) {
      io.to(req.params.id).emit('agent_joined', {
        message: `${req.user.name} has joined the chat.`,
        agentName: req.user.name
      });
      io.emit('dashboard_ticket_assigned', { conversationId: req.params.id, agentId: req.user._id });
    }

    res.status(200).json({ success: true, conversation });
  } catch (error) {
    console.error("Assign Conversation Error:", error);
    next(error);
  }
});

// ==========================================
// 💬 3. Get conversation history (Customer, Guest, Admin facing)
// ==========================================
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const customerId = req.user ? req.user._id : null;
    const guestId = req.query.guestId;

    // Check if the user is an admin (Admins can view any ticket)
    const isAdmin = req.user && ['admin', 'manager', 'support'].includes(req.user.role);

    const query = { conversationId: id };
    
    // If not admin, enforce strict ownership verification
    if (!isAdmin) {
      if (customerId) {
        query.customerId = customerId;
      } else if (guestId) {
        query.guestId = guestId;
      } else {
        return res.status(401).json({ error: 'Unauthorized to view this conversation' });
      }
    }

    const conversation = await SupportConversation.findOne(query).populate('customerId', 'name email');
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found or unauthorized' });
    }

    // Filter out internal admin notes from customer view (Admins see everything)
    const messageQuery = { conversationId: id };
    if (!isAdmin) {
      messageQuery.isInternal = { $ne: true };
    }

    const messages = await SupportMessage.find(messageQuery).sort({ createdAt: 1 });

    res.status(200).json({ conversation, messages });
  } catch (error) {
    console.error("Fetch Conversation Error:", error);
    next(error);
  }
});

// ==========================================
// ✅ 4. Resolve a conversation
// ==========================================
router.post('/:id/resolve', optionalAuth, async (req, res, next) => {
  try {
    // 🔥 FIX: Updated status to standard uppercase 'RESOLVED' to match schema constraints
    const conversation = await SupportConversation.findOneAndUpdate(
      { conversationId: req.params.id },
      { 
        status: 'RESOLVED',
        resolvedAt: Date.now(),
        resolvedBy: req.user ? req.user._id : null
      },
      { new: true }
    );
    
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    // Broadcast the resolution to all connected users in that conversation room
    const io = req.app.get('io');
    if (io) {
      io.to(req.params.id).emit('ticket_resolved', {
        conversationId: req.params.id,
        message: 'This conversation has been resolved.'
      });
      // Also notify agents monitoring the general dashboard
      io.emit('dashboard_ticket_resolved', { conversationId: req.params.id });
    }

    res.status(200).json({ success: true, conversation });
  } catch (error) {
    console.error("Resolve Conversation Error:", error);
    next(error);
  }
});

module.exports = router;