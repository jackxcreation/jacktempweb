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
    const { orderId } = req.body; // Frontend sirf internal Order ID bhejega, amount NAHI.

    if (!orderId) return res.status(400).json({ success: false, error: "Order ID is required" });

    // 🔥 SECURITY: Database se order fetch karo aur TRUE amount nikalo
    const order = await Order.findOne({ _id: orderId, userId: req.user._id });
    
    if (!order) return res.status(404).json({ success: false, error: "Order not found or unauthorized" });
    if (order.status !== 'Pending') return res.status(400).json({ success: false, error: "Order is already paid or processed" });

    const finalAmount = order.totalAmount; // DB se real price

    const options = {
      amount: Math.round(finalAmount * 100), // Paise mein convert kiya
      currency: "INR",
      receipt: order._id.toString(),
    };

    const rzpOrder = await razorpay.orders.create(options);
    
    // Save gateway order ID to our DB for cross-checking later
    order.paymentDetails = { gatewayOrderId: rzpOrder.id };
    await order.save();

    res.json({
      success: true,
      order_id: rzpOrder.id,
      amount: rzpOrder.amount, // Real amount sent to frontend
      currency: rzpOrder.currency
    });
  } catch (error) {
    console.error("❌ Razorpay order error:", error);
    res.status(500).json({ success: false, error: "Payment initiation failed" });
  }
});

// =================================================================
// 2. VERIFY SIGNATURE (Frontend Callback)
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

    res.status(200).json({ success: true, message: "Payment verified securely" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =================================================================
// 3. SECURE WEBHOOK (🔥 FIXED: Idempotency & Raw Body)
// =================================================================
// NOTE: Is route ke liye express.raw() use karna padega. (Check instructions below)
router.post('/payment/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET; 

    if (!signature) return res.status(400).send('Missing Signature');

    // 🔥 SECURITY: Use raw body buffer directly to prevent JSON spacing errors
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(req.body) // req.body is now a raw buffer
      .digest('hex');

    if (signature !== expectedSignature) {
      console.error("🚨 ALERT: Fake Razorpay Webhook Signature Detected!");
      return res.status(400).send('Invalid signature');
    }

    // Ab raw buffer ko safely parse karo
    const payloadBody = JSON.parse(req.body.toString());
    const { event, payload } = payloadBody;

    if (!payload || !payload.payment || !payload.payment.entity) {
      return res.status(200).send('OK - No Action Required');
    }

    const razorpay_order_id = payload.payment.entity.order_id;

    if (event === 'payment.captured' || event === 'order.paid') {
      
      const order = await Order.findOne({ "paymentDetails.gatewayOrderId": razorpay_order_id });
      if (!order) return res.status(404).send('Order not found');

      // 🔥 IDEMPOTENCY LOCK: Agar order pehle hi paid hai, toh wapas process mat karo (Double-spending fix)
      if (order.status === 'Paid' || order.status === 'Processing') {
         console.log(`ℹ️ Webhook: Order ${razorpay_order_id} already marked as Paid. Skipping.`);
         return res.status(200).send('OK');
      }

      order.status = 'Paid';
      order.paymentMethod = 'Razorpay Online';
      await order.save();
      
      console.log(`✅ Webhook: Order ${razorpay_order_id} strictly marked as PAID.`);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error("❌ Webhook error:", error);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;