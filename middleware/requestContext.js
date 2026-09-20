// middleware/requestContext.js
const crypto = require('crypto');
const { sanitizeData } = require('../utils/logger');

/**
 * 🔥 TASKS #49 & #50: Enterprise Request Context Middleware
 * Generates or propagates a unique X-Request-ID, captures telemetry metadata,
 * and attaches a clean context object to the request for structured logging and error tracking.
 */
const requestContextMiddleware = (req, res, next) => {
  const start = Date.now();
  
  // 1. Unique Request ID Tracing (Task #50)
  const existingId = req.headers['x-request-id'] || req.headers['X-Request-ID'];
  const requestId = existingId || (
    crypto.randomUUID 
      ? crypto.randomUUID() 
      : `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  );

  // Bind to request object and response headers
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  // 2. Build Request Context Object
  req.context = {
    requestId,
    ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
    method: req.method,
    route: req.originalUrl || req.url,
    startTime: start
  };

  // 3. Optional hook to log request completion metadata safely (sanitized)
  res.on('finish', () => {
    const route = req.originalUrl || req.url;
    
    // Ignore frequent automated health checks to prevent log pollution
    if (route === '/health' || route === '/ping' || route === '/') return;

    const latency = Date.now() - start;
    const userId = req.user?._id || req.user?.id || req.user?.userId || 'anonymous';
    const contentLength = res.get('Content-Length') || 0;

    // Attach user and status telemetry to context
    req.context.userId = userId;
    req.context.status = res.statusCode;
    req.context.latency = `${latency}ms`;
    req.context.size = `${contentLength}B`;
  });

  next();
};

// Dual export alias compatibility
requestContextMiddleware.requestContextMiddleware = requestContextMiddleware;
requestContextMiddleware.requestIdMiddleware = requestContextMiddleware;

module.exports = { requestContextMiddleware };