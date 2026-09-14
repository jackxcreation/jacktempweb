const ticketService = require('./ticketService');
const { updateConversationMode } = require('./conversationService');
const SupportEvent = require('../../models/SupportEvent');

// Safely require assignTicket if available for instant live agent routing
let assignTicket = null;
try {
  assignTicket = require('./assignmentService').assignTicket;
} catch (e) {
  // Fallback if path differs
}

const triggerEscalation = async (conversation, reason, io) => {
  if (!conversation) {
    throw new Error('Conversation object is required for escalation.');
  }

  if (conversation.escalated || conversation.mode === 'HUMAN_ACTIVE') {
    return { success: true, mode: conversation.mode, escalated: true };
  }

  try {
    // 1. Update Mode to ESCALATING
    const updatedConv = await updateConversationMode(conversation.conversationId, 'ESCALATING');
    if (updatedConv) {
      updatedConv.escalated = true;
      await updatedConv.save();
    }

    // 2. Create Support Ticket
    const ticket = await ticketService.createTicket({
      conversationId: conversation.conversationId,
      customerId: conversation.customerId || null,
      orderId: conversation.orderId || null,
      priority: reason === 'EXPLICIT_REQUEST' ? 'HIGH' : 'MEDIUM',
      escalationReason: reason
    });

    // 3. 🔥 UPGRADE: Automatically attempt to assign ticket to an online agent
    if (assignTicket && ticket) {
      try {
        await assignTicket(ticket, io);
      } catch (assignErr) {
        console.warn("Auto-assignment during escalation queued for next available agent:", assignErr.message);
      }
    }

    // 4. Log Event in Support Events
    if (ticket) {
      await SupportEvent.create({
        conversationId: conversation.conversationId,
        ticketId: ticket._id,
        eventType: 'escalation_requested',
        actorId: 'SYSTEM',
        payload: { reason }
      });
    }

    // 5. 🔥 FIX: Real-time Socket Notification to Admin Room & Customer Room
    if (io) {
      io.to('admin_room').emit('support:ticket_created', ticket);
      io.emit('ticketUpdated', ticket);
      io.to(conversation.conversationId).emit('escalation_success', {
        mode: 'ESCALATING',
        message: "I have escalated this to a live agent. They will join shortly."
      });
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