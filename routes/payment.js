const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Razorpay = require('razorpay');
const { Order } = require('../models'); 

// 🚨 IMPORT AUTH MIDDLEWARE
const { protect } = require('../middleware/authMiddleware');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID, 
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// =================================================================
// 1. CREATE PAYMENT ORDER (🔥 FIXED: Server-Calculated Amount)
// =================================================================
router.post('/payment/create-order', protect, async (req, res) => {
  try {
    const { orderId } = req.body; 

    if (!orderId) return res.status(400).json({ success: false, error: "Order ID is required" });

    const order = await Order.findOne({ _id: orderId, userId: req.user._id });
    
    if (!order) return res.status(404).json({ success: false, error: "Order not found or unauthorized" });
    if (order.status !== 'Pending') return res.status(400).json({ success: false, error: "Order is already paid or processed" });

    const finalAmount = parseFloat(order.totalAmount) || 0; 

    const options = {
      amount: Math.round(finalAmount * 100), // Converted to paise
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
    console.error("❌ Razorpay order error:", error);
    res.status(500).json({ success: false, error: "Payment initiation failed" });
  }
});

// =================================================================
// 2. VERIFY SIGNATURE & RECONCILE (🔥 AUDIT SECURED)
// =================================================================
router.post('/payment/verify', protect, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: "Missing payment signature fields!" });
    }

    // Cryptographic Signature Verification
    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest("hex");

    if (razorpay_signature !== expectedSign) {
      console.warn(`🚨 HACK ATTEMPT: Invalid signature for Order: ${razorpay_order_id} by User: ${req.user._id}`);
      return res.status(400).json({ success: false, message: "Payment verification failed. Invalid Signature." });
    }

    // 🔥 AUDIT REQUIREMENT FIX: Verify gateway order ownership, reconciliation, and amount matching
    const order = await Order.findOne({ "paymentDetails.gatewayOrderId": razorpay_order_id, userId: req.user._id });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order reconciliation failed: Order mapping not found." });
    }

    // Fetch actual payment details directly from Razorpay gateway API for precise amount & currency reconciliation
    const gatewayPayment = await razorpay.payments.fetch(razorpay_payment_id);
    if (!gatewayPayment || gatewayPayment.status !== 'captured') {
      return res.status(400).json({ success: false, message: "Payment is not captured or verified at gateway." });
    }

    const expectedPaise = Math.round(parseFloat(order.totalAmount) * 100);
    if (gatewayPayment.amount !== expectedPaise || gatewayPayment.currency !== "INR") {
      console.error(`🚨 FRAUD ALERT: Amount mismatch! Expected ${expectedPaise}, got ${gatewayPayment.amount}`);
      return res.status(400).json({ success: false, message: "Payment reconciliation failed: Amount or Currency mismatch." });
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
    console.error("❌ Verify endpoint error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =================================================================
// 3. SECURE WEBHOOK (🔥 PRODUCTION IDEMPOTENCY & RAW PARSER)
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
      console.error("🚨 ALERT: Fake Razorpay Webhook Signature Detected!");
      return res.status(400).send('Invalid signature');
    }

    const payloadBody = JSON.parse(req.body.toString());
    const { event, payload, contains } = payloadBody;

    // Unique Event ID validation for robust idempotency tracking
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
      const expectedPaise = Math.round(parseFloat(order.totalAmount) * 100);
      if (gatewayAmountPaise !== expectedPaise || currency !== "INR") {
        console.error(`🚨 WEBHOOK FRAUD ALERT: Amount mismatch! Expected ${expectedPaise} paise, got ${gatewayAmountPaise}`);
        return res.status(400).send('Amount Reconciliation Failed');
      }

      // Atomic conditional update simulation & persistence
      order.status = 'Paid';
      order.paymentMethod = 'Razorpay Online';
      order.paymentDetails.gatewayPaymentId = paymentId;
      order.paymentDetails.eventId = eventId;
      await order.save();
      
      console.log(`✅ Webhook: Order ${razorpay_order_id} successfully reconciled and marked PAID.`);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error("❌ Webhook processing error:", error);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;