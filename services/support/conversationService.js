// services/support/conversationService.js
const SupportConversation = require('../../models/SupportConversation');

/**
 * Retrieves an existing conversation or creates a new one.
 * Enhanced to automatically bind customerId if a guest logs in during the chat session,
 * and maintain persistent ticketId continuity (Task #39, #40 & #41).
 */
const getOrCreateConversation = async (conversationId, customerId, guestId, ticketId = null) => {
  try {
    // 🔥 FIX: Auto-generate a conversationId if it's missing or undefined
    const activeConvId = conversationId || `conv-${customerId || guestId || Date.now()}`;

    let conversation = await SupportConversation.findOne({ conversationId: activeConvId });
    
    if (!conversation) {
      conversation = await SupportConversation.create({
        conversationId: activeConvId,
        customerId: customerId && !String(customerId).startsWith('guest_') ? customerId : null,
        guestId: customerId && String(customerId).startsWith('guest_') ? customerId : (guestId || null),
        ticketId: ticketId || null,
        mode: 'AI_ACTIVE',
        lastMessageAt: Date.now(),
        lastCustomerMessageAt: new Date()
      });
    } else {
      // 🔥 UPGRADE: If a guest logs in during an active chat, seamlessly attach the customerId
      let updateFields = {};
      if (customerId && !String(customerId).startsWith('guest_') && (!conversation.customerId || conversation.customerId.toString() !== customerId.toString())) {
        updateFields.customerId = customerId;
      }
      if (guestId && !conversation.guestId && !conversation.customerId) {
        updateFields.guestId = guestId;
      }
      if (ticketId && !conversation.ticketId) {
        updateFields.ticketId = ticketId;
      }
      
      if (Object.keys(updateFields).length > 0) {
        conversation = await SupportConversation.findOneAndUpdate(
          { conversationId: activeConvId },
          { $set: updateFields },
          { new: true }
        );
      }
    }
    return conversation;
  } catch (error) {
    console.error("Get or Create Conversation Error:", error);
    throw error;
  }
};

/**
 * Updates the mode of the conversation (e.g., AI_ACTIVE, HUMAN_HANDOFF, RESOLVED)
 */
const updateConversationMode = async (conversationId, mode) => {
  try {
    return await SupportConversation.findOneAndUpdate(
      { conversationId },
      { mode, lastMessageAt: Date.now() },
      { new: true }
    );
  } catch (error) {
    console.error("Update Conversation Mode Error:", error);
    throw error;
  }
};

/**
 * 🔥 TASK #39: Updates the active ticket reference for a conversation to ensure continuity
 */
const updateConversationTicket = async (conversationId, ticketId) => {
  try {
    return await SupportConversation.findOneAndUpdate(
      { conversationId },
      { ticketId, lastMessageAt: Date.now() },
      { new: true }
    );
  } catch (error) {
    console.error("Update Conversation Ticket Error:", error);
    throw error;
  }
};

/**
 * 🔥 TASK #38 & #41: Deterministic Escalation and Agent Assignment helper with SLA tracking
 */
const escalateConversation = async (conversationId, agentId = null, agentName = null) => {
  try {
    const updateData = {
      mode: 'HUMAN_ACTIVE',
      status: 'ESCALATED',
      escalated: true,
      lastMessageAt: Date.now()
    };
    if (agentId) {
      updateData.assignedAgentId = agentId;
      updateData.assignedAt = new Date(); // 🔥 TASK #41 Assignment timestamp tracking
    }
    if (agentName) {
      updateData.assignedAgentName = agentName;
    }

    return await SupportConversation.findOneAndUpdate(
      { conversationId },
      { $set: updateData },
      { new: true }
    );
  } catch (error) {
    console.error("Escalate Conversation Error:", error);
    throw error;
  }
};

/**
 * 🔥 TASK #41: Assigns or re-assigns an agent directly to a conversation with full tracking fields
 */
const assignAgentToConversation = async (conversationId, agentId, agentName) => {
  try {
    return await SupportConversation.findOneAndUpdate(
      { conversationId },
      { 
        $set: { 
          assignedAgentId: agentId,
          assignedAgentName: agentName,
          assignedAt: new Date(),
          mode: 'HUMAN_ACTIVE',
          status: 'ESCALATED',
          escalated: true,
          lastMessageAt: Date.now()
        } 
      },
      { new: true }
    );
  } catch (error) {
    console.error("Assign Agent To Conversation Error:", error);
    throw error;
  }
};

/**
 * 🔥 TASK #40: Persistently records message activity timestamp & tracks last customer message
 */
const recordMessageActivity = async (conversationId, sender = 'USER') => {
  try {
    const updateFields = { lastMessageAt: Date.now() };
    if (sender.toUpperCase() === 'USER' || sender.toUpperCase() === 'CUSTOMER') {
      updateFields.lastCustomerMessageAt = new Date(); // 🔥 TASK #41 SLA & activity tracking
    }
    return await SupportConversation.findOneAndUpdate(
      { conversationId },
      { $set: updateFields },
      { new: true }
    );
  } catch (error) {
    console.error("Record Message Activity Error:", error);
    return null;
  }
};

/**
 * 🔥 NEW HELPER: Updates the last activity timestamp of a conversation
 */
const touchConversation = async (conversationId) => {
  try {
    return await SupportConversation.findOneAndUpdate(
      { conversationId },
      { lastMessageAt: Date.now() },
      { new: true }
    );
  } catch (error) {
    console.error("Touch Conversation Error:", error);
    return null;
  }
};

module.exports = { 
  getOrCreateConversation, 
  updateConversationMode, 
  updateConversationTicket,
  escalateConversation,
  assignAgentToConversation,
  recordMessageActivity,
  touchConversation 
};