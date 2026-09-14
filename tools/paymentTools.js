const mongoose = require('mongoose');
const { Order } = require('../models');

const getPaymentStatus = async (args = {}, customerId) => {
  if (!customerId || !args.orderId) {
    return { error: 'Order ID and Auth required.' };
  }

  if (!mongoose.Types.ObjectId.isValid(customerId)) {
    return { error: 'Invalid customer session format.' };
  }
  if (!mongoose.Types.ObjectId.isValid(args.orderId)) {
    return { error: 'Invalid Order ID format provided.' };
  }

  try {
    // SCHEMA FIX: Support both 'user' and 'userId' to prevent IDOR blind spots
    const query = {
      _id: args.orderId,
      $or: [{ user: customerId }, { userId: customerId }]
    };

    // MEMORY FIX: Use .lean() to avoid heavy Mongoose object overhead
    const order = await Order.findOne(query)
      .select('isPaid paidAt paymentMethod paymentMode totalPrice totalPaise')
      .lean();

    if (!order) {
      return { success: false, message: 'Order not found or access denied.' };
    }

    // Standardize price and accurately determine if prepaid
    const amount = `₹${(order.totalPaise || (order.totalPrice ? order.totalPrice * 100 : 0)) / 100}`;
    const isPrepaid = order.isPaid || !['cod', 'cash'].includes(String(order.paymentMethod || order.paymentMode || '').toLowerCase());

    return {
      success: true,
      data: {
        orderId: order._id.toString(),
        isPaid: isPrepaid,
        paidAt: order.paidAt || null,
        paymentMethod: order.paymentMethod || order.paymentMode || 'Unknown',
        amount: amount
      }
    };
  } catch (error) {
    console.error('Get Payment Status Tool Error:', error.message);
    return { error: 'Failed to verify payment status.' };
  }
};

module.exports = { getPaymentStatus };