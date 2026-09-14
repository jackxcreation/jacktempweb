const { callLLM } = require('./aiGateway');

/**
 * Synthesizes the final response. 
 * Converts verified tool data into natural language and UI structured blocks.
 */
const generate = async (userText, toolResults, languageStyle = 'english') => {
  const toolResultsString = JSON.stringify(toolResults || {});

  const systemPrompt = `
You are Jack, the premium AI support agent for Jack Essentials.
Your job is to answer the user's question using ONLY the provided verified backend data.

VERIFIED BACKEND DATA:
${toolResultsString}

RULES:
1. NEVER invent, guess, or hallucinate order statuses, refund dates, prices, or shipping times.
2. If the data says "error" or data is missing, politely say you cannot verify the information right now and offer human support.
3. Reply strictly in the requested language/style: ${languageStyle} (e.g., if style is 'hinglish', reply in natural Hinglish).
4. Be concise, polite, and professional.

UI RENDERING (CRITICAL):
If the verified data contains order tracking information, you MUST include a JSON block at the end of your message exactly like this so the frontend can render a rich card:
\`\`\`json
{
  "type": "order_tracking",
  "data": {
    "orderId": "id_from_data",
    "status": "status_from_data",
    "expectedDelivery": "date_from_data",
    "awb": "tracking_from_data"
  }
}
\`\`\`
Do not use the JSON block if you do not have verified order data.
`;

  try {
    const rawResponse = await callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userText || "Hello" }
    ]);

    // Handle different response formats safely from the gateway
    const finalContent = typeof rawResponse === 'string' 
      ? rawResponse 
      : (rawResponse?.content || rawResponse?.message?.content || JSON.stringify(rawResponse));

    // Parse out type for the orchestrator
    let type = 'text';
    if (finalContent.includes('```json') && finalContent.includes('"type": "order_tracking"')) {
      type = 'order_tracking';
    }

    return {
      text: finalContent,
      type: type
    };
  } catch (error) {
    console.error("AI Response Generation Error:", error);
    
    // 🔥 Localized fallback based on user's language style
    const fallbackText = languageStyle === 'hinglish' 
      ? "Bhai, abhi thoda technical issue aa raha hai. Main aapko human agent se connect kar raha hoon." 
      : "I'm currently facing a technical issue. Let me connect you to a human agent.";

    return { 
      text: fallbackText, 
      type: "text", 
      failed: true 
    };
  }
};

module.exports = { generate };