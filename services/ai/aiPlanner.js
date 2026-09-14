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

Respond ONLY with a valid JSON object matching this schema (no extra text or markdown formatting if possible):
{
  "intent": "string (e.g., track_order, refund_inquiry, general_chat)",
  "requiresEscalation": boolean (true if user explicitly demands a human, is abusive, or has a complex legal issue),
  "tools": [
    { "name": "tool_name", "args": { "paramName": "value" } }
  ]
}
`;

  try {
    // 🔥 FIX: Switched from deprecated Groq model to Gemini-3.5-flash
    const rawResponse = await callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userText || "" }
    ], "gemini-3.5-flash", true); // JSON mode enabled

    // 🔥 FIX: Robustly parse response whether it returns as an object or a text string with markdown
    let parsedResponse = rawResponse;
    
    if (typeof rawResponse === 'string') {
      let cleanText = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedResponse = JSON.parse(cleanText);
    } else if (rawResponse && rawResponse.content && typeof rawResponse.content === 'string') {
      let cleanText = rawResponse.content.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedResponse = JSON.parse(cleanText);
    } else if (rawResponse && rawResponse.message && typeof rawResponse.message.content === 'string') {
      let cleanText = rawResponse.message.content.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedResponse = JSON.parse(cleanText);
    }

    return {
      intent: parsedResponse?.intent || "general_chat",
      requiresEscalation: Boolean(parsedResponse?.requiresEscalation),
      tools: Array.isArray(parsedResponse?.tools) ? parsedResponse.tools : [],
      language: languageMeta.style
    };
  } catch (error) {
    console.error("AI Planner Error:", error);
    // Safe fallback: escalate if we can't plan or parse JSON
    return { 
      intent: "unknown", 
      requiresEscalation: true, 
      tools: [], 
      language: languageMeta.style 
    };
  }
};

module.exports = { analyzeIntent };