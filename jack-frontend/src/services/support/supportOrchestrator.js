const SupportConversation = require('../../models/SupportConversation');
const SupportMessage = require('../../models/SupportMessage');
const escalationService = require('./escalationService');
const aiPlanner = require('../ai/aiPlanner');
const aiResponseService = require('../ai/aiResponseService');
const confidenceService = require('../ai/confidenceService');

// Tool Registry Mapping
const orderTools = require('../../tools/orderTools');
const shipmentTools = require('../../tools/shipmentTools');
const toolRegistry = {
  getOrderStatus: orderTools.getOrderStatus,
  getShipmentTimeline: shipmentTools.getShipmentTimeline,
};

const handleIncomingMessage = async ({ text, customerId, guestId, conversationId, socket }) => {
  let conversation = await SupportConversation.findOne({ conversationId });
  
  if (!conversation) {
    conversation = await SupportConversation.create({
      conversationId,
      customerId,
      guestId,
      mode: 'AI_ACTIVE',
    });
  }

  // 1. Save Customer Message
  await SupportMessage.create({
    conversationId,
    senderType: 'CUSTOMER',
    senderId: customerId || guestId,
    content: text,
    contentType: 'text'
  });

  // 2. Route based on Conversation Mode
  if (conversation.mode === 'HUMAN_ACTIVE' || conversation.mode === 'WAITING_FOR_AGENT') {
    // Notify admin dashboard silently, AI does not respond directly
    if (socket) socket.to('admin_room').emit('support:message', { conversationId, text });
    return { success: true, mode: conversation.mode, escalated: true };
  }

  // 3. AI Intent & Tool Planning
  const plan = await aiPlanner.analyzeIntent(text, conversationId);
  
  if (plan.requiresEscalation || text.toLowerCase().includes('human') || text.toLowerCase().includes('agent')) {
    return await escalationService.triggerEscalation(conversation, 'EXPLICIT_REQUEST', socket);
  }

  // 4. Execute Verified Tools (Source of Truth)
  const toolResults = {};
  if (plan.tools && plan.tools.length > 0) {
    for (const tool of plan.tools) {
      if (toolRegistry[tool.name]) {
        try {
          toolResults[tool.name] = await toolRegistry[tool.name](tool.args, customerId);
        } catch (err) {
          toolResults[tool.name] = { error: 'Data unavailable' };
        }
      }
    }
  }

  // 5. Confidence Check
  const confidence = confidenceService.calculate(plan, toolResults);
  if (confidence < 0.8) {
    return await escalationService.triggerEscalation(conversation, 'LOW_AI_CONFIDENCE', socket);
  }

  // 6. Generate Natural Language Response
  const aiResponse = await aiResponseService.generate(text, toolResults, plan.language);

  // 7. Save and Return AI Message
  const savedMsg = await SupportMessage.create({
    conversationId,
    senderType: 'AI',
    content: aiResponse.text,
    contentType: aiResponse.type,
    toolResult: toolResults,
    language: plan.language
  });

  return {
    success: true,
    conversationId,
    message: savedMsg,
    mode: conversation.mode,
    escalated: false
  };
};

module.exports = { handleIncomingMessage };