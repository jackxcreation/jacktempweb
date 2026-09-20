// services/paymentService.js
const mongoose = require('mongoose');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { Order, Product, PaymentIntent, PaymentAttempt } = require('../models');
const { logger } = require('../utils/logger');
const { calculateOrderTotal } = require('./orderPricingService'); // 🔥 TASK #16 & #17: Server-side authoritative pricing & paise unit engine

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/**
 * Initiates a secure Razorpay payment order and creates a PaymentIntent atomically.
 * Enforces server-side authoritative pricing in strict PAISE units and explicit mapping.
 * 
 * @param {string} userId - ID of the customer
 * @param {string} orderId - ID of the internal order
 * @returns {Promise<{ success: boolean, gatewayOrderId: string, amount: number, currency: string }>}
 */
const createPaymentOrder = async (userId, orderId) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      throw new Error("Invalid Order ID format");
    }

    const order = await Order.findOne({ _id: orderId, userId }).session(session);
    if (!order) {
      throw new Error("Order not found or unauthorized");
    }

    if (order.status !== 'Pending' && order.status !== 'Pending Payment') {
      throw new Error("Order is already paid, processed, or invalid for payment");
    }

    // 🔥 TASK #16 & #17: Calculate authoritative total in strict Paise units (1 INR = 100 paise)
    let amountPaise;
    if (order.items && Array.isArray(order.items) && order.items.length > 0) {
      const pricing = await calculateOrderTotal(order.items, order.couponCode);
      if (!pricing.success) {
        throw new Error(pricing.message || "Failed to calculate secure order pricing");
      }
      amountPaise = Math.round(pricing.totalPaise); // Guaranteed integer paise

      // Update order with fresh authoritative totals in paise
      order.totalPaise = amountPaise;
      order.subtotalPaise = pricing.subtotalPaise;
      order.taxPaise = pricing.taxPaise;
      order.shippingPaise = pricing.shippingPaise;
      order.discountPaise = pricing.discountPaise;
    } else {
      // Safe fallback ensuring rupee amounts are correctly scaled to paise (* 100)
      amountPaise = order.totalPaise ? Math.round(order.totalPaise) : Math.round(parseFloat(order.totalAmount || 0) * 100);
    }

    if (!amountPaise || amountPaise <= 0 || !Number.isInteger(amountPaise)) {
      throw new Error("Invalid order amount computed in paise.");
    }

    const options = {
      amount: amountPaise, // 🔥 Sent strictly as integer paise to Razorpay (e.g. ₹999 = 99900 paise)
      currency: "INR",
      receipt: order._id.toString(),
      notes: {
        userId: userId.toString(),
        orderId: order._id.toString()
      }
    };

    // Create order with Razorpay Gateway using verified server paise amount
    const rzpOrder = await razorpay.orders.create(options);

    // 🔥 TASK #21: Create or Update PaymentIntent first to obtain its canonical _id
    const paymentIntent = await PaymentIntent.findOneAndUpdate(
      { orderId: order._id },
      {
        userId,
        orderId: order._id,
        gatewayOrderId: rzpOrder.id,
        amountPaise,
        currency: "INR",
        status: 'CREATED',
        paymentGateway: 'razorpay'
      },
      { upsert: true, new: true, session }
    );

    // 🔥 TASK #21: Explicitly bind gateway order ID and paymentIntentId on order model
    order.paymentDetails = { 
      gatewayOrderId: rzpOrder.id,
      gateway: 'razorpay',
      paymentIntentId: paymentIntent._id
    };
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    logger.info(`💳 Payment order created successfully for Order #${order._id} [Gateway Order: ${rzpOrder.id}] with amount: ${amountPaise} paise (₹${amountPaise / 100})`);

    return {
      success: true,
      gatewayOrderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency
    };
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    logger.error({ message: "Payment Order Creation Service Error", error: error.message, stack: error.stack });
    throw error;
  }
};

/**
 * Verifies cryptographic signature and reconciles payment transaction atomically.
 * Enforces strict Task #18 5-point checks, Task #20 Idempotency, Task #22 Gateway Source-of-Truth, 
 * and Task #65 ACID Multi-Document Transactions (Stock decrement + Order status update).
 * 
 * @param {string} userId - Customer ID
 * @param {string} gatewayOrderId - Razorpay Order ID
 * @param {string} gatewayPaymentId - Razorpay Payment ID
 * @param {string} signature - Razorpay Signature
 * @returns {Promise<{ success: boolean, message: string }>}
 */
const verifyAndReconcilePayment = async (userId, gatewayOrderId, gatewayPaymentId, signature) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Cryptographic Signature Verification (Check #1)
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${gatewayOrderId}|${gatewayPaymentId}`)
      .digest("hex");

    if (generatedSignature !== signature) {
      logger.warn(`🚨 SECURITY ALERT: Invalid payment signature for gateway order ${gatewayOrderId}`);
      
      const intent = await PaymentIntent.findOne({ gatewayOrderId }).session(session);
      if (intent) {
        intent.status = 'FAILED';
        await intent.save({ session });
        await PaymentAttempt.create([{
          paymentIntentId: intent._id,
          gatewayPaymentId,
          gatewaySignature: signature,
          status: 'FAILURE',
          errorCode: 'INVALID_SIGNATURE',
          errorDescription: 'Signature verification mismatch'
        }], { session });
      }

      await session.commitTransaction();
      session.endSession();
      return { success: false, message: "Payment verification failed: Invalid signature." };
    }

    // 2. Fetch Order & Verify Ownership & State (Check #2 & #5 & #21)
    const order = await Order.findOne({ "paymentDetails.gatewayOrderId": gatewayOrderId }).session(session);
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return { success: false, message: "Order reconciliation failed: Order mapping not found." };
    }

    // Task #18: Strict Customer Match Check (Check #5)
    if (order.userId.toString() !== userId.toString()) {
      logger.error(`🚨 FRAUD ALERT: Customer mismatch! Token userId ${userId} does not match order userId ${order.userId}`);
      await session.abortTransaction();
      session.endSession();
      return { success: false, message: "Payment reconciliation failed: Customer unauthorized." };
    }

    // 🔥 TASK #20: Strict Idempotency Check (If already paid or same paymentId processed, return success No-Op)
    if (order.paymentDetails?.gatewayPaymentId === gatewayPaymentId || order.status === 'Paid' || order.status === 'Processing') {
      await session.commitTransaction();
      session.endSession();
      logger.info(`ℹ️ Idempotent Replay: Payment ID ${gatewayPaymentId} already processed for Order #${order._id}. Returning success.`);
      return { success: true, message: "Payment already reconciled (Idempotent replay)." };
    }

    // Task #18: Check order state allows payment
    if (order.status === 'Cancelled' || order.status === 'Refunded') {
      await session.abortTransaction();
      session.endSession();
      return { success: false, message: "Payment reconciliation failed: Order is cancelled or refunded." };
    }

    // 🔥 TASK #22: Never trust client flags. Verify directly with Razorpay Gateway API to establish absolute Source of Truth.
    const gatewayPayment = await razorpay.payments.fetch(gatewayPaymentId);
    if (!gatewayPayment || gatewayPayment.status !== 'captured') {
      await session.abortTransaction();
      session.endSession();
      return { success: false, message: `Payment not captured at gateway. Status: ${gatewayPayment?.status}` };
    }

    // Task #18: Strict Currency Match Check (Check #4)
    if (gatewayPayment.currency !== "INR") {
      logger.error(`🚨 FRAUD ALERT: Currency mismatch! Expected INR, got ${gatewayPayment.currency}`);
      await session.abortTransaction();
      session.endSession();
      return { success: false, message: "Payment reconciliation failed: Currency mismatch." };
    }

    // Task #18: Strict Amount Match Check (Check #3)
    const expectedPaise = order.totalPaise ? Math.round(order.totalPaise) : Math.round(parseFloat(order.totalAmount || 0) * 100);
    if (gatewayPayment.amount !== expectedPaise) {
      logger.error(`🚨 FRAUD ALERT: Amount mismatch! Expected ${expectedPaise} paise, got ${gatewayPayment.amount} paise.`);
      await session.abortTransaction();
      session.endSession();
      return { success: false, message: "Payment reconciliation failed: Amount mismatch." };
    }

    // 4. 🔥 TASK #65: ATOMIC ACID STOCK DEDUCTION & ORDER FULFILLMENT
    for (const item of order.items || []) {
      const product = await Product.findById(item.productId || item.product).session(session);
      if (product) {
        const currentStock = product.inventoryState?.available !== undefined ? product.inventoryState.available : (product.inventory || product.stock || 0);
        if (currentStock < item.quantity) {
          throw new Error(`Insufficient stock for product: ${product.title || product.name}`);
        }
        
        if (product.inventoryState && product.inventoryState.available !== undefined) {
          product.inventoryState.available = Math.max(0, product.inventoryState.available - item.quantity);
          product.inventory = product.inventoryState.available;
        } else {
          product.stock = (product.stock || product.inventory || 0) - item.quantity;
          product.inventory = product.stock;
        }

        await product.save({ session });
      }
    }

    // 5. Update Order Status & Store Explicit References
    order.status = 'Paid';
    order.paymentMethod = 'Razorpay Online';
    order.paymentDetails.gatewayPaymentId = gatewayPaymentId;
    order.paymentDetails.processedEventId = gatewayPaymentId;
    await order.save({ session });

    // 6. Update Payment Intent & Log Success Attempt
    const paymentIntent = await PaymentIntent.findOne({ gatewayOrderId }).session(session);
    if (paymentIntent) {
      paymentIntent.status = 'PAID';
      await paymentIntent.save({ session });

      const existingAttempt = await PaymentAttempt.findOne({ gatewayPaymentId }).session(session);
      if (!existingAttempt) {
        await PaymentAttempt.create([{
          paymentIntentId: paymentIntent._id,
          gatewayPaymentId,
          gatewaySignature: signature,
          status: 'SUCCESS',
          rawResponse: gatewayPayment
        }], { session });
      }
    }

    await session.commitTransaction();
    session.endSession();

    logger.info(`✅ Payment successfully verified via Gateway API, stock deducted, and Order #${order._id} marked as Paid.`);
    return { success: true, message: "Payment successfully verified and reconciled." };

  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    logger.error({ message: "Payment Verification & Reconciliation Error", error: error.message, stack: error.stack });
    throw error;
  }
};

module.exports = {
  createPaymentOrder,
  verifyAndReconcilePayment
};