const { logger } = require('./logger'); // Winston logger instance

/**
 * Sends a standardized, secure, and logged error response to the client.
 * Enhanced with defensive checks for non-HTTP contexts, string errors, and fallback logging.
 */
const sendErrorResponse = (res, req = {}, error, defaultMessage = "Internal Server Error", statusCode = 500) => {
  const errorMessage = error instanceof Error ? error.message : (typeof error === 'string' ? error : defaultMessage);
  const errorStack = error instanceof Error ? error.stack : 'No stack trace available';
  const requestId = (req && req.requestId) || `req_${Date.now()}`;
  const route = (req && (req.originalUrl || req.url)) || 'UNKNOWN_ROUTE';

  // 1. Log detailed error on server side with requestId
  try {
    if (logger && typeof logger.error === 'function') {
      logger.error({
        message: defaultMessage,
        requestId,
        error: errorMessage,
        stack: errorStack,
        route
      });
    } else {
      console.error(`[ERROR] [${requestId}] ${defaultMessage}:`, errorMessage);
    }
  } catch (logErr) {
    console.error('Logger Failure:', logErr.message, error);
  }

  // 2. Safeguard if response object is missing or headers already sent
  if (!res || typeof res.status !== 'function') {
    console.warn('Response object not available or invalid in sendErrorResponse');
    return;
  }

  if (res.headersSent) {
    return;
  }

  // 3. Send sanitized safe response to client
  const isProduction = process.env.NODE_ENV === 'production';
  return res.status(statusCode).json({
    success: false,
    message: isProduction && statusCode === 500 ? defaultMessage : errorMessage,
    requestId
  });
};

/**
 * Standardized Success Response Utility
 */
const sendSuccessResponse = (res, data = {}, message = "Success", statusCode = 200) => {
  if (!res || typeof res.status !== 'function') return;
  if (res.headersSent) return;

  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

/**
 * Standardized Validation Error Response Utility
 * 🔥 CRITICAL FIX: Properly exposes the 'errors' array to the frontend so forms can highlight invalid fields.
 * 🔥 CRITICAL FIX: Logs as a 'warn' instead of 'error' to prevent false-positive server crash alerts.
 */
const sendValidationError = (res, req = {}, errors = [], message = "Validation Failed") => {
  const requestId = (req && req.requestId) || `req_${Date.now()}`;
  const route = (req && (req.originalUrl || req.url)) || 'UNKNOWN_ROUTE';

  try {
    if (logger && typeof logger.warn === 'function') {
      logger.warn({
        message,
        requestId,
        validationErrors: errors,
        route
      });
    }
  } catch (logErr) {
    console.error('Logger Failure:', logErr.message);
  }

  if (!res || typeof res.status !== 'function' || res.headersSent) return;

  return res.status(400).json({
    success: false,
    message,
    errors, // Ensures the frontend receives the exact fields that failed
    requestId
  });
};

module.exports = { 
  sendErrorResponse, 
  sendSuccessResponse, 
  sendValidationError 
};