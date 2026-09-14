const mongoose = require('mongoose');
const SupportTicket = require('../../models/SupportTicket');
const slaService = require('./slaService');
const assignmentService = require('./assignmentService');

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

    // 🔥 UPGRADE: Real-time socket broadcast for admin dashboard
    if (io) {
      io.to('admin_room').emit('support:ticket_created', ticket);
      io.emit('ticketUpdated', ticket);
    }

    return ticket;
  } catch (error) {
    console.error('Ticket Service Error:', error);
    throw new Error('Failed to create ticket');
  }
};

/**
 * Updates an existing ticket's status and handles timestamp logging.
 */
const updateTicketStatus = async (ticketId, status, agentId = null, io = null) => {
  if (!ticketId || (typeof ticketId === 'string' && !mongoose.Types.ObjectId.isValid(ticketId))) {
    throw new Error('Invalid ticket ID provided.');
  }

  try {
    const updateData = { status };
    if (agentId !== undefined) {
      updateData.assignedAgentId = agentId === 'unassigned' ? null : agentId;
    }
    if (status === 'RESOLVED') updateData.resolvedAt = Date.now();
    if (status === 'CLOSED') updateData.closedAt = Date.now();

    const ticket = await SupportTicket.findByIdAndUpdate(
      ticketId, 
      updateData, 
      { new: true, runValidators: true }
    ).populate('customerId assignedAgentId', 'name email');

    if (!ticket) {
      throw new Error('Support ticket not found');
    }

    // 🔥 UPGRADE: Real-time socket broadcast for ticket updates
    if (io) {
      io.to('admin_room').emit('ticketUpdated', ticket);
      io.emit('ticketUpdated', ticket);
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

module.exports = { 
  createTicket, 
  updateTicketStatus, 
  getTicketById 
};