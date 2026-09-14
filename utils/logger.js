const winston = require('winston');
const crypto = require('crypto');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }), // Automatically capture full error stack traces
    winston.format.json() // Structured JSON logs for production (Datadog/Better Stack/Sentry ready)
  ),
  transports: [
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production' 
        ? winston.format.json() 
        : winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
    })
  ],
  exitOnError: false
});

/**
 * Request tracing middleware to track latency, status, userId, requestId, and route
 */
const requestLoggerMiddleware = (req, res, next) => {
  const start = Date.now();
  
  // 🔥 UPGRADE: Use crypto.randomUUID() for guaranteed unique request tracking
  const requestId = req.headers['x-request-id'] || req.headers['X-Request-ID'] || crypto.randomUUID();
  
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  res.on('finish', () => {
    const route = req.originalUrl || req.url;
    
    // 🔥 UPGRADE: Prevent log pollution by ignoring frequent automated health checks
    if (route === '/health' || route === '/ping' || route === '/') return;

    const latency = Date.now() - start;
    const userId = req.user?._id || req.user?.id || req.user?.userId || 'anonymous';
    
    // 🔥 UPGRADE: Capture IP and Payload size for fraud monitoring and performance analytics
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    const contentLength = res.get('Content-Length') || 0;
    
    logger.info({
      message: 'HTTP Request Completed',
      requestId,
      userId,
      ip,
      method: req.method,
      route,
      status: res.statusCode,
      latency: `${latency}ms`,
      size: `${contentLength}B`
    });
  });

  next();
};

/**
 * Quick direct logging wrappers for manual usage across services
 */
const logInfo = (message, meta = {}) => {
  logger.info({ message, ...meta });
};

const logError = (message, error = {}, meta = {}) => {
  logger.error({
    message,
    error: error instanceof Error ? error.message : (error || 'Unknown Error'),
    stack: error instanceof Error ? error.stack : null,
    ...meta
  });
};

const logWarn = (message, meta = {}) => {
  logger.warn({ message, ...meta });
};

module.exports = { 
  logger, 
  requestLoggerMiddleware, 
  logInfo, 
  logError, 
  logWarn 
};