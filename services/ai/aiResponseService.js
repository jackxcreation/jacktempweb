const { callLLM } = require('./aiGateway');

/**
 * Synthesizes the final response. 
 * Converts verified tool data into natural language and UI structured blocks.
 */
const generate = async (userText, toolResults, languageStyle) => {
  const toolResultsString = JSON.stringify(toolResults || {});

  const systemPrompt = `
You are Jack, the premium AI support agent for Jack Essentials.
Your job is to answer the user's question using ONLY the provided verified backend data.

VERIFIED BACKEND DATA:
${toolResultsString}

RULES:
1. NEVER invent, guess, or hallucinate order statuses, refund dates, prices, or shipping times.
2. If the data says "error" or data is missing, politely say you cannot verify the information right now and offer human support.
3. Reply in the exact same language/style as the user (e.g., if user speaks Hinglish, reply in Hinglish).
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
    const finalContent = await callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userText }
    ]);

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
    return { text: "I'm currently facing a technical issue. Let me connect you to a human agent.", type: "text", failed: true };
  }
};

module.exports = { generate };