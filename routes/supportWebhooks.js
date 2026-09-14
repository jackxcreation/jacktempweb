const express = require('express');
const router = express.Router();
// 🔥 FIX: Centralized imports to avoid Model initialization errors
const { SupportTicket, SupportConversation, SupportMessage, Order } = require('../models');

// ==========================================
// 🔐 WEBHOOK SECRET VERIFICATION MIDDLEWARE
// ==========================================
const verifyWebhookSecret = (req, res, next) => {
  const secret = req.headers['x-webhook-secret'] || req.headers['authorization'];
  
  if (!process.env.WEBHOOK_SECRET) {
    console.warn("⚠️ WEBHOOK_SECRET is not defined in environment variables!");
  }
  
  if (secret !== process.env.WEBHOOK_SECRET) {
    return res.status(403).json({ error: 'Unauthorized webhook request' });
  }
  next();
};

// ==========================================
// 🚚 1. CARRIER WEBHOOK HANDLER (Delivery Exceptions & RTO)
// ==========================================
router.post('/carrier', verifyWebhookSecret, async (req, res, next) => {
  try {
    const { awb, status, exceptionReason, orderId, customerId, customerName } = req.body;
    const currentStatus = status?.toUpperCase() || '';
    
    // Auto-create an urgent ticket if a shipment is lost, destroyed, delayed, or RTO
    if (['LOST', 'DESTROYED', 'RTO', 'DELAYED'].includes(currentStatus)) {
      
      // 🔥 FIX: Prevent duplicate ticket spamming based on AWB or OrderID
      const existingTicket = await SupportTicket.findOne({
        escalationReason: { $regex: awb, $options: 'i' },
        status: { $nin: ['CLOSED', 'RESOLVED', 'closed', 'resolved'] }
      });

      if (!existingTicket) {
        // 🔥 CRITICAL FIX: Generate IDs so the Frontend Chat UI doesn't crash
        const ticketNum = `TKT-SYS-${Date.now().toString().slice(-6)}`;
        const convId = `conv_sys_${Date.now()}_${awb}`;
        const sysMessageContent = `⚠️ AUTOMATED ALERT: Carrier reported shipment status as ${currentStatus} for AWB: ${awb}. Reason: ${exceptionReason || 'Not provided by carrier'}`;

        // 1. Auto-create the Conversation Room
        await SupportConversation.create({
          conversationId: convId,
          customerId: customerId || null,
          status: 'ACTIVE'
        });

        // 2. Auto-insert the first System Alert Message
        await SupportMessage.create({
          conversationId: convId,
          senderType: 'SYSTEM',
          content: sysMessageContent,
          contentType: 'system_event'
        });

        // 3. Create the actual Ticket mapped to everything
        const ticket = await SupportTicket.create({
          ticketNumber: ticketNum,
          conversationId: convId,
          orderId: orderId || 'UNKNOWN',
          customerId: customerId || null,
          userName: customerName || 'System Generated',
          category: 'SHIPPING',
          aiCategory: 'Shipping',
          priority: 'URGENT', // Push to the top of Admin Dashboard
          status: 'OPEN',
          escalationReason: sysMessageContent,
          messages: [{ sender: 'SYSTEM', text: sysMessageContent }]
        });

        // 🔥 Real-time Broadcast to Admin Dashboard
        const io = req.app.get('io');
        if (io) {
          io.to('admin_room').emit('support:ticket_created', ticket);
          io.emit('ticketUpdated', ticket);
        }
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Carrier Webhook Processing Error:", error);
    next(error);
  }
});

// ==========================================
// 💳 2. 🔥 NEW: PAYMENT GATEWAY WEBHOOK (Standard E-com Integration)
// ==========================================
router.post('/payment', async (req, res, next) => {
  try {
    // Note: Always verify Payment Gateway Signature here (e.g., Razorpay/Stripe crypto verify)
    const { event, payload } = req.body;
    
    // Auto-alert if a user makes a successful payment but system failed to capture it
    if (event === 'payment.failed') {
      console.warn(`[WEBHOOK ALERT] Payment Failed. Payload:`, payload);
      // Optional: You can auto-generate a 'BILLING' Support Ticket here for High-Value abandoned carts
    }

    if (event === 'payment.captured' || event === 'payment.authorized') {
      console.info(`[WEBHOOK ALERT] Payment Successful. Payload:`, payload);
      // Optional: Update Order Status in DB dynamically
    }

    res.status(200).json({ status: 'ok' });
  } catch(error) {
    console.error("Payment Webhook Error:", error);
    next(error);
  }
});

module.exports = router;