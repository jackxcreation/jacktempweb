const { Order } = require('../models');

const getPaymentStatus = async (args, customerId) => {
  if (!customerId || !args.orderId) return { error: 'Order ID and Auth required.' };

  try {
    const order = await Order.findOne({ _id: args.orderId, user: customerId })
      .select('isPaid paidAt paymentMethod totalPrice');

    if (!order) return { error: 'Order not found.' };

    return {
      success: true,
      data: {
        orderId: order._id,
        isPaid: order.isPaid,
        paidAt: order.paidAt || null,
        paymentMethod: order.paymentMethod || 'Unknown',
        amount: order.totalPrice
      }
    };
  } catch (error) {
    return { error: 'Failed to verify payment status.' };
  }
};

module.exports = { getPaymentStatus };