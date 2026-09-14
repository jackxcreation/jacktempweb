const mongoose = require('mongoose');
const { User, Order } = require('../models');

const getCustomerProfile = async (args, customerId) => {
  if (!customerId) return { error: 'User is not authenticated.' };

  // Prevent Mongoose CastError if customerId is a guest string or invalid object id
  if (typeof customerId === 'string' && !mongoose.Types.ObjectId.isValid(customerId)) {
    return { error: 'Invalid customer profile session.' };
  }

  try {
    // 🔥 MEMORY FIX: Added .lean() for faster execution and lower memory overhead
    const user = await User.findById(customerId).select('name email phone createdAt').lean();
    
    if (!user) return { error: 'Customer profile not found.' };

    return {
      success: true,
      data: {
        id: user._id.toString(),
        name: user.name || 'Valued Customer',
        email: user.email || 'N/A',
        phone: user.phone || 'Not provided',
        memberSince: user.createdAt
      }
    };
  } catch (error) {
    console.error('Customer Profile Tool Error:', error.message);
    return { error: 'Failed to fetch customer profile.' };
  }
};

const getCustomerOrders = async (args, customerId) => {
  if (!customerId) return { error: 'User is not authenticated.' };

  // Prevent Mongoose CastError if customerId is a guest string or invalid object id
  if (typeof customerId === 'string' && !mongoose.Types.ObjectId.isValid(customerId)) {
    return { error: 'Invalid customer session for orders.' };
  }

  try {
    // 🔥 SCHEMA FIX: Support both 'user' and 'userId' fields to prevent IDOR tracking failures
    const query = { $or: [{ user: customerId }, { userId: customerId }] };

    // 🔥 MEMORY FIX: Added .lean() to prevent memory bloat
    const orders = await Order.find(query)
      .sort({ createdAt: -1 }) // Latest orders first
      .limit(5)
      .select('_id totalPrice totalPaise status expectedDelivery createdAt')
      .lean();

    return {
      success: true,
      data: {
        recentOrders: orders.map(o => ({
          orderId: o._id.toString(),
          status: o.status || 'PROCESSING',
          // 🔥 PRICING FIX: Standardized currency parsing (Prioritize paise, fallback to price)
          totalAmount: `₹${(o.totalPaise || (o.totalPrice ? o.totalPrice * 100 : 0)) / 100}`,
          expectedDelivery: o.expectedDelivery || 'TBD',
          date: o.createdAt
        }))
      }
    };
  } catch (error) {
    console.error('Customer Orders Tool Error:', error.message);
    return { error: 'Failed to fetch customer orders.' };
  }
};

module.exports = { getCustomerProfile, getCustomerOrders };