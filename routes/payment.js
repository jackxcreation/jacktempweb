const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Razorpay = require('razorpay');
const { Order, PaymentIntent, PaymentAttempt, Refund, Settlement } = require('../models'); 
const { logger } = require('../utils/logger'); // 🔥 Production Winston Logger

// 🚨 IMPORT AUTH MIDDLEWARE
const { protect } = require('../middleware/authMiddleware');

// 🛡️ IMPORT IDEMPOTENCY MIDDLEWARE
const { requireIdempotency } = require('../middleware/idempotencyMiddleware');

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

// 🔥 PHASE 1 FIX: ADDED ROUTE-LEVEL JSON PARSER
const jsonParser = express.json({ limit: '100kb' });

// =================================================================
// 1. CREATE PAYMENT ORDER (🔥 CANONICAL PAISE AMOUNT, PAYMENT INTENT & IDEMPOTENCY)
// =================================================================
router.post('/payment/create-order', jsonParser, protect, requireIdempotency, async (req, res) => {
  try {
    const { orderId } = req.body; 

    if (!orderId) return res.status(400).json({ success: false, error: "Order ID is required", requestId: req.requestId });

    const order = await Order.findOne({ _id: orderId, userId: req.user._id });
    
    if (!order) return res.status(404).json({ success: false, error: "Order not found or unauthorized", requestId: req.requestId });
    if (order.status !== 'Pending') return res.status(400).json({ success: false, error: "Order is already paid or processed", requestId: req.requestId });

    // Idempotency check: Agar active PaymentIntent pehle se hai toh wahi return kar do
    const existingIntent = await PaymentIntent.findOne({ orderId: order._id, status: 'CREATED' });
    if (existingIntent) {
      return res.json({
        success: true,
        order_id: existingIntent.gatewayOrderId,
        amount: existingIntent.amountPaise,
        currency: existingIntent.currency,
        replayed: true
      });
    }

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

    // 🔥 ENTERPRISE PAYMENT ARCHITECTURE: Create or Update PaymentIntent
    await PaymentIntent.findOneAndUpdate(
      { gatewayOrderId: rzpOrder.id },
      {
        userId: req.user._id,
        orderId: order._id,
        gatewayOrderId: rzpOrder.id,
        amountPaise: finalPaise,
        currency: "INR",
        status: 'CREATED',
        paymentGateway: 'razorpay'
      },
      { upsert: true, new: true }
    );

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
// 2. VERIFY SIGNATURE & RECONCILE (🔥 AUDIT SECURED & ATTEMPT LOGGED)
// =================================================================
router.post('/payment/verify', jsonParser, protect, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: "Missing payment signature fields!", requestId: req.requestId });
    }

    // Find corresponding PaymentIntent
    const paymentIntent = await PaymentIntent.findOne({ gatewayOrderId: razorpay_order_id });

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

      // Log Failed Payment Attempt
      if (paymentIntent) {
        await PaymentAttempt.create({
          paymentIntentId: paymentIntent._id,
          gatewayPaymentId: razorpay_payment_id,
          gatewaySignature: razorpay_signature,
          status: 'FAILURE',
          errorCode: 'INVALID_SIGNATURE',
          errorDescription: 'Cryptographic signature verification failed'
        });
        paymentIntent.status = 'FAILED';
        await paymentIntent.save();
      }
      
      const io = req.app.get("io");
      if (io) {
        try { io.to('payments').emit('payment.failed', { orderId: razorpay_order_id, reason: 'Invalid Signature' }); } catch (e) {}
      }

      return res.status(400).json({ success: false, message: "Payment verification failed. Invalid Signature.", requestId: req.requestId });
    }

    const order = await Order.findOne({ "paymentDetails.gatewayOrderId": razorpay_order_id, userId: req.user._id });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order reconciliation failed: Order mapping not found.", requestId: req.requestId });
    }

    // Fetch actual payment details directly from Razorpay gateway API for precise amount & currency reconciliation
    const gatewayPayment = await razorpay.payments.fetch(razorpay_payment_id);
    if (!gatewayPayment || gatewayPayment.status !== 'captured') {
      if (paymentIntent) {
        await PaymentAttempt.create({
          paymentIntentId: paymentIntent._id,
          gatewayPaymentId: razorpay_payment_id,
          gatewaySignature: razorpay_signature,
          status: 'FAILURE',
          errorCode: 'NOT_CAPTURED',
          errorDescription: `Gateway status is ${gatewayPayment?.status}`
        });
      }
      const io = req.app.get("io");
      if (io) {
        try { io.to('payments').emit('payment.failed', { orderId: order._id, reason: 'Gateway Payment Not Captured' }); } catch (e) {}
      }
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

      if (paymentIntent) {
        await PaymentAttempt.create({
          paymentIntentId: paymentIntent._id,
          gatewayPaymentId: razorpay_payment_id,
          gatewaySignature: razorpay_signature,
          status: 'FAILURE',
          errorCode: 'AMOUNT_MISMATCH',
          errorDescription: `Expected ${expectedPaise}, got ${gatewayPayment.amount}`
        });
        paymentIntent.status = 'FAILED';
        await paymentIntent.save();
      }
      
      const io = req.app.get("io");
      if (io) {
        try { io.to('payments').emit('payment.failed', { orderId: order._id, reason: 'Amount Mismatch Fraud' }); } catch (e) {}
      }

      return res.status(400).json({ success: false, message: "Payment reconciliation failed: Amount or Currency mismatch.", requestId: req.requestId });
    }

    // Log Successful Payment Attempt & Update Intent
    if (paymentIntent) {
      await PaymentAttempt.create({
        paymentIntentId: paymentIntent._id,
        gatewayPaymentId: razorpay_payment_id,
        gatewaySignature: razorpay_signature,
        status: 'SUCCESS',
        rawResponse: gatewayPayment
      });
      paymentIntent.status = 'PAID';
      await paymentIntent.save();
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
// 3. SECURE WEBHOOK (🔥 ABSOLUTE SOURCE OF TRUTH & EVENT DISPATCHING)
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

    const io = req.app.get("io");

    // Handle payment.failed event via Webhook Source of Truth
    if (event === 'payment.failed') {
      const paymentEntity = payload?.payment?.entity;
      if (paymentEntity) {
        const razorpay_order_id = paymentEntity.order_id;
        const paymentIntent = await PaymentIntent.findOne({ gatewayOrderId: razorpay_order_id });
        if (paymentIntent) {
          paymentIntent.status = 'FAILED';
          await paymentIntent.save();
          await PaymentAttempt.create({
            paymentIntentId: paymentIntent._id,
            gatewayPaymentId: paymentEntity.id,
            status: 'FAILURE',
            errorCode: paymentEntity.error_code || 'WEBHOOK_FAILURE',
            errorDescription: paymentEntity.error_description || 'Payment Failed via Webhook',
            rawResponse: paymentEntity
          });
        }
      }
      if (io) {
        try { io.to('payments').emit('payment.failed', { gatewayOrderId: payload?.payment?.entity?.order_id, reason: payload?.payment?.entity?.error_description || 'Payment Failed' }); } catch (e) {}
      }
      return res.status(200).send('OK');
    }

    // Handle Refund Events
    if (event === 'refund.processed' || event === 'refund.created') {
      const refundEntity = payload?.refund?.entity;
      if (refundEntity) {
        await Refund.findOneAndUpdate(
          { gatewayRefundId: refundEntity.id },
          {
            gatewayRefundId: refundEntity.id,
            amountPaise: refundEntity.amount,
            status: event === 'refund.processed' ? 'PROCESSED' : 'PENDING',
            reason: refundEntity.notes?.reason || 'Webhook triggered refund'
          },
          { upsert: true, new: true }
        );
      }
      return res.status(200).send('OK');
    }

    // Handle Settlement Events
    if (event === 'settlement.processed') {
      const settlementEntity = payload?.settlement?.entity;
      if (settlementEntity) {
        await Settlement.findOneAndUpdate(
          { gatewaySettlementId: settlementEntity.id },
          {
            gatewaySettlementId: settlementEntity.id,
            gatewayPaymentId: settlementEntity.payment_id || '',
            amountPaise: settlementEntity.amount,
            feePaise: settlementEntity.fee || 0,
            taxPaise: settlementEntity.tax || 0,
            status: 'SETTLED'
          },
          { upsert: true, new: true }
        );
      }
      return res.status(200).send('OK');
    }

    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentEntity = payload?.payment?.entity;
      if (!paymentEntity) return res.status(200).send('OK - No Action Required');

      const razorpay_order_id = paymentEntity.order_id;
      const paymentId = paymentEntity.id;
      const gatewayAmountPaise = paymentEntity.amount;
      const currency = paymentEntity.currency;

      const order = await Order.findOne({ "paymentDetails.gatewayOrderId": razorpay_order_id });
      if (!order) return res.status(404).send('Order not found');

      const paymentIntent = await PaymentIntent.findOne({ gatewayOrderId: razorpay_order_id });

      // 🔥 STRICT IDEMPOTENCY: Check if event or paymentId was already processed
      if (order.paymentDetails?.gatewayPaymentId === paymentId || order.status === 'Paid' || order.status === 'Processing') {
         console.log(`ℹ️ Webhook: Event or Payment ID ${paymentId} already processed. Skipping replay.`);
         return res.status(200).send('OK');
      }

      // Amount Reconciliation against Database Order Total
      const expectedPaise = order.totalPaise || Math.round(parseFloat(order.totalAmount || 0) * 100);
      if (gatewayAmountPaise !== expectedPaise || currency !== "INR") {
        logger.error({ message: `WEBHOOK FRAUD ALERT: Amount mismatch! Expected ${expectedPaise} paise, got ${gatewayAmountPaise}` });
        if (paymentIntent) {
          paymentIntent.status = 'FAILED';
          await paymentIntent.save();
        }
        if (io) {
          try { io.to('payments').emit('payment.failed', { orderId: order._id, reason: 'Webhook Amount Mismatch' }); } catch (e) {}
        }
        return res.status(400).send('Amount Reconciliation Failed');
      }

      // Log successful attempt via Webhook source of truth
      if (paymentIntent) {
        paymentIntent.status = 'PAID';
        await paymentIntent.save();
        
        const existingAttempt = await PaymentAttempt.findOne({ gatewayPaymentId: paymentId });
        if (!existingAttempt) {
          await PaymentAttempt.create({
            paymentIntentId: paymentIntent._id,
            gatewayPaymentId: paymentId,
            status: 'SUCCESS',
            rawResponse: paymentEntity
          });
        }
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