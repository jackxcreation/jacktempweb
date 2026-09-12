/**
 * Calculates whether we have enough safe data to answer the user's query.
 */
const calculate = (plan, toolResults) => {
  let confidence = 1.0;

  // If the planner wanted tools, but none were executed successfully
  if (plan.tools && plan.tools.length > 0) {
    const executedTools = Object.keys(toolResults);
    
    if (executedTools.length === 0) {
      confidence -= 0.5; // High penalty
    } else {
      // Check if any executed tool returned an error
      let hasError = false;
      for (const toolName of executedTools) {
        if (toolResults[toolName] && toolResults[toolName].error) {
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

  // Ensure confidence stays between 0 and 1
  return Math.max(0, Math.min(confidence, 1.0));
};

module.exports = { calculate };