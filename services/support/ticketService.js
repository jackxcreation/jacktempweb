const SupportTicket = require('../../models/SupportTicket');
const slaService = require('./slaService');
const assignmentService = require('./assignmentService');

const createTicket = async (data) => {
  try {
    const sla = slaService.calculateSLA(data.priority || 'MEDIUM');
    
    const ticket = new SupportTicket({
      conversationId: data.conversationId,
      customerId: data.customerId,
      orderId: data.orderId,
      priority: data.priority || 'MEDIUM',
      category: data.category || 'GENERAL',
      escalationReason: data.escalationReason,
      sla
    });

    await ticket.save();

    // Attempt auto-assignment
    await assignmentService.assignTicket(ticket);

    return ticket;
  } catch (error) {
    console.error('Ticket Service Error:', error);
    throw new Error('Failed to create ticket');
  }
};

const updateTicketStatus = async (ticketId, status, agentId = null) => {
  const updateData = { status };
  if (agentId) updateData.assignedAgentId = agentId;
  if (status === 'RESOLVED') updateData.resolvedAt = Date.now();
  if (status === 'CLOSED') updateData.closedAt = Date.now();

  return await SupportTicket.findByIdAndUpdate(ticketId, updateData, { new: true });
};

module.exports = { createTicket, updateTicketStatus };