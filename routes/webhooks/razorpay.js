// routes/webhooks/razorpay.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { PaymentEvent, Order, PaymentIntent } = require('../../models');
const { logger } = require('../../utils/logger');

/**
 * @route   POST /api/webhooks/razorpay
 * @desc    Secure Razorpay Webhook listener with signature verification and event idempotency
 * @access  Public (Secured by HMAC SHA256 Webhook Signature)
 */
router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  const webhookSignature = req.headers['x-razorpay-signature'];
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    logger.error("🚨 CRITICAL: RAZORPAY_WEBHOOK_SECRET is not configured in environment variables!");
    return res.status(500).json({ success: false, message: 'Webhook configuration error' });
  }

  try {
    // 1. Verify HMAC SHA256 Signature
    const rawBody = req.body; // Buffer from express.raw()
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(webhookSignature || ''), Buffer.from(expectedSignature))) {
      logger.warn("🚨 SECURITY AUDIT: Invalid Razorpay webhook signature detected!");
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    const event = JSON.parse(rawBody.toString('utf8'));
    const eventId = event.payload?.payment?.entity?.id || event.event_id || `evt_${Date.now()}_${Math.random()}`;

    // 2. IDEMPOTENCY CHECK: Ensure event has not been processed already
    const existingEvent = await PaymentEvent.findOne({ eventId });
    if (existingEvent) {
      logger.info(`ℹ️ Idempotent Webhook Replay: Event ${eventId} already processed.`);
      return res.status(200).json({ success: true, message: 'Event already processed (Idempotent)' });
    }

    // 3. Process Event based on type
    const eventType = event.event;
    logger.info(`🔔 Razorpay Webhook Received: [${eventType}] - Event ID: ${eventId}`);

    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      const paymentEntity = event.payload?.payment?.entity || {};
      const gatewayOrderId = paymentEntity.order_id;

      if (gatewayOrderId) {
        const paymentIntent = await PaymentIntent.findOne({ gatewayOrderId });
        if (paymentIntent && paymentIntent.status !== 'PAID') {
          paymentIntent.status = 'PAID';
          await paymentIntent.save();

          if (paymentIntent.orderId) {
            await Order.findByIdAndUpdate(paymentIntent.orderId, {
              status: 'Paid',
              'paymentDetails.gatewayPaymentId': paymentEntity.id
            });
            logger.info(`✅ Order #${paymentIntent.orderId} marked as Paid via Webhook.`);
          }
        }
      }
    }

    // 4. Record Event to prevent future duplicates
    await PaymentEvent.create({
      eventId,
      eventType,
      payload: event,
      status: 'PROCESSED'
    });

    return res.status(200).json({ success: true, message: 'Webhook processed successfully' });
  } catch (error) {
    logger.error({ message: "Webhook Processing Error", error: error.message, stack: error.stack });
    return res.status(500).json({ success: false, message: 'Webhook handler failed' });
  }
});

module.exports = router;