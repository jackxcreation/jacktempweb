const { callLLM } = require('./aiGateway');
const { detectLanguage } = require('./languageService');

/**
 * Analyzes user intent and maps it to required backend tools.
 * NEVER retrieves data itself, only plans the execution.
 */
const analyzeIntent = async (userText, conversationId) => {
  const languageMeta = detectLanguage(userText);

  const systemPrompt = `
You are an intent analyzer for an e-commerce store (Jack Essentials).
Analyze the user's message and determine if any backend tools are needed to fulfill the request.

Available Tools:
1. "getOrderStatus" - Use if the user asks where their order is, tracking, delivery time. Args needed: none (or orderId if provided).
2. "getRefundStatus" - Use if the user asks about a refund or money back.
3. "getShipmentTimeline" - Use if the user asks for detailed tracking steps.

Respond ONLY with a valid JSON object matching this schema:
{
  "intent": "string (e.g., track_order, refund_inquiry, general_chat)",
  "requiresEscalation": boolean (true if user explicitly demands a human, is abusive, or has a complex legal issue),
  "tools": [
    { "name": "tool_name", "args": { "paramName": "value" } }
  ]
}
`;

  try {
    const response = await callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userText }
    ], "allam-2-7b", true); // Ensure JSON mode is ON

    return {
      ...response,
      language: languageMeta.style
    };
  } catch (error) {
    console.error("AI Planner Error:", error);
    // Safe fallback: escalate if we can't plan
    return { intent: "unknown", requiresEscalation: true, tools: [], language: languageMeta.style };
  }
};

module.exports = { analyzeIntent };