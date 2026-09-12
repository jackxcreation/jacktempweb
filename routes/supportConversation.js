const express = require('express');
const router = express.Router();
const SupportConversation = require('../models/SupportConversation');
const SupportMessage = require('../models/SupportMessage');
const { protect } = require('../middleware/authMiddleware');

// Get conversation history (Customer facing)
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const customerId = req.user ? req.user._id : null;
    const guestId = req.query.guestId;

    const query = { conversationId: id };
    if (customerId) query.customerId = customerId;
    else if (guestId) query.guestId = guestId;

    const conversation = await SupportConversation.findOne(query);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found or unauthorized' });
    }

    // Filter out internal admin notes from customer view
    const messages = await SupportMessage.find({ 
      conversationId: id,
      isInternal: { $ne: true } 
    }).sort({ createdAt: 1 });

    res.status(200).json({ conversation, messages });
  } catch (error) {
    next(error);
  }
});

// Resolve a conversation
router.post('/:id/resolve', async (req, res, next) => {
  try {
    const conversation = await SupportConversation.findOneAndUpdate(
      { conversationId: req.params.id },
      { mode: 'RESOLVED', status: 'resolved' },
      { new: true }
    );
    
    if (!conversation) return res.status(404).json({ error: 'Not found' });

    const io = req.app.get('io');
    if (io) {
      io.to(req.params.id).emit('ticket_resolved');
    }

    res.status(200).json(conversation);
  } catch (error) {
    next(error);
  }
});

module.exports = router;