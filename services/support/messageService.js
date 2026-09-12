const SupportMessage = require('../../models/SupportMessage');

const saveMessage = async (data) => {
  try {
    const msg = await SupportMessage.create({
      messageId: data.messageId || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      conversationId: data.conversationId,
      senderType: data.senderType,
      senderId: data.senderId,
      content: data.content,
      contentType: data.contentType || 'text',
      language: data.language || 'en',
      isInternal: data.isInternal || false,
      toolResult: data.toolResult || null
    });
    return msg;
  } catch (error) {
    console.error('Message Service Error:', error);
    throw new Error('Failed to save message');
  }
};

module.exports = { saveMessage };