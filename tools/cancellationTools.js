const mongoose = require('mongoose');
const { Order } = require('../models');
const { POLICIES, canCancelOrder } = require('../services/support/supportPolicyService');

/**
 * Checks whether an order is eligible for cancellation.
 * Enhanced with ID validation, lean queries, and robust policy checks.
 */
const getCancellationEligibility = async ({ orderId } = {}, customerId) => {
  if (!customerId || !orderId) {
    return { error: 'Customer ID and Order ID are required to check cancellation eligibility.' };
  }

  // 1. DEFENSIVE FIX: Prevent Mongoose CastError if IDs are improperly formatted
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return { error: 'Invalid Order ID format provided.' };
  }
  if (!mongoose.Types.ObjectId.isValid(customerId)) {
    return { error: 'Invalid Customer ID format provided.' };
  }

  try {
    // 2. SCHEMA SYNC: Matches both 'user' and 'userId' to prevent IDOR tracking failures
    const query = { 
      _id: orderId, 
      $or: [{ user: customerId }, { userId: customerId }] 
    };

    // 3. MEMORY FIX: Added .lean() to prevent memory bloat during AI tool execution
    const order = await Order.findOne(query)
      .select('status isPaid paymentMethod paymentMode')
      .lean();

    if (!order) {
      return { error: 'Order not found or access denied due to security policies.' };
    }

    // Evaluate policy rules securely
    const isEligible = canCancelOrder(order.status);
    
    // 4. BUSINESS LOGIC UPGRADE: Only require a refund if it's actually prepaid
    const isPrepaid = order.isPaid || !['cod', 'cash'].includes(String(order.paymentMethod || order.paymentMode || '').toLowerCase());
    
    return {
      success: true,
      data: {
        orderId: order._id.toString(),
        currentStatus: order.status,
        isEligible: isEligible,
        reason: isEligible 
          ? 'Order has not been shipped yet and is eligible for cancellation.' 
          : 'Order has already been shipped, processed, or delivered.',
        refundRequired: Boolean(isEligible && isPrepaid)
      }
    };
  } catch (error) {
    console.error('Cancellation Eligibility Tool Error:', error.message);
    return { error: 'Failed to fetch cancellation eligibility due to a server error.' };
  }
};

module.exports = { getCancellationEligibility };