// routes/ticket.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { Ticket, User, Order } = require('../models');
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
  text: z.string().min(1, "Message text cannot be empty").max(1000)
});

const ticketStatusSchema = z.object({
  status: z.enum(['OPEN', 'PENDING', 'RESOLVED', 'CLOSED', 'open']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT', 'Low', 'Medium', 'High', 'Urgent']).optional(),
  assignedAgent: z.string().optional()
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

    const newTicket = new Ticket({
      userId,
      customerId: userId,
      conversationId: `conv_${userId}_${Date.now()}`,
      ticketNumber,
      userName,
      orderId: orderId || '',
      category,
      aiCategory: category,
      priority,
      status: 'OPEN',
      messages: [
        {
          sender: 'user',
          text: `[${subject}] ${message}`,
          timestamp: new Date()
        }
      ]
    });

    const savedTicket = await newTicket.save();

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
// 💬 3. ADD REPLY MESSAGE TO TICKET (IDOR & BOLA PROTECTED)
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

    const senderType = isPrivilegedStaff ? 'admin' : 'user';
    const newMessage = {
      sender: senderType,
      text: validationResult.data.text,
      timestamp: new Date()
    };

    ticket.messages.push(newMessage);
    if (isPrivilegedStaff && ticket.status === 'OPEN') {
      ticket.status = 'PENDING';
    } else if (!isPrivilegedStaff && ticket.status === 'RESOLVED') {
      ticket.status = 'OPEN';
    }

    await ticket.save();

    const io = req.app.get("io");
    if (io) {
      try {
        io.to('support').emit('ticket.message.added', { ticketId: ticket._id, message: newMessage });
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
// 📋 4. GET ALL TICKETS (USER VIEW OR ADMIN/SUPPORT VIEW)
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
    } else if (req.query.userId) {
      query.$or = [
        { userId: req.query.userId },
        { customerId: req.query.userId }
      ];
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
      tickets: tickets.map(t => ({ ...t, id: t._id.toString() }))
    });

  } catch (error) {
    return sendErrorResponse(res, req, error, "Failed to fetch tickets");
  }
});

// ==========================================
// ✏️ 5. UPDATE TICKET STATUS / ASSIGNMENT (ADMIN / SUPPORT ONLY)
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

    const { status, priority, assignedAgent } = validationResult.data;

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: "Support ticket not found", requestId: req.requestId });
    }

    if (status) ticket.status = status;
    if (priority) ticket.priority = priority;
    if (assignedAgent !== undefined) ticket.assignedAgent = assignedAgent;

    if (status === 'RESOLVED' || status === 'CLOSED') {
      ticket.resolvedAt = new Date();
    }

    await ticket.save();

    const io = req.app.get("io");
    if (io) {
      try {
        io.to('support').emit('ticket.status.updated', { ticketId: ticket._id, status: ticket.status });
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