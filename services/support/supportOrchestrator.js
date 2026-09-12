const conversationService = require('./conversationService');
const messageService = require('./messageService');
const escalationService = require('./escalationService');
const customerContextService = require('./customerContextService');
const aiPlanner = require('../ai/aiPlanner');
const aiResponseService = require('../ai/aiResponseService');
const confidenceService = require('../ai/confidenceService');

// Define Tool Registry
const orderTools = require('../../tools/orderTools');
const shipmentTools = require('../../tools/shipmentTools');
const toolRegistry = {
  getOrderStatus: orderTools.getOrderStatus,
  getShipmentTimeline: shipmentTools.getShipmentTimeline,
};

const handleIncomingMessage = async ({ text, customerId, guestId, conversationId, socket }) => {
  // Get or create conversation, ensuring we extract the valid conversationId
  const conversation = await conversationService.getOrCreateConversation(conversationId, customerId, guestId);
  const activeConversationId = conversation.conversationId;

  // 1. Save Customer Message using the verified conversation ID
  await messageService.saveMessage({
    conversationId: activeConversationId, 
    senderType: 'CUSTOMER', 
    senderId: customerId || guestId, 
    content: text
  });

  // 2. Bypass AI if Human is active
  if (conversation.mode === 'HUMAN_ACTIVE' || conversation.mode === 'WAITING_FOR_AGENT' || conversation.mode === 'ESCALATING') {
    if (socket) socket.to('admin_room').emit('support:message', { conversationId: activeConversationId, text });
    return { success: true, mode: conversation.mode, escalated: true };
  }

  // 3. Build Context & Plan AI response
  const context = await customerContextService.buildCustomerContext(customerId);
  const plan = await aiPlanner.analyzeIntent(text, activeConversationId, context);
  
  if (plan.requiresEscalation) {
    return await escalationService.triggerEscalation(conversation, 'EXPLICIT_REQUEST', socket);
  }

  // 4. Execute Tools
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

  // 5. Confidence check
  if (confidenceService.calculate(plan, toolResults) < 0.8) {
    return await escalationService.triggerEscalation(conversation, 'LOW_AI_CONFIDENCE', socket);
  }

  // 6. Generate Response & Save using verified ID
  const aiResponse = await aiResponseService.generate(text, toolResults, plan.language);
  const savedMsg = await messageService.saveMessage({
    conversationId: activeConversationId, 
    senderType: 'AI', 
    content: aiResponse.text, 
    contentType: aiResponse.type, 
    toolResult: toolResults, 
    language: plan.language
  });

  return { success: true, conversationId: activeConversationId, message: savedMsg, mode: conversation.mode, escalated: false };
};

module.exports = { handleIncomingMessage };