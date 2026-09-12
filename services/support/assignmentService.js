const SupportAgent = require('../../models/SupportAgent');
const SupportTicket = require('../../models/SupportTicket');

const assignTicket = async (ticket) => {
  try {
    // Find online agents with the least active tickets
    const availableAgents = await SupportAgent.find({
      status: 'ONLINE',
      availability: true,
      $expr: { $lt: ['$currentActiveTickets', '$maxConcurrentTickets'] }
    }).sort({ currentActiveTickets: 1 });

    if (availableAgents.length > 0) {
      const assignedAgent = availableAgents[0];
      
      // Update ticket
      ticket.assignedAgentId = assignedAgent.userId;
      ticket.status = 'ASSIGNED';
      await ticket.save();

      // Update agent workload
      assignedAgent.currentActiveTickets += 1;
      await assignedAgent.save();

      return assignedAgent;
    }
    
    // Fallback: Leave unassigned in the queue
    ticket.status = 'PENDING';
    await ticket.save();
    return null;
  } catch (error) {
    console.error('Assignment Service Error:', error);
    return null;
  }
};

module.exports = { assignTicket };