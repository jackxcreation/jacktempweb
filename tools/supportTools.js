/**
 * Safe tool to instruct the orchestrator that the AI explicitly determined 
 * a human is needed without crashing or breaking the loop.
 * Enhanced with strict type validation and enum enforcement.
 */
const requestHumanAgent = async (args = {}) => {
  // STRICT TYPING FIX: Ensure arguments are actually strings to prevent payload injection
  const safeReason = typeof args.reason === 'string' 
    ? args.reason.trim() 
    : 'User explicitly requested a human agent or issue is too complex.';
    
  const safePriority = typeof args.priority === 'string' 
    ? args.priority.trim().toUpperCase() 
    : 'MEDIUM';
    
  const safeCategory = typeof args.category === 'string' 
    ? args.category.trim().toUpperCase() 
    : 'SUPPORT_ESCALATION';

  // ENUM FIX: Validate priority against known system thresholds
  const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
  const finalPriority = validPriorities.includes(safePriority) ? safePriority : 'MEDIUM';

  return {
    success: true,
    data: {
      action: 'TRIGGER_ESCALATION',
      reason: safeReason,
      priority: finalPriority,
      category: safeCategory,
      timestamp: Date.now()
    }
  };
};

/**
 * Validates whether a tool result payload explicitly requests human escalation.
 */
const isEscalationRequested = (toolResult) => {
  if (!toolResult || !toolResult.success || !toolResult.data) return false;
  return toolResult.data.action === 'TRIGGER_ESCALATION';
};

module.exports = { 
  requestHumanAgent, 
  isEscalationRequested 
};