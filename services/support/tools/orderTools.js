// tools/orderTools.js
const mongoose = require('mongoose');

// 🔥 IMPORT FIX: Assuming file is in root/tools/ folder
const { Order, Product, User } = require('../models');

/**
 * 🛠️ Fetches the order status and delivery tracking details. (Tumhara purana function)
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

/**
 * 🛠️ Get Order Details by ID (New: Used by AI Agent / Support Orchestrator)
 */
const getOrderDetails = async (orderId, userId = null) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return { success: false, message: "Invalid Order ID format." };
    }

    const query = { _id: orderId };
    if (userId) query.userId = userId; // Ensure user can only query their own order

    const order = await Order.findOne(query)
      .select('orderNumber status totalAmount totalPaise createdAt items paymentDetails shipment')
      .lean();

    if (!order) {
      return { success: false, message: 'Order not found or you do not have permission to access it.' };
    }

    return { success: true, order };
  } catch (error) {
    console.error("Tool Error [getOrderDetails]:", error.message);
    return { success: false, message: 'Database error while fetching order details.' };
  }
};

/**
 * 🛠️ Get Recent Orders for a User (New: Used by AI Agent / Support Orchestrator)
 */
const getRecentOrders = async (userId, limit = 5) => {
  try {
    if (!userId) {
      return { success: false, message: 'User ID is required.' };
    }

    const orders = await Order.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('orderNumber status totalAmount createdAt items shipment')
      .lean();

    return { success: true, orders };
  } catch (error) {
    console.error("Tool Error [getRecentOrders]:", error.message);
    return { success: false, message: 'Failed to fetch recent orders.' };
  }
};

/**
 * 🛠️ Request Order Cancellation (New: Used by AI Agent / Support Orchestrator)
 */
const requestOrderCancellation = async (orderId, userId, reason = "Requested via Support") => {
  try {
    const order = await Order.findOne({ _id: orderId, userId });
    
    if (!order) {
      return { success: false, message: 'Order not found.' };
    }

    // Strict state machine validation for cancellation
    const allowedCancelStates = ['Pending', 'Processing'];
    if (!allowedCancelStates.includes(order.status)) {
      return { 
        success: false, 
        message: `Cannot cancel this order. Current status is '${order.status}'. Please connect to a human agent.` 
      };
    }

    // Update status to Cancelled
    order.status = 'Cancelled';
    order.adminNotes = `AI/User Requested Cancellation: ${reason}`;
    await order.save();

    return { 
      success: true, 
      message: 'Order has been successfully cancelled.', 
      newStatus: order.status 
    };
  } catch (error) {
    console.error("Tool Error [requestOrderCancellation]:", error.message);
    return { success: false, message: 'Failed to cancel the order due to a system error.' };
  }
};

// 🔥 Exporting ALL functions so no route crashes
module.exports = {
  getOrderStatus,
  getOrderDetails,
  getRecentOrders,
  requestOrderCancellation
};