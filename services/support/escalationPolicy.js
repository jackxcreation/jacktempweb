// services/support/escalationPolicy.js

/**
 * Enterprise Deterministic Escalation Policy (Task #38)
 * Evaluates user messages and chat context against critical business triggers 
 * to automatically and reliably trigger human agent escalation.
 */

const ESCALATION_TRIGGERS = {
  PAYMENT_DISPUTE: /payment|charged twice|deducted|transaction failed|money debited|paisa kat gaya/i,
  REFUND_DISPUTE: /refund|money back|return amount|paisa nahi aaya|wapas karo/i,
  ACCOUNT_SECURITY: /hack|unauthorized|password reset|blocked|lock|compromised|account safe nahi/i,
  LEGAL_COMPLAINT: /consumer court|legal|fraud|cyber cell|complaint|sue|case karunga/i,
  ANGRY_FAILURE: /worst|useless|cheat|scam|bakwas|bekaar|angry|pareshan|ghatiya/i,
  EXPLICIT_REQUEST: /human agent|talk to human|customer care|real person|agent se baat|insan se baat/i
};

/**
 * Evaluates whether a conversation needs to be escalated to a human agent.
 * 
 * @param {string} message - Current customer message
 * @param {Array} chatHistory - Previous messages in the conversation
 * @param {number} [aiConfidence=1.0] - Optional AI confidence score (0.0 to 1.0)
 * @returns {{ shouldEscalate: boolean, reason: string|null }}
 */
const evaluateEscalation = (message = '', chatHistory = [], aiConfidence = 1.0) => {
  const text = (message || '').toLowerCase();

  // 1. Check Low AI Confidence
  if (typeof aiConfidence === 'number' && aiConfidence < 0.6) {
    return { shouldEscalate: true, reason: 'LOW_AI_CONFIDENCE' };
  }

  // 2. Check Deterministic Keyword Triggers
  for (const [reason, regex] of Object.entries(ESCALATION_TRIGGERS)) {
    if (regex.test(text)) {
      return { shouldEscalate: true, reason };
    }
  }

  // 3. Check Repeated Failure / Customer Frustration in recent history
  const recentUserMessages = (chatHistory || []).filter(m => m.role === 'user' || m.sender === 'user').slice(-3);
  if (recentUserMessages.length >= 2) {
    const consecutiveFrustration = recentUserMessages.every(m => {
      const content = (m.content || m.text || '').toLowerCase();
      return /again|phir se|nahi hua|same error|solve nahi|koi solution nahi/i.test(content);
    });
    if (consecutiveFrustration) {
      return { shouldEscalate: true, reason: 'REPEATED_FAILURE' };
    }
  }

  return { shouldEscalate: false, reason: null };
};

module.exports = {
  evaluateEscalation,
  ESCALATION_TRIGGERS
};