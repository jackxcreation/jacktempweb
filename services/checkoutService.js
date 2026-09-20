// services/checkoutService.js
const mongoose = require('mongoose');
const { Order, Product, PaymentIntent } = require('../models');
const { calculateOrderTotal } = require('./orderPricingService');
const { reserveInventoryAtomic } = require('./inventoryService');
const { logger } = require('../utils/logger');

/**
 * 🔥 TASKS #59, #60, #61, #62: Enterprise Checkout Orchestration Service
 * Enforces authoritative server-side pricing, stock verification, coupon application, 
 * shipping calculation, and idempotency/double-click protection.
 * 
 * @param {Object} checkoutPayload - The validated checkout request payload
 * @param {Object} [req] - Express request object for header and IP auditing
 * @returns {Promise<{ success: boolean, order?: Object, replayed?: boolean, message?: string }>}
 */
const processCheckoutSession = async ({ userId, items, address, paymentMethod, userDetails, trafficSource, couponCode, idempotencyKey }, req = {}) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. 🔥 TASK #62: Idempotency & Duplicate Request Prevention (Double-Click Protection)
    if (idempotencyKey) {
      const existingOrder = await Order.findOne({ idempotencyKey }).session(session);
      if (existingOrder) {
        await session.abortTransaction();
        session.endSession();
        logger.warn({ message: `Idempotent Replay Detected for Key: ${idempotencyKey}`, orderId: existingOrder._id });
        return {
          success: true,
          replayed: true,
          order: existingOrder,
          message: "Order already processed (Idempotent Replay)"
        };
      }
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error("Checkout session requires at least one valid item.");
    }

    // 2. 🔥 TASKS #59, #60, #61: Authoritative Server-Side Pricing, Coupon & Shipping Calculation
    const pricingResult = await calculateOrderTotal(items, couponCode);
    if (!pricingResult.success) {
      throw new Error(pricingResult.message || "Authoritative pricing calculation failed.");
    }

    const calculatedServerTotalPaise = pricingResult.subtotalPaise;
    const taxAmountPaise = pricingResult.taxPaise;
    const shippingCostPaise = pricingResult.shippingPaise; // Server-side shipping fee calculation (Task #61)
    const discountPaise = pricingResult.discountPaise; // Server-side coupon discount calculation (Task #60)
    let finalTotalPaise = pricingResult.totalPaise; // Authoritative total (Task #59)

    const payString = String(paymentMethod || '').toLowerCase();
    const isCod = payString.includes('cod') || payString.includes('cash');

    let paymentFeePaise = 0;
    let codFeePaise = 0;

    if (!isCod) {
      paymentFeePaise = Math.round(finalTotalPaise * 0.02); 
    } else {
      codFeePaise = 5000; // Flat ₹50 COD handling fee
      finalTotalPaise += codFeePaise;
    }

    // 3. Atomic Inventory Reservation & Stock Validation
    const inventoryReservation = await reserveInventoryAtomic(items, null, userId, session);
    const verifiedOrderItems = inventoryReservation.verifiedItems;
    const selectedWarehouseId = inventoryReservation.selectedWarehouseId;

    let totalCogsPaise = verifiedOrderItems.reduce((acc, item) => acc + (item.cogsPaise * item.quantity), 0);
    let contributionPaise = finalTotalPaise - totalCogsPaise - shippingCostPaise - paymentFeePaise;

    const deviceInfo = req?.headers?.['user-agent']?.includes('Mobile') ? 'Mobile Device' : 'Desktop / PC';

    // 4. Create Authoritative Order Record
    const newOrder = new Order({ 
      userId, 
      items: verifiedOrderItems, 
      totalAmount: (finalTotalPaise / 100).toString(),
      totalPaise: finalTotalPaise, 
      subtotalPaise: calculatedServerTotalPaise,
      status: 'Pending', 
      address, 
      paymentMethod, 
      userDetails, 
      deviceInfo, 
      trafficSource,
      couponCode: couponCode || '',
      idempotencyKey: idempotencyKey || undefined, 
      fulfilledFromWarehouse: selectedWarehouseId,

      cogsPaise: totalCogsPaise,
      shippingCostPaise,
      paymentFeePaise,
      codFeePaise,
      taxAmountPaise,
      discountPaise,
      contributionPaise,
      refundAmountPaise: 0,
      rtoCostPaise: 0
    });
    
    const savedOrder = await newOrder.save({ session });

    // Update Stock Ledger References
    for (const item of verifiedOrderItems) {
      await Product.updateOne(
        { _id: item.productId, "stockLedger.referenceId": "PENDING_ORDER" },
        { $set: { "stockLedger.$.referenceId": savedOrder._id.toString() } },
        { session }
      );
    }

    // 5. Initialize Payment Intent
    const dummyGatewayOrderId = `pending_tx_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const createdIntent = await PaymentIntent.create([{
      userId,
      orderId: savedOrder._id,
      gatewayOrderId: dummyGatewayOrderId,
      amountPaise: finalTotalPaise,
      currency: 'INR',
      status: 'CREATED',
      paymentGateway: 'razorpay'
    }], { session });

    savedOrder.paymentDetails = { 
      gatewayOrderId: dummyGatewayOrderId,
      paymentIntentId: createdIntent[0]._id 
    };
    await savedOrder.save({ session });
    
    await session.commitTransaction();
    session.endSession();

    logger.info({ message: `Checkout session successfully completed for Order #${savedOrder._id}`, totalPaise: finalTotalPaise });

    return {
      success: true,
      order: savedOrder,
      message: "Checkout session processed securely."
    };

  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    logger.error({ message: "Checkout Service Error", error: error.message, stack: error.stack });
    return {
      success: false,
      message: error.message || "Failed to process checkout session."
    };
  }
};

module.exports = {
  processCheckoutSession
};