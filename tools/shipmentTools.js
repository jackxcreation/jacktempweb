const mongoose = require('mongoose');
const { Order } = require('../models');

/**
 * Retrieves shipment timeline and delivery tracking details.
 * Enhanced with ID validation, .lean() memory optimization, and 3PL integration.
 */
const getShipmentTimeline = async (args = {}, customerId) => {
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
      .select('status trackingNumber shiprocketAwb shiprocketOrderId courier expectedDelivery isDelivered deliveredAt')
      .lean();

    if (!order) {
      return { success: false, message: 'Order not found or access denied.' };
    }

    return {
      success: true,
      data: {
        orderId: order._id.toString(),
        status: order.status || (order.isDelivered ? 'DELIVERED' : 'PROCESSING'),
        // LOGISTICS FIX: Support 3PL Shiprocket AWBs along with standard tracking
        awb: order.shiprocketAwb || order.trackingNumber || order.shiprocketOrderId || 'Pending Tracking',
        courier: order.courier || 'Pending Assignment',
        expectedDelivery: order.expectedDelivery || 'Calculation pending',
        deliveredAt: order.deliveredAt || null
      }
    };
  } catch (error) {
    console.error('Get Shipment Timeline Tool Error:', error.message);
    return { error: 'Failed to retrieve shipment timeline due to a server error.' };
  }
};

module.exports = { getShipmentTimeline };