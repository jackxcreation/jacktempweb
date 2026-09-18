// middleware/requestId.js
const crypto = require('crypto');

/**
 * Enterprise Request ID Middleware
 * Assigns a unique X-Request-ID correlation tracer to every incoming request.
 */
const requestIdMiddleware = (req, res, next) => {
  // Check if request already has an incoming ID from client, gateway, or load balancer
  const existingId = req.headers['x-request-id'] || req.headers['X-Request-ID'];
  
  const requestId = existingId || (
    crypto.randomUUID 
      ? crypto.randomUUID() 
      : `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  );
  
  // Attach to request object for internal controllers, services, and loggers
  req.requestId = requestId;
  
  // Set response header so client/frontend can track it back during support queries
  res.setHeader('X-Request-ID', requestId);
  
  next();
};

module.exports = { requestIdMiddleware };