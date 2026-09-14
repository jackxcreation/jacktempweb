const express = require('express');
const router = express.Router();
// 🔥 FIX: Destructured from index.js megastructure to avoid "Model not found" errors
const { SupportTicket, User } = require('../models'); 
const { protect, admin } = require('../middleware/authMiddleware');

// ==========================================
// 📊 1. 🔥 NEW: Get Ticket Statistics (For Admin Dashboard Top Cards)
// NOTE: This must be above /:id so Express doesn't treat 'stats' as an ID
// ==========================================
router.get('/stats', protect, admin, async (req, res, next) => {
  try {
    const totalOpen = await SupportTicket.countDocuments({ status: { $in: ['OPEN', 'open'] } });
    const totalPending = await SupportTicket.countDocuments({ status: { $in: ['PENDING', 'pending'] } });
    const urgentTickets = await SupportTicket.countDocuments({ 
      priority: { $in: ['URGENT', 'Urgent', 'HIGH', 'High'] }, 
      status: { $nin: ['CLOSED', 'closed', 'RESOLVED', 'resolved'] } 
    });
    
    // SLA Breached: Tickets where deadline has passed but still not closed
    const slaBreached = await SupportTicket.countDocuments({
      'slaDeadline': { $lt: new Date() },
      status: { $nin: ['CLOSED', 'closed', 'RESOLVED', 'resolved'] }
    });

    res.status(200).json({ success: true, stats: { totalOpen, totalPending, urgentTickets, slaBreached } });
  } catch (error) {
    console.error("Fetch Ticket Stats Error:", error);
    next(error);
  }
});

// ==========================================
// 📋 2. List tickets with filtering (Admin Dashboard)
// ==========================================
router.get('/', protect, admin, async (req, res, next) => {
  try {
    const { status, priority, agentId, page = 1, limit = 50 } = req.query;
    let query = {};

    // 🔥 FIX: Case-insensitive regex to catch both 'OPEN', 'open', 'High', 'HIGH', etc.
    if (status) query.status = new RegExp(`^${status}$`, 'i');
    if (priority) query.priority = new RegExp(`^${priority}$`, 'i');
    
    if (agentId) {
      query.assignedAgentId = agentId === 'unassigned' ? null : agentId;
    }

    const tickets = await SupportTicket.find(query)
      .populate('customerId', 'name email')
      .populate('assignedAgentId', 'name email')
      .sort({ slaDeadline: 1, createdAt: -1 }) // Closest deadline first
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await SupportTicket.countDocuments(query);

    res.status(200).json({ tickets, total, pages: Math.ceil(total / limit) });
  } catch (error) {
    console.error("List Tickets Error:", error);
    next(error);
  }
});

// ==========================================
// 📄 3. Get a SINGLE support ticket by ID
// ==========================================
router.get('/:id', protect, admin, async (req, res, next) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id)
      .populate('customerId', 'name email phone')
      .populate('assignedAgentId', 'name email');
      
    if (!ticket) {
      return res.status(404).json({ error: 'Support ticket not found' });
    }
    
    res.status(200).json(ticket);
  } catch (error) {
    console.error("Fetch Single Ticket Error:", error);
    next(error);
  }
});

// ==========================================
// 🔄 4. Update Ticket Status/Assignment
// ==========================================
router.patch('/:id', protect, admin, async (req, res, next) => {
  try {
    const { status, assignedAgentId, resolution } = req.body;
    let updateData = {};

    if (status) updateData.status = status.toUpperCase(); // Force uppercase to match standard enums
    
    if (assignedAgentId !== undefined) {
      updateData.assignedAgentId = assignedAgentId === 'unassigned' ? null : assignedAgentId;
      
      // Auto-update the agent name string if an agent ID is provided
      if (assignedAgentId !== 'unassigned') {
        const agent = await User.findById(assignedAgentId).select('name');
        if (agent) updateData.assignedAgent = agent.name;
      } else {
        updateData.assignedAgent = 'Unassigned';
      }
    }
    
    if (resolution) {
      updateData.resolution = resolution;
      updateData.resolvedAt = Date.now();
    }
    
    if (status && (status.toUpperCase() === 'CLOSED' || status.toUpperCase() === 'RESOLVED')) {
      updateData.closedAt = Date.now();
    }

    const ticket = await SupportTicket.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate('customerId assignedAgentId', 'name email');

    if (!ticket) {
      return res.status(404).json({ error: 'Support ticket not found' });
    }

    // 🔥 Real-time Socket Broadcast
    const io = req.app.get('io');
    if (io) {
      io.emit('ticketUpdated', ticket); // Updates the admin dashboard queue dynamically
      if (ticket.conversationId) {
        // Also notify the customer that their ticket status changed
        io.to(ticket.conversationId).emit('ticket_status_changed', { status: ticket.status });
      }
    }

    res.status(200).json({ success: true, ticket });
  } catch (error) {
    console.error("Update Ticket Error:", error);
    next(error);
  }
});

module.exports = router;