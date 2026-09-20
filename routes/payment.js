// routes/paymentRouter.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Razorpay = require('razorpay');
const { Order, PaymentIntent, PaymentAttempt, Refund, Settlement } = require('../models'); 
const { logger } = require('../utils/logger'); // 🔥 Production Winston Logger
const { calculateOrderTotal } = require('../services/orderPricingService'); // 🔥 TASK #59, #60, #61: Server-side authoritative pricing engine
const { rawBodyMiddleware } = require('../middleware/rawBody'); // 🔥 TASK #19: Raw body middleware for webhooks

// 🔥 TASK #48: IMPORT CENTRALIZED ZOD VALIDATORS FOR PAYMENTS
const { paymentIntentValidator, verifyPaymentValidator } = require('../validators/payment');

// 🔥 TASK #49: IMPORT STANDARDIZED API RESPONSE HELPERS
const { sendSuccess, sendError } = require('../utils/apiResponse');

// 🔥 TASK #47: IMPORT GRANULAR RATE LIMITER FOR PAYMENTS
const { paymentLimiter } = require('../middleware/rateLimit');

// 🚨 IMPORT AUTH MIDDLEWARE
const { protect } = require('../middleware/authMiddleware');

// 🛡️ IMPORT IDEMPOTENCY MIDDLEWARE (Task #62)
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
    route: req.originalUrl,
    errorCode: error.code || 'PAYMENT_OPERATION_FAILED'
  });

  return sendError(
    res,
    error.code || 'PAYMENT_OPERATION_FAILED',
    process.env.NODE_ENV === 'production' ? defaultMessage : error.message,
    statusCode,
    req,
    error.errors || error.issues || null
  );
};

// 🔥 PHASE 1 / TASK #46 FIX: STRICT ROUTE-LEVEL JSON PARSER (100kb limit)
const jsonParser = express.json({ limit: '100kb' });

// =================================================================
// 1. CREATE PAYMENT ORDER (🔥 TASKS #59, #60, #61, #62)
// =================================================================
router.post('/payment/create-order', jsonParser, protect, paymentLimiter, requireIdempotency, async (req, res) => {
  try {
    const validationResult = paymentIntentValidator.safeParse({
      orderId: req.body.orderId,
      amountPaise: req.body.amountPaise || 1 
    });

    const { orderId, couponCode } = req.body; 

    if (!orderId) {
      return sendError(res, 'MISSING_ORDER_ID', "Order ID is required", 400, req);
    }

    const order = await Order.findOne({ _id: orderId, userId: req.user._id });
    
    if (!order) {
      return sendError(res, 'ORDER_NOT_FOUND', "Order not found or unauthorized", 404, req);
    }
    if (order.status !== 'Pending') {
      return sendError(res, 'ORDER_ALREADY_PROCESSED', "Order is already paid or processed", 400, req);
    }

    // Idempotency check: Return existing valid PaymentIntent if already created (Task #62)
    const existingIntent = await PaymentIntent.findOne({ orderId: order._id, status: 'CREATED' });
    const isValidRazorpayId = existingIntent && /^order_[a-zA-Z0-9]+$/.test(existingIntent.gatewayOrderId);

    if (isValidRazorpayId) {
      return sendSuccess(res, {
        order_id: existingIntent.gatewayOrderId,
        amount: existingIntent.amountPaise,
        currency: existingIntent.currency,
        replayed: true
      }, "Payment order already created (Idempotent Replay)", 200, req);
    }

    // 🔥 TASK #59, #60, #61: Recalculate strictly from DB authoritative prices, server-side coupons, and shipping fees
    let finalPaise;
    if (order.items && Array.isArray(order.items) && order.items.length > 0) {
      const pricing = await calculateOrderTotal(order.items, couponCode || order.couponCode);
      if (!pricing.success) {
        return sendError(res, 'PRICING_CALCULATION_FAILED', pricing.message, 400, req);
      }
      finalPaise = pricing.totalPaise; // Authoritative total in paise
      
      // Update order document with verified authoritative calculation
      order.totalPaise = finalPaise;
      order.subtotalPaise = pricing.subtotalPaise;
      order.taxPaise = pricing.taxPaise;
      order.shippingPaise = pricing.shippingPaise; // Server-side shipping (Task #61)
      order.discountPaise = pricing.discountPaise; // Server-side coupon discount (Task #60)
      if (couponCode) order.couponCode = couponCode;
      await order.save();
    } else {
      finalPaise = order.totalPaise ? Math.round(order.totalPaise) : Math.round(parseFloat(order.totalAmount || 0) * 100); 
    }

    const options = {
      amount: finalPaise, 
      currency: "INR",
      receipt: order._id.toString(),
    };

    const rzpOrder = await razorpay.orders.create(options);
    
    // Create or Update PaymentIntent for explicit relation mapping
    const paymentIntent = await PaymentIntent.findOneAndUpdate(
      { orderId: order._id }, 
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

    // Bind gateway order ID and paymentIntentId on order model
    order.paymentDetails = { 
      gatewayOrderId: rzpOrder.id,
      paymentIntentId: paymentIntent._id 
    };
    await order.save();

    return sendSuccess(res, {
      order_id: rzpOrder.id, 
      amount: rzpOrder.amount, 
      currency: rzpOrder.currency
    }, "Payment order created successfully", 200, req);
  } catch (error) {
    return sendErrorResponse(res, req, error, "Payment initiation failed");
  }
});

// =================================================================
// 2. VERIFY SIGNATURE & RECONCILE (🔥 TASKS #59, #60, #61, #62)
// =================================================================
router.post('/payment/verify', jsonParser, protect, async (req, res) => {
  try {
    const validationResult = verifyPaymentValidator.safeParse(req.body);
    if (!validationResult.success) {
      return sendError(res, 'VALIDATION_FAILED', "Validation failed", 400, req, validationResult.error.format());
    }

    const { gatewayOrderId: razorpay_order_id, gatewayPaymentId: razorpay_payment_id, gatewaySignature: razorpay_signature } = validationResult.data;

    const paymentIntent = await PaymentIntent.findOne({ gatewayOrderId: razorpay_order_id });

    // Check #1: Cryptographic Signature Verification
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

      return sendError(res, 'INVALID_SIGNATURE', "Payment verification failed. Invalid Signature.", 400, req);
    }

    const order = await Order.findOne({ "paymentDetails.gatewayOrderId": razorpay_order_id });
    if (!order) {
      return sendError(res, 'ORDER_MAPPING_NOT_FOUND', "Order reconciliation failed: Order mapping not found.", 404, req);
    }

    if (order.userId.toString() !== req.user._id.toString()) {
      logger.error({
        message: 'FRAUD ALERT: User mismatch during payment verification',
        requestId: req.requestId,
        tokenUserId: req.user._id,
        orderUserId: order.userId
      });
      return sendError(res, 'UNAUTHORIZED_CUSTOMER', "Payment reconciliation failed: Unauthorized customer.", 403, req);
    }

    if (order.status === 'Paid' || order.status === 'Processing') {
      return sendSuccess(res, {}, "Payment already reconciled (Idempotent replay)", 200, req);
    }

    if (order.status === 'Cancelled' || order.status === 'Refunded') {
      return sendError(res, 'ORDER_CANCELLED_OR_REFUNDED', "Payment reconciliation failed: Order is cancelled or refunded.", 400, req);
    }

    // Never trust frontend client flags blindly. Fetch directly from verified Gateway API (Source of Truth).
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
      return sendError(res, 'PAYMENT_NOT_CAPTURED', "Payment is not captured or verified at gateway.", 400, req);
    }

    if (gatewayPayment.currency !== "INR") {
      logger.error({ message: `FRAUD ALERT: Currency mismatch! Expected INR, got ${gatewayPayment.currency}` });
      return sendError(res, 'CURRENCY_MISMATCH', "Payment reconciliation failed: Currency mismatch.", 400, req);
    }

    // Authoritative Amount Match Check against Server-Side Order Total (Task #59)
    const expectedPaise = order.totalPaise ? Math.round(order.totalPaise) : Math.round(parseFloat(order.totalAmount || 0) * 100);
    if (gatewayPayment.amount !== expectedPaise) {
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
          errorDescription: `Expected ${expectedPaise} paise, got ${gatewayPayment.amount} paise`
        });
        paymentIntent.status = 'FAILED';
        await paymentIntent.save();
      }
      
      const io = req.app.get("io");
      if (io) {
        try { io.to('payments').emit('payment.failed', { orderId: order._id, reason: 'Amount Mismatch Fraud' }); } catch (e) {}
      }

      return sendError(res, 'AMOUNT_MISMATCH', "Payment reconciliation failed: Amount mismatch.", 400, req);
    }

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

    order.status = 'Paid';
    order.paymentMethod = 'Razorpay Online';
    order.paymentDetails.gatewayPaymentId = razorpay_payment_id;
    order.paymentDetails.processedEventId = razorpay_payment_id;
    await order.save();

    return sendSuccess(res, {}, "Payment verified and reconciled securely", 200, req);
  } catch (error) {
    return sendErrorResponse(res, req, error, "Payment verification failed");
  }
});

// =================================================================
// 3. SECURE WEBHOOK (🔥 TASKS #59, #60, #61, #62)
// =================================================================
router.post('/payment/webhook', rawBodyMiddleware, async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET; 

    if (!signature) {
      return res.status(400).send('Missing Signature');
    }

    if (!Buffer.isBuffer(req.body)) {
      logger.error({ message: 'WEBHOOK ERROR: req.body is not a raw buffer' });
      return res.status(400).send('Invalid request body format');
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(req.body) 
      .digest('hex');

    const sigBuffer = Buffer.from(signature || '', 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      logger.error({ message: 'ALERT: Fake Razorpay Webhook Signature Detected!' });
      return res.status(400).send('Invalid signature');
    }

    const payloadBody = JSON.parse(req.body.toString('utf8'));
    const { event, payload } = payloadBody;

    const eventId = payloadBody.event_id || payload?.payment?.entity?.id + "_" + event || `evt_${Date.now()}`;

    const io = req.app.get("io");

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

      // Strict Webhook Idempotency Check via processedEventId
      if (order.paymentDetails?.processedEventId === eventId || order.paymentDetails?.gatewayPaymentId === paymentId || order.status === 'Paid' || order.status === 'Processing') {
         console.log(`ℹ️ Webhook Idempotent Replay: Event ${eventId} already processed. Skipping as No-Op.`);
         return res.status(200).send('OK');
      }

      // Authoritative Amount Reconciliation against Database Order Total (Task #59)
      const expectedPaise = order.totalPaise ? Math.round(order.totalPaise) : Math.round(parseFloat(order.totalAmount || 0) * 100);
      if (gatewayAmountPaise !== expectedPaise || currency !== "INR") {
        logger.error({ message: `WEBHOOK FRAUD ALERT: Amount mismatch! Expected ${expectedPaise} paise, got ${gatewayAmountPaise} paise` });
        const paymentIntent = await PaymentIntent.findOne({ gatewayOrderId: razorpay_order_id });
        if (paymentIntent) {
          paymentIntent.status = 'FAILED';
          await paymentIntent.save();
        }
        if (io) {
          try { io.to('payments').emit('payment.failed', { orderId: order._id, reason: 'Webhook Amount Mismatch' }); } catch (e) {}
        }
        return res.status(400).send('Amount Reconciliation Failed');
      }

      const paymentIntent = await PaymentIntent.findOne({ gatewayOrderId: razorpay_order_id });
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

      const updatedOrder = await Order.findOneAndUpdate(
        { 
          "paymentDetails.gatewayOrderId": razorpay_order_id, 
          status: 'Pending' 
        }, 
        { 
          $set: { 
            status: 'Paid',
            paymentMethod: 'Razorpay Online',
            "paymentDetails.gatewayPaymentId": paymentId,
            "paymentDetails.eventId": eventId,
            "paymentDetails.processedEventId": eventId,
            "paymentDetails.paymentIntentId": paymentIntent?._id || null,
            updatedAt: new Date()
          } 
        },
        { new: true }
      );

      if (!updatedOrder) {
        console.log(`ℹ️ Webhook: Order ${razorpay_order_id} was already mutated (No-Op).`);
        return res.status(200).send('OK');
      }
      
      console.log(`✅ Webhook: Order ${razorpay_order_id} successfully reconciled via authoritative event ID ${eventId}.`);
    }

    return res.status(200).send('OK');
  } catch (error) {
    logger.error({ message: 'Webhook processing error', error: error.message, stack: error.stack });
    return res.status(500).send('Internal Server Error');
  }
});

module.exports = router;