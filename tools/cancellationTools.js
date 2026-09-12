const { Order } = require('../models');
const { POLICIES } = require('../services/support/supportPolicyService');

const getCancellationEligibility = async (args, customerId) => {
  if (!customerId || !args.orderId) {
    return { error: 'Customer ID and Order ID are required to check cancellation eligibility.' };
  }

  try {
    const order = await Order.findOne({ _id: args.orderId, user: customerId }).select('status isPaid');
    if (!order) return { error: 'Order not found.' };

    const isEligible = POLICIES.ALLOWED_CANCELLATION_STATUSES.includes(order.status);
    
    return {
      success: true,
      data: {
        orderId: order._id,
        currentStatus: order.status,
        isEligible: isEligible,
        reason: isEligible ? 'Order has not been shipped yet.' : 'Order has already been shipped or processed.',
        refundRequired: order.isPaid
      }
    };
  } catch (error) {
    return { error: 'Failed to fetch cancellation eligibility.' };
  }
};

module.exports = { getCancellationEligibility };