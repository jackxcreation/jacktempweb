// routes/tickets.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { Ticket, User, Order } = require('../models');
const SupportConversation = require('../models/SupportConversation');
const { z } = require('zod'); // 🔥 Zod for strict input validation
const { logger } = require('../utils/logger');

// 🚨 IMPORT AUTH & ZERO-TRUST RBAC MIDDLEWARES
const { protect } = require('../middleware/authMiddleware');
const { checkPermission } = require('../middleware/rbacMiddleware');

// ==========================================
// 🛡️ ZOD VALIDATION SCHEMAS FOR TICKETS
// ==========================================
const ticketCreationSchema = z.object({
  category: z.enum(['Shipping', 'Billing', 'Product Issue', 'Returns & Refund', 'General Inquiry', 'Other', 'GENERAL']).default('General Inquiry'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT', 'Low', 'Medium', 'High', 'Urgent']).default('MEDIUM'),
  orderId: z.string().optional().nullable(),
  subject: z.string().min(3, "Subject/Title is required").max(150),
  message: z.string().min(5, "Initial message is required").max(1000)
});

const ticketMessageSchema = z.object({
  text: z.string().min(1, "Message text cannot be empty").max(1000),
  sender: z.enum(['USER', 'user', 'ADMIN', 'admin', 'SUPPORT', 'support', 'BOT', 'bot', 'SYSTEM', 'system', 'AI', 'ai']).optional()
});

const ticketStatusSchema = z.object({
  status: z.enum(['OPEN', 'PENDING', 'RESOLVED', 'CLOSED', 'open', 'IN_PROGRESS']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT', 'Low', 'Medium', 'High', 'Urgent']).optional(),
  assignedAgent: z.string().optional(),
  assignedAgentId: z.string().optional().nullable() // 🔥 TASK #41: Strict agent assignment support
});

// Helper for error responses
const sendErrorResponse = (res, req, error, defaultMessage = "Internal Server Error", statusCode = 500) => {
  logger.error({
    message: defaultMessage,
    requestId: req.requestId,
    error: error.message,
    stack: error.stack,
    route: req.originalUrl
  });

  return res.status(statusCode).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? defaultMessage : error.message,
    requestId: req.requestId
  });
};

// Privileged support & admin roles
const PRIVILEGED_ROLES = [
  'admin', 'super_admin', 'operations_manager', 'customer_support', 
  'finance_manager', 'warehouse_manager', 'manager', 'support', 'analyst'
];

// ==========================================
// 🎫 1. CREATE SUPPORT TICKET (CUSTOMER FACING)
// ==========================================
router.post('/api/tickets', protect, async (req, res) => {
  try {
    const validationResult = ticketCreationSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        success: false, 
        message: "Validation failed", 
        errors: validationResult.error.format(),
        requestId: req.requestId 
      });
    }

    const { category, priority, orderId, subject, message } = validationResult.data;
    const userId = req.user._id.toString();
    const userName = req.user.name || 'Customer';

    const ticketNumber = `TKT-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 90 + 10)}`;
    const conversationId = `conv_${userId}_${Date.now()}`;

    const newTicket = new Ticket({
      userId,
      customerId: userId,
      conversationId,
      ticketNumber,
      userName,
      orderId: orderId || '',
      category,
      aiCategory: category,
      priority: priority.toUpperCase(),
      status: 'OPEN',
      // 🔥 TASK #41: SLA and tracking initialization
      slaDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
      lastCustomerMessageAt: new Date(),
      messages: [
        {
          sender: 'USER',
          text: `[${subject}] ${message}`,
          timestamp: new Date()
        }
      ]
    });

    const savedTicket = await newTicket.save();

    // 🔥 TASK #40: Ensure SupportConversation mirror is created/updated for continuity
    try {
      await SupportConversation.findOneAndUpdate(
        { conversationId },
        {
          $set: {
            customerId: req.user._id,
            ticketId: savedTicket._id,
            mode: 'AI_ACTIVE',
            status: 'ACTIVE',
            lastMessageAt: new Date()
          }
        },
        { upsert: true, new: true }
      );
    } catch (convErr) {
      logger.warn({ message: "Failed to sync SupportConversation mirror on ticket creation", error: convErr.message });
    }

    const io = req.app.get("io");
    if (io) {
      try {
        io.to('support').emit('ticket.created', { ticketId: savedTicket._id, ticketNumber });
      } catch (e) {}
    }

    return res.status(201).json({
      success: true,
      message: "Support ticket created successfully",
      ticket: { ...savedTicket._doc, id: savedTicket._id.toString() }
    });

  } catch (error) {
    return sendErrorResponse(res, req, error, "Failed to create support ticket");
  }
});

// ==========================================
// 🔍 2. GET SPECIFIC TICKET BY ID (STRICT IDOR & BOLA PROTECTED) 🔥
// ==========================================
router.get('/api/tickets/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid Ticket ID format", requestId: req.requestId });
    }

    const ticket = await Ticket.findById(id).lean();
    if (!ticket) {
      return res.status(404).json({ success: false, message: "Support ticket not found", requestId: req.requestId });
    }

    const isPrivilegedStaff = PRIVILEGED_ROLES.includes(req.user.role);
    const isOwner = (ticket.userId && ticket.userId.toString() === req.user._id.toString()) || 
                    (ticket.customerId && ticket.customerId.toString() === req.user._id.toString());

    // 🔥 STRICT RESOURCE-LEVEL OWNERSHIP ENFORCEMENT
    if (!isOwner && !isPrivilegedStaff) {
      logger.warn({
        message: `UNAUTHORIZED TICKET ACCESS ATTEMPT: User ${req.user.email} tried to access Ticket #${id}`,
        requestId: req.requestId,
        userId: req.user._id
      });
      return res.status(403).json({ success: false, message: "Access Denied: You do not own this support ticket.", requestId: req.requestId });
    }

    return res.status(200).json({
      success: true,
      ticket: { ...ticket, id: ticket._id.toString() }
    });

  } catch (error) {
    return sendErrorResponse(res, req, error, "Failed to fetch ticket details");
  }
});

// ==========================================
// 💬 3. ADD REPLY MESSAGE TO TICKET (IDOR & BOLA PROTECTED) 🔥 TASK #40 & #41 PERSISTENT
// ==========================================
router.post('/api/tickets/:id/messages', protect, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid Ticket ID format", requestId: req.requestId });
    }

    const validationResult = ticketMessageSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: validationResult.error.format(), requestId: req.requestId });
    }

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: "Support ticket not found", requestId: req.requestId });
    }

    const isPrivilegedStaff = PRIVILEGED_ROLES.includes(req.user.role);
    const isOwner = (ticket.userId && ticket.userId.toString() === req.user._id.toString()) || 
                    (ticket.customerId && ticket.customerId.toString() === req.user._id.toString());

    if (!isOwner && !isPrivilegedStaff) {
      return res.status(403).json({ success: false, message: "Access Denied: You cannot reply to this ticket.", requestId: req.requestId });
    }

    const senderType = isPrivilegedStaff ? 'ADMIN' : 'USER';
    const textContent = validationResult.data.text;

    const newMessage = {
      sender: senderType,
      text: textContent,
      timestamp: new Date()
    };

    ticket.messages.push(newMessage);

    // 🔥 TASK #41: Update customer message timestamp if sent by customer
    if (!isPrivilegedStaff) {
      ticket.lastCustomerMessageAt = new Date();
      if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
        ticket.status = 'OPEN';
      }
    } else {
      if (ticket.status === 'OPEN') {
        ticket.status = 'PENDING';
      }
    }

    await ticket.save();

    // 🔥 TASK #40: Sync persistent message to SupportConversation if conversationId exists
    if (ticket.conversationId) {
      try {
        await SupportConversation.findOneAndUpdate(
          { conversationId: ticket.conversationId },
          { 
            $set: { 
              lastMessageAt: new Date(),
              ticketId: ticket._id 
            } 
          },
          { upsert: true }
        );
      } catch (convSyncErr) {
        logger.warn({ message: "Failed to sync message to SupportConversation", error: convSyncErr.message });
      }
    }

    const io = req.app.get("io");
    if (io) {
      try {
        io.to('support').emit('ticket.message.added', { ticketId: ticket._id, message: newMessage });
        if (ticket.conversationId) {
          io.to(ticket.conversationId).emit('receive_admin_reply', {
            sender: senderType.toLowerCase(),
            text: textContent,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          });
        }
      } catch (e) {}
    }

    return res.status(200).json({
      success: true,
      message: "Message added successfully",
      ticket: { ...ticket._doc, id: ticket._id.toString() }
    });

  } catch (error) {
    return sendErrorResponse(res, req, error, "Failed to add message");
  }
});

// ==========================================
// 📋 4. GET ALL TICKETS WITH TASK #66 FILTERS & PAGINATION 🔥
// ==========================================
router.get('/api/tickets', protect, async (req, res) => {
  try {
    const isPrivilegedStaff = PRIVILEGED_ROLES.includes(req.user.role);
    const query = {};

    // If regular customer, restrict query strictly to their own tickets
    if (!isPrivilegedStaff) {
      query.$or = [
        { userId: req.user._id.toString() },
        { customerId: req.user._id.toString() }
      ];
    } else {
      // 🔥 TASK #66: Advanced Admin Filters Support (Open, Pending, Assigned, Escalated, Resolved, SLA breached)
      const { filter, search } = req.query;
      
      if (filter) {
        const cleanFilter = filter.toLowerCase();
        if (cleanFilter === 'open') {
          query.status = 'OPEN';
        } else if (cleanFilter === 'pending') {
          query.status = 'PENDING';
        } else if (cleanFilter === 'assigned') {
          query.assignedAgentId = { $ne: null };
        } else if (cleanFilter === 'escalated') {
          query.status = 'ESCALATED';
        } else if (cleanFilter === 'resolved') {
          query.status = { $in: ['RESOLVED', 'CLOSED'] };
        } else if (cleanFilter === 'sla_breached') {
          query.status = { $nin: ['RESOLVED', 'CLOSED'] };
          query.slaDeadline = { $lt: new Date() };
        }
      }

      if (search && search.trim().length > 0) {
        const safeSearchRegex = new RegExp(search.trim().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
        query.$or = [
          { userName: safeSearchRegex },
          { ticketNumber: safeSearchRegex },
          { orderId: safeSearchRegex }
        ];
      }

      if (req.query.userId) {
        query.$or = [
          { userId: req.query.userId },
          { customerId: req.query.userId }
        ];
      }
    }

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const [tickets, totalCount] = await Promise.all([
      Ticket.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Ticket.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      total: totalCount,
      page,
      pages: Math.ceil(totalCount / limit) || 1,
      tickets: tickets.map(t => ({
        ...t,
        id: t._id.toString(),
        isSlaBreached: t.slaDeadline && new Date() > new Date(t.slaDeadline) && t.status !== 'RESOLVED' && t.status !== 'CLOSED'
      }))
    });

  } catch (error) {
    return sendErrorResponse(res, req, error, "Failed to fetch tickets");
  }
});

// ==========================================
// ✏️ 5. UPDATE TICKET STATUS / ASSIGNMENT (ADMIN / SUPPORT ONLY) 🔥 TASK #41 ASSIGNMENT SYSTEM
// ==========================================
router.put('/api/tickets/:id/status', protect, checkPermission('tickets:all'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid Ticket ID format", requestId: req.requestId });
    }

    const validationResult = ticketStatusSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: validationResult.error.format(), requestId: req.requestId });
    }

    const { status, priority, assignedAgent, assignedAgentId } = validationResult.data;

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: "Support ticket not found", requestId: req.requestId });
    }

    if (status) ticket.status = status.toUpperCase();
    if (priority) ticket.priority = priority.toUpperCase();
    
    // 🔥 TASK #41: Advanced Agent Assignment System fields sync
    if (assignedAgent !== undefined) {
      ticket.assignedAgent = assignedAgent;
    }
    if (assignedAgentId !== undefined) {
      ticket.assignedAgentId = assignedAgentId ? new mongoose.Types.ObjectId(assignedAgentId) : null;
      ticket.assignedAt = assignedAgentId ? new Date() : null;
    } else if (assignedAgent && assignedAgent !== 'Unassigned' && !ticket.assignedAgentId) {
      ticket.assignedAt = new Date();
    }

    if (status && (status.toUpperCase() === 'RESOLVED' || status.toUpperCase() === 'CLOSED')) {
      ticket.resolvedAt = new Date();
    }

    await ticket.save();

    // Sync with SupportConversation mirror if active
    if (ticket.conversationId) {
      try {
        const convUpdate = { status: ticket.status };
        if (ticket.assignedAgentId) convUpdate.assignedAgentId = ticket.assignedAgentId;
        if (ticket.assignedAgent) convUpdate.assignedAgentName = ticket.assignedAgent;
        await SupportConversation.findOneAndUpdate({ conversationId: ticket.conversationId }, { $set: convUpdate });
      } catch (convUpErr) {}
    }

    const io = req.app.get("io");
    if (io) {
      try {
        io.to('support').emit('ticket.status.updated', { ticketId: ticket._id, status: ticket.status, assignedAgent: ticket.assignedAgent });
      } catch (e) {}
    }

    return res.status(200).json({
      success: true,
      message: "Ticket updated successfully",
      ticket: { ...ticket._doc, id: ticket._id.toString() }
    });

  } catch (error) {
    return sendErrorResponse(res, req, error, "Failed to update ticket status");
  }
});

module.exports = router;