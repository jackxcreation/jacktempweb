const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json() // Structured JSON logs for production (Datadog/Better Stack/Sentry ready)
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Request tracing middleware to track latency, status, userId, requestId, and route
const requestLoggerMiddleware = (req, res, next) => {
  const start = Date.now();
  
  // 🔥 FIXED: Corrected string substring syntax for random ID generation
  const requestId = req.headers['x-request-id'] || req.headers['X-Request-ID'] || Math.random().toString(36).substring(2, 15);
  
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  res.on('finish', () => {
    const latency = Date.now() - start;
    const userId = req.user?._id || req.user?.id || 'anonymous';
    
    logger.info({
      message: 'HTTP Request Completed',
      requestId,
      userId,
      method: req.method,
      route: req.originalUrl,
      status: res.statusCode,
      latency: `${latency}ms`
    });
  });

  next();
};

module.exports = { logger, requestLoggerMiddleware };