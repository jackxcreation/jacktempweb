const SupportMessage = require('../../models/SupportMessage');

/**
 * Saves a new support message to the database and optionally broadcasts it via Socket.io.
 */
const saveMessage = async (data, io = null) => {
  if (!data || !data.conversationId || !data.content) {
    throw new Error('conversationId and content are required to save a message.');
  }

  try {
    // 🔥 FIX: Ensure content is safely stored even if passed as an object
    let safeContent = data.content;
    if (typeof safeContent === 'object' && safeContent !== null) {
      safeContent = JSON.stringify(safeContent);
    }

    const msg = await SupportMessage.create({
      messageId: data.messageId || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      conversationId: data.conversationId,
      senderType: data.senderType || 'CUSTOMER',
      senderId: data.senderId || null,
      content: safeContent,
      contentType: data.contentType || 'text',
      language: data.language || 'en',
      isInternal: Boolean(data.isInternal),
      toolResult: data.toolResult || null
    });

    // 🔥 UPGRADE: Real-time Socket Broadcast to the conversation room if io is provided
    if (io && !msg.isInternal) {
      io.to(data.conversationId).emit('support:new_message', msg);
    }

    return msg;
  } catch (error) {
    console.error('Message Service Error:', error);
    throw new Error('Failed to save message');
  }
};

/**
 * 🔥 NEW HELPER: Fetches all messages for a specific conversation
 */
const getConversationMessages = async (conversationId, includeInternal = false) => {
  if (!conversationId) return [];
  try {
    const query = { conversationId };
    if (!includeInternal) {
      query.isInternal = { $ne: true };
    }
    return await SupportMessage.find(query).sort({ createdAt: 1 });
  } catch (error) {
    console.error('Get Conversation Messages Error:', error);
    return [];
  }
};

module.exports = { 
  saveMessage, 
  getConversationMessages 
};