const SupportAgent = require('../../models/SupportAgent');
const SupportTicket = require('../../models/SupportTicket');

const assignTicket = async (ticket, io = null) => {
  try {
    // 🔥 FIX: Used atomic findOneAndUpdate with $inc to prevent race conditions 
    // when multiple users raise tickets simultaneously.
    const assignedAgent = await SupportAgent.findOneAndUpdate(
      {
        status: 'ONLINE',
        availability: true,
        $expr: { $lt: ['$currentActiveTickets', '$maxConcurrentTickets'] }
      },
      { 
        $inc: { currentActiveTickets: 1 },
        $set: { lastActiveAt: Date.now() }
      },
      { 
        sort: { currentActiveTickets: 1 }, 
        new: true 
      }
    );

    if (assignedAgent) {
      // Update ticket assignment details
      ticket.assignedAgentId = assignedAgent.userId;
      ticket.status = 'ASSIGNED';
      await ticket.save();

      // 🔥 FIX: Real-time Socket Broadcast so dashboard updates instantly
      if (io) {
        io.emit('ticketUpdated', ticket);
        io.emit('agentWorkloadUpdated', { 
          agentId: assignedAgent._id, 
          currentActiveTickets: assignedAgent.currentActiveTickets 
        });
      }

      return assignedAgent;
    }
    
    // Fallback: Leave unassigned in the queue as PENDING if no agents are free
    ticket.status = 'PENDING';
    ticket.assignedAgentId = null;
    await ticket.save();

    if (io) {
      io.emit('ticketUpdated', ticket);
    }

    return null;
  } catch (error) {
    console.error('Assignment Service Error:', error);
    return null;
  }
};

module.exports = { assignTicket };