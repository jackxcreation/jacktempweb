const { Order } = require('../models');
const { POLICIES } = require('../services/support/supportPolicyService');

const getReplacementEligibility = async (args, customerId) => {
  if (!customerId || !args.orderId) return { error: 'Auth and Order ID required.' };

  try {
    const order = await Order.findOne({ _id: args.orderId, user: customerId }).select('status isDelivered deliveredAt');
    if (!order) return { error: 'Order not found.' };

    if (!order.isDelivered || order.status !== 'DELIVERED') {
      return { success: true, data: { isEligible: false, reason: 'Order is not delivered yet.' } };
    }

    const daysSinceDelivery = (Date.now() - new Date(order.deliveredAt).getTime()) / (1000 * 60 * 60 * 24);
    const isWithinWindow = daysSinceDelivery <= POLICIES.RETURN_WINDOW_DAYS;

    return {
      success: true,
      data: {
        orderId: order._id,
        isEligible: isWithinWindow,
        reason: isWithinWindow ? 'Within replacement window.' : `Replacement window of ${POLICIES.RETURN_WINDOW_DAYS} days has expired.`
      }
    };
  } catch (error) {
    return { error: 'Failed to verify replacement eligibility.' };
  }
};

module.exports = { getReplacementEligibility };