const mongoose = require('mongoose');
const { Order } = require('../models');
const { POLICIES } = require('../services/support/supportPolicyService');

/**
 * Checks whether an order is eligible for replacement.
 * Enhanced with ID validation, lean querying, and robust date/policy checks.
 */
const getReplacementEligibility = async (args = {}, customerId) => {
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
    // SCHEMA FIX: Support both 'user' and 'userId'
    const query = {
      _id: args.orderId,
      $or: [{ user: customerId }, { userId: customerId }]
    };

    // MEMORY FIX: .lean() for faster AI tool execution
    const order = await Order.findOne(query)
      .select('status isDelivered deliveredAt createdAt')
      .lean();
      
    if (!order) {
      return { success: false, message: 'Order not found or access denied.' };
    }

    const currentStatus = String(order.status || '').toUpperCase();

    if (!order.isDelivered && currentStatus !== 'DELIVERED') {
      return { 
        success: true, 
        data: { 
          orderId: order._id.toString(),
          isEligible: false, 
          reason: 'Order is not delivered yet.' 
        } 
      };
    }

    // Use deliveredAt or fallback to createdAt if deliveredAt is not explicitly set
    const referenceDate = order.deliveredAt || order.createdAt;
    const deliveryTime = new Date(referenceDate).getTime();
    
    if (isNaN(deliveryTime)) {
      return { 
        success: true, 
        data: { 
          orderId: order._id.toString(), 
          isEligible: false, 
          reason: 'Invalid delivery date recorded in the system.' 
        } 
      };
    }

    // POLICY FIX: Ensure a fallback exists if POLICIES object fails to load
    const windowDays = POLICIES.RETURN_WINDOW_DAYS || 7;
    const daysSinceDelivery = (Date.now() - deliveryTime) / (1000 * 60 * 60 * 24);
    
    // Ensure negative days (future dates) aren't counted incorrectly
    if (daysSinceDelivery < 0) {
      return {
        success: true,
        data: {
          orderId: order._id.toString(),
          isEligible: true,
          reason: 'Within replacement window.'
        }
      };
    }

    const isWithinWindow = daysSinceDelivery <= windowDays;

    return {
      success: true,
      data: {
        orderId: order._id.toString(),
        isEligible: isWithinWindow,
        reason: isWithinWindow ? 'Within replacement window.' : `Replacement window of ${windowDays} days has expired.`
      }
    };
  } catch (error) {
    console.error('Get Replacement Eligibility Tool Error:', error.message);
    return { error: 'Failed to verify replacement eligibility due to a server error.' };
  }
};

module.exports = { getReplacementEligibility };