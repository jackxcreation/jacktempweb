/**
 * Sanitizes input and ensures outputs don't contain hazardous content
 */
const validateInput = (text) => {
  if (!text || typeof text !== 'string') return false;
  
  // Basic prompt injection deflection
  const maliciousPatterns = [
    /ignore previous instructions/i,
    /system prompt/i,
    /override/i,
    /execute function/i
  ];

  for (const pattern of maliciousPatterns) {
    if (pattern.test(text)) {
      return false; // Input is unsafe
    }
  }

  return true;
};

const sanitizeOutput = (text) => {
  if (!text || typeof text !== 'string') return "";

  // 🔥 FIX: Added Google Gemini API keys (AIzaSy...) along with OpenAI and Groq keys to redaction
  let sanitized = text.replace(/(sk-[a-zA-Z0-9]{32,})|(gsk_[a-zA-Z0-9]{30,})|(AIzaSy[a-zA-Z0-9\-_]{33})/g, "[REDACTED]");
  
  return sanitized;
};

module.exports = { validateInput, sanitizeOutput };