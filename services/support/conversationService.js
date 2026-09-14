const SupportConversation = require('../../models/SupportConversation');

/**
 * Retrieves an existing conversation or creates a new one.
 * Enhanced to automatically bind customerId if a guest logs in during the chat session.
 */
const getOrCreateConversation = async (conversationId, customerId, guestId) => {
  try {
    // 🔥 FIX: Auto-generate a conversationId if it's missing or undefined
    const activeConvId = conversationId || `conv-${customerId || guestId || Date.now()}`;

    let conversation = await SupportConversation.findOne({ conversationId: activeConvId });
    
    if (!conversation) {
      conversation = await SupportConversation.create({
        conversationId: activeConvId,
        customerId: customerId || null,
        guestId: guestId || null,
        mode: 'AI_ACTIVE',
        lastMessageAt: Date.now()
      });
    } else {
      // 🔥 UPGRADE: If a guest logs in during an active chat, seamlessly attach the customerId
      let updateFields = {};
      if (customerId && !conversation.customerId) {
        updateFields.customerId = customerId;
      }
      if (guestId && !conversation.guestId && !conversation.customerId) {
        updateFields.guestId = guestId;
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
  touchConversation 
};