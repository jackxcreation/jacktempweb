// services/support/agentService.js
const mongoose = require('mongoose');
const SupportTicket = require('../../models/SupportTicket');
const SupportConversation = require('../../models/SupportConversation');
const SupportAgent = require('../../models/SupportAgent');
const User = mongoose.models.User || require('../../models/User');
const socketRoomService = require('../socketRoomService'); // 🔥 TASK #34: Targeted room broadcast service

/**
 * 🔥 TASK #41: Finds and assigns the optimal available support agent based on workload and SLA priority.
 */
const assignOptimalAgent = async (ticket, io = null) => {
  try {
    // 1. Try to find an active available agent with the lowest current active ticket load
    let agent = null;
    try {
      agent = await SupportAgent.findOne({ status: 'AVAILABLE' }).sort({ activeTicketsCount: 1 });
    } catch (e) {
      // Fallback if SupportAgent model collection doesn't exist yet
    }
    
    if (!agent) {
      // Fallback to finding a user with support/admin role
      agent = await User.findOne({ 
        role: { $in: ['admin', 'super_admin', 'support', 'customer_support', 'operations_manager', 'manager'] },
        isLocked: { $ne: true }
      });
    }

    if (agent) {
      const agentId = agent._id || agent.id;
      const agentName = agent.name || agent.email || 'Support Agent';

      ticket.assignedAgentId = agentId;
      ticket.assignedAgent = agentName;
      ticket.assignedAt = new Date(); // 🔥 TASK #41 Assignment timestamp tracking
      ticket.status = ticket.status === 'OPEN' ? 'IN_PROGRESS' : ticket.status;
      await ticket.save();

      // Sync SupportConversation mirror if conversationId exists
      if (ticket.conversationId) {
        await SupportConversation.findOneAndUpdate(
          { conversationId: ticket.conversationId },
          { 
            $set: { 
              assignedAgentId: agentId,
              assignedAgentName: agentName,
              assignedAt: new Date(),
              mode: 'HUMAN_ACTIVE',
              status: 'ESCALATED',
              escalated: true
            } 
          }
        );
      }

      if (io) {
        socketRoomService.setIO(io);
        socketRoomService.emitSupportQueueEvent('ticketUpdated', ticket);
        if (ticket.conversationId) {
          socketRoomService.emitToConversation(ticket.conversationId, 'ticketUpdated', ticket);
        }
      }

      return agent;
    }

    return null;
  } catch (error) {
    console.error('Assign Optimal Agent Error:', error);
    return null;
  }
};

/**
 * 🔥 TASK #40 & #41: Persistently saves and routes agent messages to both the ticket and conversation.
 */
const handleAgentMessage = async ({ ticketId, conversationId, agentId, agentName, text }, io = null) => {
  try {
    let ticket = null;
    if (ticketId && mongoose.Types.ObjectId.isValid(ticketId)) {
      ticket = await SupportTicket.findById(ticketId);
    } else if (conversationId) {
      ticket = await SupportTicket.findOne({ conversationId });
    }

    if (!ticket) {
      throw new Error('Support ticket not found for agent message persistence.');
    }

    // 1. Persistently push message to ticket history (Task #40)
    await ticket.addMessage('ADMIN', text);

    // 2. Ensure ticket has assigned agent metadata updated (Task #41)
    if (agentId && (!ticket.assignedAgentId || ticket.assignedAgentId.toString() !== agentId.toString())) {
      ticket.assignedAgentId = agentId;
      ticket.assignedAgent = agentName || 'Support Agent';
      ticket.assignedAt = new Date();
      await ticket.save();
    }

    // 3. Sync persistent conversation state
    if (ticket.conversationId) {
      await SupportConversation.findOneAndUpdate(
        { conversationId: ticket.conversationId },
        { 
          $set: { 
            lastMessageAt: Date.now(),
            mode: 'HUMAN_ACTIVE',
            status: 'ESCALATED'
          } 
        }
      );
    }

    // 4. Targeted real-time broadcast via socket rooms (Task #34 & #40)
    if (io) {
      socketRoomService.setIO(io);
      const messagePayload = {
        id: `msg-${Date.now()}`,
        sender: 'admin',
        text: text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      if (ticket.conversationId) {
        socketRoomService.emitToConversation(ticket.conversationId, 'receive_admin_reply', messagePayload);
      }
      if (ticket.customerId) {
        socketRoomService.emitToUser(ticket.customerId, 'receive_admin_reply', messagePayload);
      }
      socketRoomService.emitSupportQueueEvent('ticketUpdated', ticket);
    }

    return ticket;
  } catch (error) {
    console.error('Handle Agent Message Error:', error);
    throw error;
  }
};

module.exports = {
  assignOptimalAgent,
  handleAgentMessage
};