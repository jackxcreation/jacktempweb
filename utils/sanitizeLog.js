// utils/sanitizeLog.js

/**
 * List of sensitive key fragments to look out for (case-insensitive check)
 */
const SENSITIVE_KEYS = [
  'password',
  'currentpassword',
  'newpassword',
  'otp',
  'resetotp',
  'twofactorsecret',
  'token',
  'jwt',
  'secret',
  'authorization',
  'cookie',
  'apikey',
  'gemini_api_key',
  'razorpay_secret',
  'whatsapp_token',
  'signature',
  'gatewaysignature',
  'pin',
  'securitycode'
];

/**
 * Recursively sanitizes objects, arrays, and strings to prevent sensitive data logging.
 * @param {any} data - The log data payload (object, string, or array) to sanitize.
 * @returns {any} Sanitized data payload safe for production logging.
 */
const sanitizeLog = (data) => {
  if (data === null || data === undefined) return data;

  // Handle strings (e.g. headers, raw error messages, or URLs containing tokens)
  if (typeof data === 'string') {
    return data
      .replace(/(bearer\s+[a-zA-Z0-9_\-\.]+)/gi, 'Bearer [REDACTED]')
      .replace(/(key_[a-zA-Z0-9]+)/gi, '[REDACTED_KEY]');
  }

  // Handle Arrays
  if (Array.isArray(data)) {
    return data.map(item => sanitizeLog(item));
  }

  // Handle Objects
  if (typeof data === 'object') {
    // If it's a Mongoose document or special object, handle gently
    const sanitized = {};
    for (const key of Object.keys(data)) {
      const lowerKey = key.toLowerCase();
      
      // Check if key contains any sensitive keyword
      const isSensitive = SENSITIVE_KEYS.some(sensitive => lowerKey.includes(sensitive));

      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeLog(data[key]);
      }
    }
    return sanitized;
  }

  return data;
};

module.exports = { sanitizeLog };