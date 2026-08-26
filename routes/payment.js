const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Razorpay = require('razorpay');
const { Order } = require('../models'); 
const { logger } = require('../utils/logger'); // 🔥 Production Winston Logger

// 🚨 IMPORT AUTH MIDDLEWARE
const { protect } = require('../middleware/authMiddleware');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID, 
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Helper for secure production error responses
const sendErrorResponse = (res, req, error, defaultMessage = "Internal Server Error", statusCode = 500) => {
  logger.error({
    message: defaultMessage,
    requestId: req.requestId,
    error: error.message,
    stack: error.stack,
    route: req.originalUrl
  });

  return res.status(statusCode).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? defaultMessage : error.message,
    requestId: req.requestId
  });
};

// =================================================================
// 1. CREATE PAYMENT ORDER (🔥 CANONICAL PAISE AMOUNT)
// =================================================================
router.post('/payment/create-order', protect, async (req, res) => {
  try {
    const { orderId } = req.body; 

    if (!orderId) return res.status(400).json({ success: false, error: "Order ID is required", requestId: req.requestId });

    const order = await Order.findOne({ _id: orderId, userId: req.user._id });
    
    if (!order) return res.status(404).json({ success: false, error: "Order not found or unauthorized", requestId: req.requestId });
    if (order.status !== 'Pending') return res.status(400).json({ success: false, error: "Order is already paid or processed", requestId: req.requestId });

    // Using canonical totalPaise (fallback to totalAmount * 100 if legacy)
    const finalPaise = order.totalPaise || Math.round(parseFloat(order.totalAmount || 0) * 100); 

    const options = {
      amount: finalPaise, // Already in paise
      currency: "INR",
      receipt: order._id.toString(),
    };

    const rzpOrder = await razorpay.orders.create(options);
    
    order.paymentDetails = { gatewayOrderId: rzpOrder.id };
    await order.save();

    res.json({
      success: true,
      order_id: rzpOrder.id,
      amount: rzpOrder.amount, 
      currency: rzpOrder.currency
    });
  } catch (error) {
    return sendErrorResponse(res, req, error, "Payment initiation failed");
  }
});

// =================================================================
// 2. VERIFY SIGNATURE & RECONCILE (🔥 AUDIT SECURED)
// =================================================================
router.post('/payment/verify', protect, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: "Missing payment signature fields!", requestId: req.requestId });
    }

    // Cryptographic Signature Verification
    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest("hex");

    if (razorpay_signature !== expectedSign) {
      logger.warn({
        message: 'HACK ATTEMPT: Invalid payment signature',
        requestId: req.requestId,
        userId: req.user._id,
        orderId: razorpay_order_id
      });
      return res.status(400).json({ success: false, message: "Payment verification failed. Invalid Signature.", requestId: req.requestId });
    }

    // 🔥 AUDIT REQUIREMENT FIX: Verify gateway order ownership, reconciliation, and amount matching
    const order = await Order.findOne({ "paymentDetails.gatewayOrderId": razorpay_order_id, userId: req.user._id });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order reconciliation failed: Order mapping not found.", requestId: req.requestId });
    }

    // Fetch actual payment details directly from Razorpay gateway API for precise amount & currency reconciliation
    const gatewayPayment = await razorpay.payments.fetch(razorpay_payment_id);
    if (!gatewayPayment || gatewayPayment.status !== 'captured') {
      return res.status(400).json({ success: false, message: "Payment is not captured or verified at gateway.", requestId: req.requestId });
    }

    const expectedPaise = order.totalPaise || Math.round(parseFloat(order.totalAmount || 0) * 100);
    if (gatewayPayment.amount !== expectedPaise || gatewayPayment.currency !== "INR") {
      logger.error({
        message: 'FRAUD ALERT: Amount mismatch during payment verification',
        requestId: req.requestId,
        expectedPaise,
        gatewayAmount: gatewayPayment.amount
      });
      return res.status(400).json({ success: false, message: "Payment reconciliation failed: Amount or Currency mismatch.", requestId: req.requestId });
    }

    // Atomic state transition if not already marked paid
    if (order.status !== 'Paid' && order.status !== 'Processing') {
      order.status = 'Paid';
      order.paymentMethod = 'Razorpay Online';
      order.paymentDetails.gatewayPaymentId = razorpay_payment_id;
      await order.save();
    }

    res.status(200).json({ success: true, message: "Payment verified and reconciled securely" });
  } catch (error) {
    return sendErrorResponse(res, req, error, "Payment verification failed");
  }
});

// =================================================================
// 3. SECURE WEBHOOK (🔥 ATOMIC FINDONEANDUPDATE & IDEMPOTENCY)
// =================================================================
router.post('/payment/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET; 

    if (!signature) return res.status(400).send('Missing Signature');

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(req.body) // req.body is raw buffer correctly preserved
      .digest('hex');

    if (signature !== expectedSignature) {
      logger.error({ message: 'ALERT: Fake Razorpay Webhook Signature Detected!' });
      return res.status(400).send('Invalid signature');
    }

    const payloadBody = JSON.parse(req.body.toString());
    const { event, payload } = payloadBody;

    const eventId = payloadBody.event_id || payload?.payment?.entity?.id + "_" + event;

    if (!payload || !payload.payment || !payload.payment.entity) {
      return res.status(200).send('OK - No Action Required');
    }

    const paymentEntity = payload.payment.entity;
    const razorpay_order_id = paymentEntity.order_id;
    const paymentId = paymentEntity.id;
    const gatewayAmountPaise = paymentEntity.amount;
    const currency = paymentEntity.currency;

    if (event === 'payment.captured' || event === 'order.paid') {
      
      const order = await Order.findOne({ "paymentDetails.gatewayOrderId": razorpay_order_id });
      if (!order) return res.status(404).send('Order not found');

      // 🔥 STRICT IDEMPOTENCY: Check if event or paymentId was already processed to stop duplicate replays
      if (order.paymentDetails?.gatewayPaymentId === paymentId || order.status === 'Paid' || order.status === 'Processing') {
         console.log(`ℹ️ Webhook: Event or Payment ID ${paymentId} already processed. Skipping replay.`);
         return res.status(200).send('OK');
      }

      // Amount Reconciliation against Database Order Total
      const expectedPaise = order.totalPaise || Math.round(parseFloat(order.totalAmount || 0) * 100);
      if (gatewayAmountPaise !== expectedPaise || currency !== "INR") {
        logger.error({ message: `WEBHOOK FRAUD ALERT: Amount mismatch! Expected ${expectedPaise} paise, got ${gatewayAmountPaise}` });
        return res.status(400).send('Amount Reconciliation Failed');
      }

      // 🔥 DATABASE-LEVEL ATOMIC CONDITION TO PREVENT RACE CONDITIONS
      const updatedOrder = await Order.findOneAndUpdate(
        { 
          "paymentDetails.gatewayOrderId": razorpay_order_id, 
          status: 'Pending' // Strictly mutate only when status is Pending
        }, 
        { 
          $set: { 
            status: 'Paid',
            paymentMethod: 'Razorpay Online',
            "paymentDetails.gatewayPaymentId": paymentId,
            "paymentDetails.eventId": eventId,
            updatedAt: new Date()
          } 
        },
        { new: true }
      );

      if (!updatedOrder) {
        console.log(`ℹ️ Webhook: Order ${razorpay_order_id} was already mutated by another worker/request.`);
        return res.status(200).send('OK');
      }
      
      console.log(`✅ Webhook: Order ${razorpay_order_id} successfully reconciled and marked PAID atomically.`);
    }

    res.status(200).send('OK');
  } catch (error) {
    logger.error({ message: 'Webhook processing error', error: error.message, stack: error.stack });
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;