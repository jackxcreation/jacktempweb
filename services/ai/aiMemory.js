/**
 * Summarizes or structures past conversation memory to send to the LLM
 */
const buildContextWindow = (messages, maxMessages = 10) => {
  if (!messages || !Array.isArray(messages)) return [];

  // 🔥 DEFENSIVE FIX: Ensure safe date comparison even if createdAt is missing
  const sortedMessages = [...messages].sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeA - timeB;
  });

  // Take the last N messages
  const recentMessages = sortedMessages.slice(-maxMessages);

  // Map to LLM role format safely
  const formattedMemory = recentMessages
    .filter(msg => msg && msg.senderType !== 'SYSTEM' && !msg.isInternal) // Exclude internal logs
    .map(msg => {
      const isCustomer = msg.senderType === 'CUSTOMER' || msg.senderType === 'USER' || msg.senderType === 'GUEST';
      return {
        role: isCustomer ? 'user' : 'assistant',
        content: msg.content || ""
      };
    });

  return formattedMemory;
};

/**
 * Extracts key entities like order IDs from the conversation memory
 */
const extractActiveEntities = (messages) => {
  let activeOrderId = null;

  // 🔥 UPGRADE: Automatically scan conversation history for order IDs
  if (messages && Array.isArray(messages) && messages.length > 0) {
    // Scan messages from newest to oldest to find the most recent order mention
    for (let i = messages.length - 1; i >= 0; i--) {
      const text = messages[i]?.content || "";
      if (typeof text === 'string') {
        // Match patterns like "order id 12345", "order no: ORD-987", etc.
        const orderIdRegex = /(?:order\s*(?:id|no\.?|number)?[:\s#]*)([a-zA-Z0-9_-]{6,24})/i;
        const match = text.match(orderIdRegex);
        
        if (match && match[1]) {
          activeOrderId = match[1];
          break;
        }

        // Fallback matcher for hash-prefixed order strings containing digits
        const hashMatch = text.match(/#([a-zA-Z0-9_-]{6,20})/);
        if (hashMatch && hashMatch[1] && !activeOrderId) {
          if (/\d/.test(hashMatch[1])) {
            activeOrderId = hashMatch[1];
            break;
          }
        }
      }
    }
  }

  return { activeOrderId };
};

module.exports = { buildContextWindow, extractActiveEntities };