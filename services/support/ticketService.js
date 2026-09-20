// services/support/ticketService.js
const mongoose = require('mongoose');
const SupportTicket = require('../../models/SupportTicket');
const Ticket = mongoose.models.Ticket || SupportTicket; // Fallback sync for dual schema support
const slaService = require('./slaService');
const assignmentService = require('./assignmentService');
const socketRoomService = require('../socketRoomService'); // 🔥 TASK #34: Targeted room broadcast service
const { logAuditAction } = require('../auditService'); // 🔥 TASK #69: Comprehensive Audit Trail Service

/**
 * Creates a new support ticket, calculates SLA, and attempts auto-assignment.
 */
const createTicket = async (data, io = null) => {
  try {
    const sla = slaService.calculateSLA(data.priority || 'MEDIUM');
    
    // Generate a unique ticket reference number if not provided by schema
    const ticketNumber = data.ticketNumber || `TK-${Math.floor(100000 + Math.random() * 900000)}`;

    const ticket = new SupportTicket({
      ticketNumber,
      conversationId: data.conversationId || null,
      customerId: data.customerId || null,
      orderId: data.orderId || null,
      priority: data.priority || 'MEDIUM',
      category: data.category || 'GENERAL',
      escalationReason: data.escalationReason || '',
      sla
    });

    await ticket.save();

    // Attempt auto-assignment with socket instance if available
    if (assignmentService && typeof assignmentService.assignTicket === 'function') {
      await assignmentService.assignTicket(ticket, io);
    }

    // 🔥 TASK #34: Targeted Real-time socket broadcast
    if (io) {
      socketRoomService.setIO(io);
      socketRoomService.emitSupportQueueEvent('support:ticket_created', ticket);
      socketRoomService.emitSupportQueueEvent('ticketUpdated', ticket);
      if (ticket.conversationId) {
        socketRoomService.emitToConversation(ticket.conversationId, 'ticketUpdated', ticket);
      }
    }

    return ticket;
  } catch (error) {
    console.error('Ticket Service Error:', error);
    throw new Error('Failed to create ticket');
  }
};

/**
 * Updates an existing ticket's status and handles timestamp logging + Task #69 Audit Trail.
 */
const updateTicketStatus = async (ticketId, status, agentId = null, io = null, req = null) => {
  if (!ticketId || (typeof ticketId === 'string' && !mongoose.Types.ObjectId.isValid(ticketId))) {
    throw new Error('Invalid ticket ID provided.');
  }

  try {
    const existingTicket = await SupportTicket.findById(ticketId);
    if (!existingTicket) {
      throw new Error('Support ticket not found');
    }

    const oldStatus = existingTicket.status;
    const updateData = { status };
    
    if (agentId !== undefined) {
      updateData.assignedAgentId = agentId === 'unassigned' ? null : agentId;
      if (agentId && agentId !== 'unassigned') {
        updateData.assignedAt = new Date(); // 🔥 TASK #41 Assignment timestamp tracking
      }
    }
    if (status === 'RESOLVED') updateData.resolvedAt = Date.now();
    if (status === 'CLOSED') updateData.closedAt = Date.now();

    const ticket = await SupportTicket.findByIdAndUpdate(
      ticketId, 
      updateData, 
      { new: true, runValidators: true }
    ).populate('customerId assignedAgentId', 'name email');

    // 🔥 TASK #69: Comprehensive Support Audit Trail Logging
    if (req && req.user) {
      await logAuditAction(
        req,
        'TICKET_STATUS_CHANGE',
        'TICKET',
        ticket._id,
        `Changed ticket #${ticket.ticketNumber || ticket._id} status from ${oldStatus} to ${status}`,
        { oldStatus, newStatus: status }
      );
    }

    // 🔥 TASK #34: Targeted Real-time socket broadcast
    if (io) {
      socketRoomService.setIO(io);
      socketRoomService.emitSupportQueueEvent('ticketUpdated', ticket);
      if (ticket.conversationId) {
        socketRoomService.emitToConversation(ticket.conversationId, 'ticketUpdated', ticket);
      }
      if (ticket.customerId) {
        socketRoomService.emitToUser(ticket.customerId._id || ticket.customerId, 'ticketUpdated', ticket);
      }
    }

    return ticket;
  } catch (error) {
    console.error('Update Ticket Status Error:', error);
    throw error;
  }
};

/**
 * 🔥 NEW HELPER: Fetches a single ticket with populated user and agent details
 */
const getTicketById = async (ticketId) => {
  if (!ticketId || !mongoose.Types.ObjectId.isValid(ticketId)) return null;
  try {
    return await SupportTicket.findById(ticketId)
      .populate('customerId', 'name email phone')
      .populate('assignedAgentId', 'name email');
  } catch (error) {
    console.error('Get Ticket By ID Error:', error);
    return null;
  }
};

/**
 * 🔥 TASK #39: Fetches a ticket by conversationId for seamless thread & session continuity
 */
const getTicketByConversationId = async (conversationId) => {
  if (!conversationId) return null;
  try {
    return await SupportTicket.findOne({ conversationId })
      .populate('customerId', 'name email phone')
      .populate('assignedAgentId', 'name email');
  } catch (error) {
    console.error('Get Ticket By Conversation ID Error:', error);
    return null;
  }
};

/**
 * 🔥 TASK #38 & #39: Handles deterministic ticket escalation and agent handoff with conversation binding
 */
const escalateTicket = async (ticketId, conversationId, escalationReason, io = null, req = null) => {
  try {
    let ticket = null;
    if (ticketId && mongoose.Types.ObjectId.isValid(ticketId)) {
      ticket = await SupportTicket.findById(ticketId);
    } else if (conversationId) {
      ticket = await SupportTicket.findOne({ conversationId });
    }

    const oldStatus = ticket ? ticket.status : 'NONE';

    if (!ticket && conversationId) {
      ticket = await createTicket({
        conversationId,
        priority: 'HIGH',
        category: 'ESCALATION',
        escalationReason: escalationReason || 'Deterministic policy trigger'
      }, io);
    } else if (ticket) {
      ticket.priority = 'HIGH';
      ticket.escalationReason = escalationReason || ticket.escalationReason;
      ticket.status = 'ESCALATED';
      await ticket.save();
    }

    if (ticket && req && req.user) {
      await logAuditAction(
        req,
        'TICKET_ESCALATED',
        'TICKET',
        ticket._id,
        `Escalated ticket #${ticket.ticketNumber || ticket._id}. Reason: ${escalationReason || 'Policy trigger'}`,
        { oldStatus, newStatus: ticket.status }
      );
    }

    if (ticket && io) {
      socketRoomService.setIO(io);
      socketRoomService.emitSupportQueueEvent('ticketUpdated', ticket);
      if (ticket.conversationId) {
        socketRoomService.emitToConversation(ticket.conversationId, 'ticketUpdated', ticket);
      }
    }

    return ticket;
  } catch (error) {
    console.error('Escalate Ticket Error:', error);
    throw error;
  }
};

/**
 * 🔥 TASK #40: Persistently saves a message to a ticket after human escalation
 */
const addMessageToTicket = async (identifier, sender, text, io = null, req = null) => {
  try {
    let ticket = null;
    if (mongoose.Types.ObjectId.isValid(identifier)) {
      ticket = await SupportTicket.findById(identifier);
    } else {
      ticket = await SupportTicket.findOne({ conversationId: identifier });
    }

    if (!ticket) {
      throw new Error('Support ticket not found for message persistence.');
    }

    await ticket.addMessage(sender, text);

    // 🔥 TASK #69: Audit log message addition
    if (req && req.user) {
      await logAuditAction(
        req,
        'AGENT_MESSAGE_ADDED',
        'TICKET',
        ticket._id,
        `Agent added reply: "${text.substring(0, 50)}..."`
      );
    }

    if (io) {
      socketRoomService.setIO(io);
      socketRoomService.emitSupportQueueEvent('ticketUpdated', ticket);
      if (ticket.conversationId) {
        socketRoomService.emitToConversation(ticket.conversationId, 'ticketUpdated', ticket);
      }
    }

    return ticket;
  } catch (error) {
    console.error('Add Message To Ticket Error:', error);
    throw error;
  }
};

/**
 * 🔥 TASK #68: Securely saves an internal staff note (Strictly isolated from customer view)
 */
const addInternalNoteToTicket = async (ticketId, agentId, agentName, text, req = null) => {
  if (!ticketId || !mongoose.Types.ObjectId.isValid(ticketId)) {
    throw new Error('Valid Ticket ID required for adding internal notes.');
  }

  try {
    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) {
      throw new Error('Support ticket not found.');
    }

    if (typeof ticket.addInternalNote === 'function') {
      await ticket.addInternalNote(agentId, agentName, text);
    } else {
      ticket.internalNotes = ticket.internalNotes || [];
      ticket.internalNotes.push({ agentId, agentName, text, timestamp: new Date() });
      await ticket.save();
    }

    // 🔥 TASK #69: Audit log internal note creation
    if (req && req.user) {
      await logAuditAction(
        req,
        'INTERNAL_NOTE_ADDED',
        'TICKET',
        ticket._id,
        `Internal staff note added by ${agentName}`
      );
    }

    return ticket;
  } catch (error) {
    console.error('Add Internal Note Error:', error);
    throw error;
  }
};

/**
 * 🔥 TASK #41: Advanced Ticket Assignment System with Agent ID, Timestamp, and SLA sync
 */
const assignTicketToAgent = async (ticketId, agentId, agentName, io = null, req = null) => {
  if (!ticketId || !mongoose.Types.ObjectId.isValid(ticketId)) {
    throw new Error('Valid Ticket ID required for assignment.');
  }

  try {
    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) {
      throw new Error('Support ticket not found.');
    }

    const previousAgent = ticket.assignedAgent || 'Unassigned';
    ticket.assignedAgentId = agentId ? mongoose.Types.ObjectId(agentId) : null;
    ticket.assignedAgent = agentName || 'Assigned Support Agent';
    ticket.assignedAt = agentId ? new Date() : null;
    ticket.status = 'IN_PROGRESS';
    
    await ticket.save();

    // 🔥 TASK #69: Audit log assignment change
    if (req && req.user) {
      await logAuditAction(
        req,
        'TICKET_ASSIGNED',
        'TICKET',
        ticket._id,
        `Assigned ticket to agent ${agentName} (Previously: ${previousAgent})`,
        { metadata: { assignedAgentId: agentId, agentName } }
      );
    }

    if (io) {
      socketRoomService.setIO(io);
      socketRoomService.emitSupportQueueEvent('ticketUpdated', ticket);
      if (ticket.conversationId) {
        socketRoomService.emitToConversation(ticket.conversationId, 'ticketUpdated', ticket);
      }
    }

    return ticket;
  } catch (error) {
    console.error('Assign Ticket To Agent Error:', error);
    throw error;
  }
};

/**
 * 🔥 TASK #33: Verifies if a ticket or conversation exists and whether the user has admin/support privileges to reply.
 */
const verifyTicketAccess = async (ticketId, conversationId, user) => {
  if (!user || !user.isPrivileged) {
    return { success: false, message: 'Access Denied: Privileged staff permissions required to reply.' };
  }

  let ticket = null;
  if (ticketId && mongoose.Types.ObjectId.isValid(ticketId)) {
    ticket = await Ticket.findById(ticketId) || await SupportTicket.findById(ticketId);
  } else if (conversationId) {
    ticket = await Ticket.findOne({ conversationId }) || await SupportTicket.findOne({ conversationId });
  }

  if (!ticket) {
    return { success: false, message: 'Target ticket or support conversation not found.' };
  }

  return { success: true, ticket };
};

module.exports = { 
  createTicket, 
  updateTicketStatus, 
  getTicketById,
  getTicketByConversationId,
  escalateTicket,
  addMessageToTicket,
  addInternalNoteToTicket, // 🔥 TASK #68 exported
  assignTicketToAgent,
  verifyTicketAccess 
};