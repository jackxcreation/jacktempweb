// services/support/responsePolicy.js

/**
 * Enterprise AI Response Policy & Anti-Hallucination Guard (Task #36)
 * Enforces strict verification rules: No database evidence -> No status claim -> Escalate.
 */
const enforceResponsePolicy = (userQuery, toolExecuted, toolResult) => {
  const queryLower = (userQuery || '').toLowerCase();
  
  // Keywords indicating order status or tracking inquiries
  const isOrderStatusQuery = /order|status|tracking|where is my|delivery|shipped|package|dispatch|return|refund/i.test(queryLower);

  // If user is asking about order status but no tool was executed or tool returned an error/no data
  if (isOrderStatusQuery) {
    if (!toolExecuted || !toolResult || toolResult.error || toolResult.success === false) {
      return {
        safe: false,
        fallbackReply: "Mujhe aapke order ya shipment ki database mein koi active record nahi mila. Main ise manual verification ke liye human support agent ke paas escalate kar raha hoon. Kripya thoda intezaar karein. [TRANSFER_TO_AGENT]"
      };
    }
  }

  return { safe: true };
};

module.exports = {
  enforceResponsePolicy
};