const ticketService = require('./ticketService');
const { updateConversationMode } = require('./conversationService');
const SupportEvent = require('../../models/SupportEvent');

const triggerEscalation = async (conversation, reason, io) => {
  if (conversation.escalated || conversation.mode === 'HUMAN_ACTIVE') {
    return { success: true, mode: conversation.mode, escalated: true };
  }

  try {
    // Update Mode
    const updatedConv = await updateConversationMode(conversation.conversationId, 'ESCALATING');
    updatedConv.escalated = true;
    await updatedConv.save();

    // Create Ticket
    const ticket = await ticketService.createTicket({
      conversationId: conversation.conversationId,
      customerId: conversation.customerId,
      orderId: conversation.orderId,
      priority: reason === 'EXPLICIT_REQUEST' ? 'HIGH' : 'MEDIUM',
      escalationReason: reason
    });

    // Log Event
    await SupportEvent.create({
      conversationId: conversation.conversationId,
      ticketId: ticket._id,
      eventType: 'escalation_requested',
      actorId: 'SYSTEM',
      payload: { reason }
    });

    // Notify Admin Dashboard
    if (io) {
      io.to('admin_room').emit('support:ticket_created', ticket);
    }

    return {
      success: true,
      conversationId: conversation.conversationId,
      mode: 'ESCALATING',
      escalated: true,
      message: { text: "I have escalated this to a live agent. They will join shortly.", type: "system" }
    };
  } catch (error) {
    console.error('Escalation Error:', error);
    throw new Error('Failed to escalate conversation');
  }
};

module.exports = { triggerEscalation };