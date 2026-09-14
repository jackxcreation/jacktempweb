/**
 * Calculates whether we have enough safe data to answer the user's query.
 * Enhanced with defensive checks to prevent runtime crashes.
 */
const calculate = (plan, toolResults) => {
  let confidence = 1.0;

  // 🔥 DEFENSIVE FIX: Guard against missing or null plan/toolResults objects
  if (!plan) {
    return 0.0; // Zero confidence if no plan exists
  }

  const safeToolResults = toolResults || {};

  // If the planner wanted tools, but none were executed successfully
  if (plan.tools && Array.isArray(plan.tools) && plan.tools.length > 0) {
    const executedTools = Object.keys(safeToolResults);
    
    if (executedTools.length === 0) {
      confidence -= 0.5; // High penalty
    } else {
      // Check if any executed tool returned an error
      let hasError = false;
      for (const toolName of executedTools) {
        if (safeToolResults[toolName] && safeToolResults[toolName].error) {
          hasError = true;
        }
      }
      if (hasError) {
        confidence -= 0.3; // Penalty for partial data failure
      }
    }
  }

  // If intent was completely missed
  if (plan.intent === 'unknown') {
    confidence -= 0.4;
  }

  // Ensure confidence stays strictly between 0 and 1
  return Math.max(0, Math.min(confidence, 1.0));
};

module.exports = { calculate };