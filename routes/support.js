const express = require('express');
const router = express.Router();
const { handleIncomingMessage } = require('../services/support/supportOrchestrator');
const escalationService = require('../services/support/escalationService');
const SupportConversation = require('../models/SupportConversation');

// Main customer chat endpoint (handles both Guest and Logged-in users)
router.post('/message', async (req, res, next) => {
  try {
    let { message, conversationId, guestId, languageStyle } = req.body;
    const customerId = req.user ? req.user._id : null;

    // 🔥 FIX: Auto-generate a guestId if neither customerId nor guestId is provided
    if (!customerId && !guestId) {
      guestId = `guest_${Math.random().toString(36).substring(2, 10)}`;
    }

    if (!message) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const io = req.app.get('io');
    const result = await handleIncomingMessage({
      text: message,
      customerId,
      guestId,
      conversationId,
      socket: io
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// Explicit manual escalation endpoint
router.post('/escalate', async (req, res, next) => {
  try {
    const { conversationId } = req.body;
    const io = req.app.get('io');
    
    const conversation = await SupportConversation.findOne({ conversationId });
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    const result = await escalationService.triggerEscalation(conversation, 'EXPLICIT_REQUEST', io);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;