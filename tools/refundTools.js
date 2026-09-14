const mongoose = require('mongoose');
const { Order } = require('../models');

/**
 * Checks the refund status of an order.
 * Enhanced with ID validation, .lean() memory optimization, and schema sync.
 */
const getRefundStatus = async (args = {}, customerId) => {
  if (!customerId || !args.orderId) {
    return { error: 'Auth and Order ID required.' };
  }

  if (!mongoose.Types.ObjectId.isValid(customerId)) {
    return { error: 'Invalid customer session format.' };
  }
  if (!mongoose.Types.ObjectId.isValid(args.orderId)) {
    return { error: 'Invalid Order ID format provided.' };
  }

  try {
    // SCHEMA FIX: Support both 'user' and 'userId' to prevent IDOR tracking failures
    const query = {
      _id: args.orderId,
      $or: [{ user: customerId }, { userId: customerId }]
    };

    // MEMORY FIX: Use .lean() to prevent memory bloat during AI execution
    const order = await Order.findOne(query)
      .select('status isPaid paymentMethod paymentMode totalPrice totalPaise refundStatus')
      .lean();

    if (!order) {
      return { success: false, message: 'Order not found or access denied.' };
    }

    // Standardize price
    const amount = `₹${(order.totalPaise || (order.totalPrice ? order.totalPrice * 100 : 0)) / 100}`;
    
    // Evaluate if paid based on explicit flags or payment method
    const isPrepaid = order.isPaid || !['cod', 'cash'].includes(String(order.paymentMethod || order.paymentMode || '').toLowerCase());

    if (!order.isPaid && !isPrepaid) {
      return { 
        success: true, 
        data: { 
          orderId: order._id.toString(),
          status: 'NO_REFUND_DUE', 
          reason: 'Order was Cash on Delivery and no prior payment was collected.' 
        } 
      };
    }

    // Determine refund status based on standard lifecycle
    let refundStatus = order.refundStatus || 'PENDING';
    if (order.status !== 'CANCELLED' && order.status !== 'RETURNED') {
      refundStatus = 'NOT_APPLICABLE';
    }

    return {
      success: true,
      data: {
        orderId: order._id.toString(),
        refundStatus: refundStatus,
        amount: amount,
        method: order.paymentMethod || order.paymentMode || 'Unknown',
        estimatedDays: refundStatus === 'PENDING' ? '5-7 business days' : null
      }
    };
  } catch (error) {
    console.error('Get Refund Status Tool Error:', error.message);
    return { error: 'Failed to fetch refund status.' };
  }
};

module.exports = { getRefundStatus };