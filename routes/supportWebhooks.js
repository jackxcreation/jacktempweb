const express = require('express');
const router = express.Router();
const SupportTicket = require('../models/SupportTicket');
const SupportConversation = require('../models/SupportConversation');

// Verify external webhooks (e.g., Courier update triggering ticket updates)
const verifyWebhookSecret = (req, res, next) => {
  const secret = req.headers['x-webhook-secret'];
  if (secret !== process.env.WEBHOOK_SECRET) {
    return res.status(403).json({ error: 'Unauthorized webhook request' });
  }
  next();
};

// Handle Carrier Updates (e.g., Delivery Exception auto-escalation)
router.post('/carrier', verifyWebhookSecret, async (req, res, next) => {
  try {
    const { awb, status, exceptionReason, orderId } = req.body;
    
    // Auto-create an urgent ticket if a shipment is lost or destroyed
    if (['LOST', 'DESTROYED', 'RTO'].includes(status)) {
      const ticket = await SupportTicket.create({
        orderId,
        category: 'SHIPPING',
        priority: 'URGENT',
        status: 'OPEN',
        escalationReason: `Carrier reported: ${exceptionReason || status} for AWB ${awb}`,
      });

      const io = req.app.get('io');
      if (io) {
        io.to('admin_room').emit('support:ticket_created', ticket);
      }
    }
    res.status(200).json({ received: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;