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
  const cleanText = String(text || '').trim();
  if (!cleanText) {
    return { success: false, error: 'Message text cannot be empty' };
  }

  let conversation = await SupportConversation.findOne({ conversationId });
  
  if (!conversation) {
    conversation = await SupportConversation.create({
      conversationId,
      customerId: customerId || null,
      guestId: guestId || null,
      mode: 'AI_ACTIVE',
      status: 'ACTIVE'
    });
  } else {
    // 🔥 UPGRADE 1: Auto-Reopen Logic 
    // If user replies to a closed/resolved ticket, reset it to AI handling
    if (conversation.status === 'RESOLVED' || conversation.status === 'CLOSED') {
      conversation.status = 'ACTIVE';
      conversation.mode = 'AI_ACTIVE';
      conversation.escalated = false;
    }
    conversation.lastMessageAt = Date.now();
    await conversation.save();
  }

  // 🔥 UPGRADE 2: Use Schema's built-in default for messageId if we don't supply it
  const savedCustomerMsg = await SupportMessage.create({
    conversationId,
    senderType: 'CUSTOMER',
    senderId: customerId || guestId || 'guest_user',
    content: cleanText,
    contentType: 'text'
  });

  // Broadcast customer message via socket if available
  if (socket) {
    socket.to(conversationId).emit('receive_message', savedCustomerMsg);
    // Also push to Admin Dashboard so agents see live typing
    socket.to('admin_room').emit('support:message', { conversationId, message: savedCustomerMsg });
  }

  // Route based on Conversation Mode
  if (conversation.mode === 'HUMAN_ACTIVE' || conversation.mode === 'WAITING_FOR_AGENT') {
    return { success: true, mode: conversation.mode, escalated: true, message: savedCustomerMsg };
  }

  // 🔥 UPGRADE 3: AI Safety Boundary (Try-Catch to prevent server crashes if Gemini is down)
  try {
    // AI Intent & Tool Planning
    const plan = await aiPlanner.analyzeIntent(cleanText, conversationId);
    
    if (plan.requiresEscalation || cleanText.toLowerCase().match(/\b(human|agent|support|help|real person)\b/)) {
      return await escalationService.triggerEscalation(conversation, 'EXPLICIT_REQUEST', socket);
    }

    // Execute Verified Tools (Source of Truth)
    const toolResults = {};
    if (plan.tools && plan.tools.length > 0) {
      for (const tool of plan.tools) {
        if (toolRegistry[tool.name]) {
          try {
            toolResults[tool.name] = await toolRegistry[tool.name](tool.args, customerId);
          } catch (err) {
            console.warn(`Tool execution failed for ${tool.name}:`, err.message);
            toolResults[tool.name] = { error: 'Data currently unavailable' };
          }
        }
      }
    }

    // Confidence Check
    const confidence = confidenceService.calculate(plan, toolResults);
    if (confidence < 0.8) {
      return await escalationService.triggerEscalation(conversation, 'LOW_AI_CONFIDENCE', socket);
    }

    // Generate Natural Language Response
    const aiResponse = await aiResponseService.generate(cleanText, toolResults, plan.language || 'en');

    // 🔥 UPGRADE 4: Corrected Schema Mapping (Moved toolResult and language inside metadata)
    const savedMsg = await SupportMessage.create({
      conversationId,
      senderType: 'AI',
      senderId: 'ai_bot', // Safe fallback string
      content: aiResponse.text || "I'm here to assist you!",
      contentType: aiResponse.type || 'text',
      metadata: {
        toolResults: toolResults,
        language: plan.language || 'en',
        confidenceScore: confidence
      }
    });

    // Broadcast AI response via socket
    if (socket) {
      socket.emit('receive_message', savedMsg); // To the sender
      socket.to(conversationId).emit('receive_message', savedMsg); // To anyone else in the room
      socket.to('admin_room').emit('support:message', { conversationId, message: savedMsg });
    }

    return {
      success: true,
      conversationId,
      message: savedMsg,
      mode: conversation.mode,
      escalated: false
    };

  } catch (error) {
    console.error("AI Orchestrator Error:", error);
    // Silent Fallback: If AI fails entirely, push the ticket to a human instead of failing
    return await escalationService.triggerEscalation(conversation, 'AI_SYSTEM_ERROR', socket);
  }
};

module.exports = { handleIncomingMessage };