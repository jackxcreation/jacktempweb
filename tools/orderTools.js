const { Order } = require('../models'); // Fixed path from '../../models'

const getOrderStatus = async (args, customerId) => {
  if (!customerId) throw new Error('Authentication required to fetch orders.');
  
  const orderQuery = args.orderId 
    ? { _id: args.orderId, user: customerId } 
    : { user: customerId };

  // Fetch from verified MongoDB Atlas source
  const order = await Order.findOne(orderQuery).sort({ createdAt: -1 }).select('totalPrice isPaid isDelivered status expectedDelivery trackingNumber courier');
  
  if (!order) {
    return { success: false, message: 'No matching order found in the system.' };
  }

  return {
    success: true,
    data: {
      orderId: order._id,
      status: order.status || (order.isDelivered ? 'DELIVERED' : 'PROCESSING'),
      isPaid: order.isPaid,
      expectedDelivery: order.expectedDelivery || 'Not scheduled',
      courier: order.courier || 'Pending Assignment',
      awb: order.trackingNumber || null
    }
  };
};

module.exports = { getOrderStatus };