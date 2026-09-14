const mongoose = require('mongoose');
const { Order } = require('../models');

/**
 * Fetches the order status and delivery tracking details.
 * Enhanced with ID validation, memory optimization, and robust schema querying.
 */
const getOrderStatus = async (args = {}, customerId) => {
  if (!customerId) {
    return { error: 'Authentication required to fetch orders.' };
  }

  // Prevent Mongoose CastError if customerId is invalid
  if (!mongoose.Types.ObjectId.isValid(customerId)) {
    return { error: 'Invalid customer session format.' };
  }

  // Validate orderId if provided in args
  if (args.orderId && !mongoose.Types.ObjectId.isValid(args.orderId)) {
    return { error: 'Invalid Order ID format provided.' };
  }

  try {
    // 🔥 SCHEMA FIX: Support both 'user' and 'userId' fields securely
    const userMatch = { $or: [{ user: customerId }, { userId: customerId }] };
    
    const orderQuery = args.orderId 
      ? { _id: args.orderId, ...userMatch } 
      : { ...userMatch };

    // 🔥 MEMORY FIX: Added .lean() to prevent memory bloat during AI execution
    const order = await Order.findOne(orderQuery)
      .sort({ createdAt: -1 }) // Get latest if no orderId provided
      .select('totalPrice totalPaise isPaid isDelivered status expectedDelivery trackingNumber shiprocketAwb shiprocketOrderId courier createdAt paymentMethod paymentMode')
      .lean();
    
    if (!order) {
      return { success: false, message: 'No matching order found in the system.' };
    }

    // Standardize price mapping
    const totalAmount = `₹${(order.totalPaise || (order.totalPrice ? order.totalPrice * 100 : 0)) / 100}`;
    
    // Evaluate if paid based on explicit flags or payment method
    const isPrepaid = order.isPaid || !['cod', 'cash'].includes(String(order.paymentMethod || order.paymentMode || '').toLowerCase());

    return {
      success: true,
      data: {
        orderId: order._id.toString(),
        status: order.status || (order.isDelivered ? 'DELIVERED' : 'PROCESSING'),
        isPaid: isPrepaid,
        totalAmount: totalAmount,
        expectedDelivery: order.expectedDelivery || 'Not scheduled',
        courier: order.courier || 'Pending Assignment',
        // 🔥 LOGISTICS FIX: Support Shiprocket AWB along with standard tracking
        awb: order.shiprocketAwb || order.trackingNumber || order.shiprocketOrderId || null,
        orderDate: order.createdAt
      }
    };
  } catch (error) {
    console.error('Get Order Status Tool Error:', error.message);
    return { error: 'Failed to fetch order status from the database.' };
  }
};

module.exports = { getOrderStatus };