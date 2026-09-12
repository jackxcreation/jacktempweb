const { Order } = require('../models');

const getRefundStatus = async (args, customerId) => {
  if (!customerId || !args.orderId) return { error: 'Auth and Order ID required.' };

  try {
    const order = await Order.findOne({ _id: args.orderId, user: customerId })
      .select('status isPaid paymentMethod totalPrice refundStatus');

    if (!order) return { error: 'Order not found.' };

    if (!order.isPaid) {
      return { success: true, data: { status: 'NO_REFUND_DUE', reason: 'Order was not paid.' } };
    }

    // Determine refund status based on standard lifecycle
    let refundStatus = order.refundStatus || 'PENDING';
    if (order.status !== 'CANCELLED' && order.status !== 'RETURNED') {
      refundStatus = 'NOT_APPLICABLE';
    }

    return {
      success: true,
      data: {
        orderId: order._id,
        refundStatus: refundStatus,
        amount: order.totalPrice,
        method: order.paymentMethod,
        estimatedDays: refundStatus === 'PENDING' ? '5-7 business days' : null
      }
    };
  } catch (error) {
    return { error: 'Failed to fetch refund status.' };
  }
};

module.exports = { getRefundStatus };