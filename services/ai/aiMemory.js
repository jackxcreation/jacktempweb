/**
 * Summarizes or structures past conversation memory to send to the LLM
 */
const buildContextWindow = (messages, maxMessages = 10) => {
  if (!messages || !Array.isArray(messages)) return [];

  // Sort by time just in case, and take the last N messages
  const recentMessages = messages
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .slice(-maxMessages);

  // Map to LLM role format
  const formattedMemory = recentMessages
    .filter(msg => msg.senderType !== 'SYSTEM' && !msg.isInternal) // Exclude internal logs
    .map(msg => ({
      role: msg.senderType === 'CUSTOMER' ? 'user' : 'assistant',
      content: msg.content || ""
    }));

  return formattedMemory;
};

/**
 * Extracts key entities like order IDs from the conversation memory
 */
const extractActiveEntities = (messages) => {
  const activeOrderId = null;
  // Complex entity extraction logic can go here (e.g., scanning recent tool results)
  return { activeOrderId };
};

module.exports = { buildContextWindow, extractActiveEntities };