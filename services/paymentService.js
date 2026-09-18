// services/paymentService.js
const mongoose = require('mongoose');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { Order, Product, PaymentIntent, PaymentAttempt } = require('../models');
const { logger } = require('../utils/logger');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/**
 * Initiates a secure Razorpay payment order and creates a PaymentIntent atomically.
 * 
 * @param {string} userId - ID of the customer
 * @param {string} orderId - ID of the internal order
 * @returns {Promise<{ success: boolean, orderId: string, amount: number, currency: string }>}
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

    // Canonical amount in paise
    const amountPaise = order.totalPaise || Math.round(parseFloat(order.totalAmount || 0) * 100);

    const options = {
      amount: amountPaise,
      currency: "INR",
      receipt: order._id.toString(),
      notes: {
        userId: userId.toString(),
        orderId: order._id.toString()
      }
    };

    // Create order with Razorpay Gateway
    const rzpOrder = await razorpay.orders.create(options);

    order.paymentDetails = { 
      gatewayOrderId: rzpOrder.id,
      gateway: 'razorpay'
    };
    await order.save({ session });

    // Record or update Payment Intent
    await PaymentIntent.findOneAndUpdate(
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

    await session.commitTransaction();
    session.endSession();

    logger.info(`💳 Payment order created successfully for Order #${order._id} [Gateway Order: ${rzpOrder.id}]`);

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
 * Deducts stock safely using transactions upon successful payment verification.
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
    // 1. Cryptographic Signature Verification
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

    // 2. Fetch Order & Payment Intent
    const order = await Order.findOne({ "paymentDetails.gatewayOrderId": gatewayOrderId, userId }).session(session);
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return { success: false, message: "Order reconciliation failed: Order mapping not found." };
    }

    if (order.status === 'Paid' || order.status === 'Processing') {
      await session.abortTransaction();
      session.endSession();
      return { success: true, message: "Payment already reconciled (Idempotent replay)." };
    }

    // 3. Verify directly with Razorpay Gateway API to prevent tampering
    const gatewayPayment = await razorpay.payments.fetch(gatewayPaymentId);
    if (!gatewayPayment || gatewayPayment.status !== 'captured') {
      await session.abortTransaction();
      session.endSession();
      return { success: false, message: `Payment not captured at gateway. Status: ${gatewayPayment?.status}` };
    }

    const expectedPaise = order.totalPaise || Math.round(parseFloat(order.totalAmount || 0) * 100);
    if (gatewayPayment.amount !== expectedPaise) {
      logger.error(`🚨 FRAUD ALERT: Amount mismatch! Expected ${expectedPaise} paise, got ${gatewayPayment.amount} paise.`);
      await session.abortTransaction();
      session.endSession();
      return { success: false, message: "Payment reconciliation failed: Amount mismatch." };
    }

    // 4. ATOMIC STOCK DEDUCTION & ORDER FULFILLMENT
    for (const item of order.items || []) {
      const product = await Product.findById(item.productId || item.product).session(session);
      if (product) {
        if (product.stock < item.quantity) {
          throw new Error(`Insufficient stock for product: ${product.name}`);
        }
        product.stock -= item.quantity;
        await product.save({ session });
      }
    }

    // 5. Update Order Status
    order.status = 'Paid';
    order.paymentMethod = 'Razorpay Online';
    order.paymentDetails.gatewayPaymentId = gatewayPaymentId;
    await order.save({ session });

    // 6. Update Payment Intent & Log Success Attempt
    const paymentIntent = await PaymentIntent.findOne({ gatewayOrderId }).session(session);
    if (paymentIntent) {
      paymentIntent.status = 'PAID';
      await paymentIntent.save({ session });

      await PaymentAttempt.create([{
        paymentIntentId: paymentIntent._id,
        gatewayPaymentId,
        gatewaySignature: signature,
        status: 'SUCCESS',
        rawResponse: gatewayPayment
      }], { session });
    }

    await session.commitTransaction();
    session.endSession();

    logger.info(`✅ Payment successfully verified, stock deducted, and Order #${order._id} marked as Paid.`);
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