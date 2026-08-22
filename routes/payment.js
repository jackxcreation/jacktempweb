const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Razorpay = require('razorpay');
const { Order } = require('../models'); // Tumhara purana DB model import

// 🔥 SECURITY: Initialize Razorpay using Environment Variables (NEVER HARDCODE)
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID, 
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// =================================================================
// 1. ROUTE: Create Payment Order (Checkout page se call hoga)
// =================================================================
router.post('/payment/create-order', async (req, res) => {
  try {
    const { amount, receipt } = req.body;

    // 🔥 SECURITY FIX: Amount strict validation (Hackers negative ya zero amount na bhej payein)
    const finalAmount = parseFloat(amount);
    if (!finalAmount || finalAmount <= 0) {
      return res.status(400).json({ success: false, error: "Order amount must be valid and greater than 0" });
    }

    const options = {
      amount: Math.round(finalAmount), // Razorpay expects exact integer in paise
      currency: "INR",
      receipt: receipt || `JACK_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    
    if (!order) {
      return res.status(500).json({ success: false, error: "Razorpay order creation failed" });
    }

    res.json({
      success: true,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency
    });
  } catch (error) {
    console.error("❌ Razorpay order error:", error);
    res.status(500).json({ success: false, error: "Payment initiation failed" });
  }
});

// =================================================================
// 2. ROUTE: Verify Signature (Frontend Pop-up success hone ke baad)
// =================================================================
router.post('/payment/verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // 🔥 SECURITY: Check if all fields exist
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: "Missing payment signature fields!" });
    }

    // 🔥 SECURITY: Cryptographic Signature Verification
    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest("hex");

    if (razorpay_signature !== expectedSign) {
      console.warn(`🚨 HACK ATTEMPT: Invalid frontend signature for Order: ${razorpay_order_id}`);
      return res.status(400).json({ success: false, message: "Payment verification failed. Invalid Signature." });
    }

    // Success! Signature matched. Hum chahien to yahan bhi DB update kar sakte hain.
    res.status(200).json({ success: true, message: "Payment verified securely" });
  } catch (error) {
    console.error("❌ Razorpay Verification Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =================================================================
// 3. ROUTE: Secure Webhook (Razorpay server background mein call karega)
// =================================================================
router.post('/payment/webhook', async (req, res) => {
  try {
    // Razorpay webhook headers mein 'x-razorpay-signature' bhejta hai
    const signature = req.headers['x-razorpay-signature'];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET; 

    if (!signature) {
      return res.status(400).send('Missing Signature');
    }

    // 🔥 SECURITY: Webhook payload ko raw string mein verify karna zaruri hai
    // Express rawBody parse nahi karta direct, isliye JSON.stringify kar rahe hain (ya body-parser raw use karo server.js mein webhook route ke liye)
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (signature !== expectedSignature) {
      console.error("🚨 ALERT: Fake Razorpay Webhook Signature Detected!");
      return res.status(400).send('Invalid signature');
    }

    // Signature verified, ab event process karo
    const event = req.body.event;
    const payload = req.body.payload;

    if (!payload || !payload.payment || !payload.payment.entity) {
      return res.status(200).send('OK - No Action Required');
    }

    const razorpay_order_id = payload.payment.entity.order_id;
    const payment_status = payload.payment.entity.status; // jaise ki 'captured' ya 'authorized'

    // Razorpay mein 'payment.captured' ya 'order.paid' main events hote hain successful payment ke liye
    if (event === 'payment.captured' || event === 'order.paid') {
      
      // 🔥 DB Update: Tumhara purana feature secure tarike se intact hai
      await Order.findOneAndUpdate(
        { "paymentDetails.gatewayOrderId": razorpay_order_id }, // Apne DB schema ke hisaab se field name adjust kar lena (agar 'orderId' tha to wo likhna)
        { status: 'Paid', paymentMethod: 'Razorpay Online' }
      );
      console.log(`✅ Webhook: Order related to Razorpay ID ${razorpay_order_id} marked as PAID.`);
    } else if (event === 'payment.failed') {
       console.log(`❌ Webhook: Payment failed for Order ID ${razorpay_order_id}`);
       // Yahan chaho to DB mein status 'Failed' bhi kar sakte ho
    }

    // Razorpay ko 200 OK dena padta hai warna wo dobara webhook bhejta rahega
    res.status(200).send('OK');
  } catch (error) {
    console.error("❌ Webhook error:", error);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;