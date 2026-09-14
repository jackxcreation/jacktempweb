// jack-frontend/src/utils/support/messageUtils.js

/**
 * Normalizes raw responses into a safe, predictable format for UI rendering.
 * Enhanced with robust JSON markdown parsing and fallback handling.
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

  let text = "";
  let structuredData = null;
  let triggerEscalation = false;

  // Extract text based on input type
  if (typeof rawResponse === 'string') {
    text = rawResponse.trim();
  } else if (typeof rawResponse === 'object') {
    text = rawResponse.text || rawResponse.content || rawResponse.reply || "";
    if (rawResponse.structuredData) {
      structuredData = rawResponse.structuredData;
    }
  }

  // 1. 🔥 UPGRADE: Use Global Regex to catch multiple tags if AI hallucinates
  if (text.includes("[TRANSFER_TO_AGENT]")) {
    text = text.replace(/\[TRANSFER_TO_AGENT\]/g, "").trim() || "Transferring you to a live support agent...";
    triggerEscalation = true;
  }

  // 2. Robust markdown JSON block regex supporting any spacing or formatting variations
  const jsonRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
  const match = text.match(jsonRegex);
  
  if (match && match[1]) {
    try {
      structuredData = JSON.parse(match[1]);
      text = text.replace(jsonRegex, '').trim(); 
    } catch (e) {
      console.error("Frontend normalization failed to parse structured data:", e);
    }
  }

  // 3. Fallback for direct JSON objects from backend
  if (!structuredData && typeof rawResponse === 'object' && rawResponse.data) {
    structuredData = rawResponse.data;
  }

  return {
    text: text || "Response received.",
    triggerEscalation,
    structuredData: structuredData || null
  };
};

/**
 * Generates an optimistic user message object with stable IDs.
 */
export const createOptimisticUserMessage = (text) => ({
  id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
  // 🔥 UPGRADE: Aligned sender and type with the Backend SupportMessage Schema
  senderType: 'USER', 
  contentType: 'text', 
  content: String(text || "").trim(), // Aligned with backend 'content' field
  status: 'sending',
  time: formatMessageTime()
});

/**
 * Generates an optimistic bot/AI message object for instant UI rendering.
 */
export const createOptimisticBotMessage = (text, structuredData = null) => ({
  id: `bot-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
  // 🔥 UPGRADE: Aligned sender and type with the Backend SupportMessage Schema
  senderType: 'BOT', 
  contentType: structuredData ? 'action_card' : 'text', 
  content: String(text || "").trim(), // Aligned with backend 'content' field
  structuredData,
  status: 'sent',
  time: formatMessageTime()
});

/**
 * Standardized timestamp formatter for chat bubbles.
 */
export const formatMessageTime = (dateInput = new Date()) => {
  // 🔥 UPGRADE: Safely handles JS "Invalid Date" silent failures
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};