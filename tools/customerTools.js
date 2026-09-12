const { User, Order } = require('../models');

const getCustomerProfile = async (args, customerId) => {
  if (!customerId) return { error: 'User is not authenticated.' };

  try {
    const user = await User.findById(customerId).select('name email phone createdAt');
    if (!user) return { error: 'Customer profile not found.' };

    return {
      success: true,
      data: {
        name: user.name,
        email: user.email,
        phone: user.phone || 'Not provided',
        memberSince: user.createdAt
      }
    };
  } catch (error) {
    return { error: 'Failed to fetch customer profile.' };
  }
};

const getCustomerOrders = async (args, customerId) => {
  if (!customerId) return { error: 'User is not authenticated.' };

  try {
    const orders = await Order.find({ user: customerId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('totalPrice status expectedDelivery createdAt');

    return {
      success: true,
      data: {
        recentOrders: orders.map(o => ({
          orderId: o._id,
          status: o.status,
          total: o.totalPrice,
          date: o.createdAt
        }))
      }
    };
  } catch (error) {
    return { error: 'Failed to fetch customer orders.' };
  }
};

module.exports = { getCustomerProfile, getCustomerOrders };