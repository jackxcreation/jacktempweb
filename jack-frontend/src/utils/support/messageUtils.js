// jack-frontend/src/utils/support/messageUtils.js

/**
 * Normalizes raw responses into a safe, predictable format for UI rendering.
 */
export const normalizeAIResponse = (rawResponse) => {
  if (!rawResponse) {
    return { 
      text: "I'm sorry, I couldn't process that. Please try again.", 
      type: 'text', 
      triggerEscalation: false, 
      structuredData: null 
    };
  }

  let text = typeof rawResponse === 'string' ? rawResponse.trim() : rawResponse.text || "";
  let triggerEscalation = false;
  let structuredData = null;

  // Handle Escalation Tags
  if (text.includes("[TRANSFER_TO_AGENT]")) {
    text = text.replace("[TRANSFER_TO_AGENT]", "").trim() || "Transferring you to a live support agent...";
    triggerEscalation = true;
  }

  // Safely Parse AI Markdown JSON Blocks (```json ... ```)
  const jsonRegex = /```json\n([\s\S]*?)\n```/;
  const match = text.match(jsonRegex);
  
  if (match && match[1]) {
    try {
      structuredData = JSON.parse(match[1]);
      text = text.replace(jsonRegex, '').trim(); 
    } catch (e) {
      console.error("Frontend normalization failed to parse structured data:", e);
    }
  }

  // Fallback for direct JSON objects from backend
  if (!structuredData && typeof rawResponse === 'object' && rawResponse.data) {
    structuredData = rawResponse;
    text = rawResponse.text || "";
  }

  return {
    text,
    triggerEscalation,
    structuredData
  };
};

/**
 * Generates an optimistic user message object with stable IDs.
 */
export const createOptimisticUserMessage = (text) => ({
  id: `usr-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
  sender: 'user',
  type: 'text',
  text,
  status: 'sending',
  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
});