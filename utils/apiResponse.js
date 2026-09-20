// utils/apiResponse.js

/**
 * 🔥 TASK #49: Send a standardized success API response
 * @param {Object} res - Express response object
 * @param {Object} data - Payload data
 * @param {String} message - Success message
 * @param {Number} statusCode - HTTP status code (default 200)
 * @param {Object} req - Express request object (for automatic requestId tracing - Task #50)
 */
const sendSuccess = (res, data = {}, message = "Success", statusCode = 200, req = {}) => {
  const requestId = req.requestId || res.getHeader('X-Request-ID') || null;
  return res.status(statusCode).json({
    success: true,
    code: 'SUCCESS',
    message,
    data,
    requestId
  });
};

/**
 * 🔥 TASK #49: Send a standardized error API response
 * @param {Object} res - Express response object
 * @param {String} code - Machine-readable error code (e.g., 'ORDER_NOT_FOUND', 'VALIDATION_FAILED')
 * @param {String} message - Human-readable error message
 * @param {Number} statusCode - HTTP status code (default 500)
 * @param {Object} req - Express request object (for automatic requestId tracing - Task #50)
 * @param {Object|Array} errors - Optional validation errors or extra diagnostic info
 */
const sendError = (res, code = "INTERNAL_SERVER_ERROR", message = "An error occurred", statusCode = 500, req = {}, errors = null) => {
  const requestId = req.requestId || res.getHeader('X-Request-ID') || null;
  const responsePayload = {
    success: false,
    code,
    message,
    requestId
  };
  
  if (errors) {
    responsePayload.errors = errors;
  }

  return res.status(statusCode).json(responsePayload);
};

module.exports = {
  sendSuccess,
  sendError
};