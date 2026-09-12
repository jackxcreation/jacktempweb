const { Order } = require('../models'); // Ensure this is '../models'

const getShipmentTimeline = async (args, customerId) => {
  if (!customerId || !args.orderId) return { error: 'Auth and Order ID required.' };

  try {
    const order = await Order.findOne({ _id: args.orderId, user: customerId })
      .select('status trackingNumber courier expectedDelivery isDelivered deliveredAt');

    if (!order) return { error: 'Order not found.' };

    return {
      success: true,
      data: {
        orderId: order._id,
        status: order.status || (order.isDelivered ? 'DELIVERED' : 'PROCESSING'),
        awb: order.trackingNumber || 'Pending Tracking',
        courier: order.courier || 'Jack Essentials Logistics',
        expectedDelivery: order.expectedDelivery || 'Calculation pending',
        deliveredAt: order.deliveredAt || null
      }
    };
  } catch (error) {
    return { error: 'Failed to retrieve shipment timeline.' };
  }
};

module.exports = { getShipmentTimeline };