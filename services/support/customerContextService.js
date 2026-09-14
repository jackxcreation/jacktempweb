const mongoose = require('mongoose');
const { User, Order } = require('../../models');
const SupportTicket = require('../../models/SupportTicket');

/**
 * Builds customer context for the AI agent using verified DB data.
 */
const buildCustomerContext = async (customerId) => {
  if (!customerId) return null;

  // 🔥 DEFENSIVE FIX: Prevent Mongoose CastError if customerId is a guest string or invalid object id
  if (typeof customerId === 'string' && !mongoose.Types.ObjectId.isValid(customerId)) {
    return null;
  }

  try {
    const user = await User.findById(customerId).select('name email phone');
    if (!user) return null;

    // Get 3 most recent orders for context
    const recentOrders = await Order.find({ user: customerId })
      .sort({ createdAt: -1 })
      .limit(3)
      .select('_id totalPrice status expectedDelivery createdAt');

    // Check if they have open tickets
    const openTickets = await SupportTicket.find({ 
      customerId, 
      status: { $in: ['OPEN', 'PENDING', 'ASSIGNED', 'IN_PROGRESS'] } 
    }).select('ticketNumber status priority');

    return {
      user: { id: user._id, name: user.name, email: user.email, phone: user.phone },
      recentOrders,
      openTickets
    };
  } catch (error) {
    console.error('Customer Context Service Error:', error);
    return null;
  }
};

/**
 * 🔥 NEW HELPER: Formats customer context into a concise string for LLM system prompts
 */
const formatContextForLLM = (context) => {
  if (!context || !context.user) return "No user context available (Guest User).";

  const { user, recentOrders, openTickets } = context;
  
  let summary = `CUSTOMER PROFILE:\n- Name: ${user.name}\n- Email: ${user.email}\n`;
  
  if (recentOrders && recentOrders.length > 0) {
    summary += `\nRECENT ORDERS:\n`;
    recentOrders.forEach((o, idx) => {
      summary += `${idx + 1}. Order ID: ${o._id}, Status: ${o.status}, Total: ₹${o.totalPrice}, Delivery: ${o.expectedDelivery || 'TBD'}\n`;
    });
  } else {
    summary += `\nRECENT ORDERS: None found.\n`;
  }

  if (openTickets && openTickets.length > 0) {
    summary += `\nOPEN TICKETS:\n`;
    openTickets.forEach((t) => {
      summary += `- Ticket #${t.ticketNumber || 'N/A'} (Status: ${t.status}, Priority: ${t.priority})\n`;
    });
  }

  return summary;
};

module.exports = { 
  buildCustomerContext, 
  formatContextForLLM 
};