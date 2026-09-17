const winston = require('winston');
const crypto = require('crypto');

// ==========================================
// 🔐 DATA PROTECTION: LOG SANITIZATION HELPER
// ==========================================
const SENSITIVE_KEYS = [
  'password', 'pass', 'token', 'jwt', 'otp', 'secret', 'key', 
  'creditcard', 'cardnumber', 'cvv', 'authorization', 'cookie', 
  'pin', 'securitycode', 'rrn', 'aadhaar', 'mynumber'
];

const sanitizeData = (data) => {
  if (!data) return data;
  if (typeof data === 'string') {
    // If it's a JSON string, try to parse and sanitize it
    try {
      const parsed = JSON.parse(data);
      return JSON.stringify(sanitizeData(parsed));
    } catch (e) {
      return data;
    }
  }
  if (typeof data === 'object') {
    if (Array.isArray(data)) {
      return data.map(item => sanitizeData(item));
    }
    const clone = {};
    for (const key of Object.keys(data)) {
      const lowerKey = key.toLowerCase();
      // Check if key matches any sensitive category
      if (SENSITIVE_KEYS.some(sk => lowerKey.includes(sk))) {
        clone[key] = '[REDACTED]';
      } else if (typeof data[key] === 'object' && data[key] !== null) {
        clone[key] = sanitizeData(data[key]);
      } else {
        clone[key] = data[key];
      }
    }
    return clone;
  }
  return data;
};

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
 * Quick direct logging wrappers with automatic data sanitization for security
 */
const logInfo = (message, meta = {}) => {
  logger.info(sanitizeData({ message, ...meta }));
};

const logError = (message, error = {}, meta = {}) => {
  logger.error(sanitizeData({
    message,
    error: error instanceof Error ? error.message : (error || 'Unknown Error'),
    stack: error instanceof Error ? error.stack : null,
    ...meta
  }));
};

const logWarn = (message, meta = {}) => {
  logger.warn(sanitizeData({ message, ...meta }));
};

module.exports = { 
  logger, 
  requestLoggerMiddleware, 
  logInfo, 
  logError, 
  logWarn,
  sanitizeData 
};