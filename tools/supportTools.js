/**
 * Safe tool to instruct the orchestrator that the AI explicitly determined 
 * a human is needed without crashing or breaking the loop.
 */
const requestHumanAgent = async (args) => {
  return {
    success: true,
    data: {
      action: 'TRIGGER_ESCALATION',
      reason: args.reason || 'User explicitly requested a human agent or issue is too complex.'
    }
  };
};

module.exports = { requestHumanAgent };