const SupportConversation = require('../../models/SupportConversation');

const getOrCreateConversation = async (conversationId, customerId, guestId) => {
  // 🔥 FIX: Auto-generate a conversationId if it's missing or undefined
  const activeConvId = conversationId || `conv-${customerId || guestId || Date.now()}`;

  let conversation = await SupportConversation.findOne({ conversationId: activeConvId });
  
  if (!conversation) {
    conversation = await SupportConversation.create({
      conversationId: activeConvId,
      customerId: customerId || null,
      guestId: guestId || null,
      mode: 'AI_ACTIVE',
    });
  }
  return conversation;
};

const updateConversationMode = async (conversationId, mode) => {
  return await SupportConversation.findOneAndUpdate(
    { conversationId },
    { mode, lastMessageAt: Date.now() },
    { new: true }
  );
};

module.exports = { getOrCreateConversation, updateConversationMode };