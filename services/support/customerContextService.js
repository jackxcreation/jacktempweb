const { User, Order } = require('../../models');
const SupportTicket = require('../../models/SupportTicket');

const buildCustomerContext = async (customerId) => {
  if (!customerId) return null;

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
      user: { id: user._id, name: user.name, email: user.email },
      recentOrders,
      openTickets
    };
  } catch (error) {
    console.error('Customer Context Service Error:', error);
    return null;
  }
};

module.exports = { buildCustomerContext };