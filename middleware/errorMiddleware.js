// src/middleware/errorHandler.js
const winston = require('winston');

const logger = winston.createLogger({
  level: 'error',
  format: winston.format.combine(
    winston.format.timestamp(), // Timestamp for log tracking
    winston.format.json()
  ),
  transports: [new winston.transports.Console()]
});

const errorHandler = (err, req, res, next) => {
  // 🔥 CRITICAL PRODUCTION FIX: If headers were already sent, delegate to default Express handler
  if (res.headersSent) {
    return next(err);
  }

  let statusCode = err.statusCode || err.status || (res.statusCode === 200 ? 500 : res.statusCode);
  
  // 🔥 Pro Feature: Auto-detect common database, Zod, and auth error codes if not explicitly set
  let errorCode = err.code || 'INTERNAL_SERVER_ERROR';
  
  if (err.name === 'ValidationError') {
    errorCode = 'VALIDATION_ERROR';
    statusCode = 400;
  } else if (err.name === 'ZodError' || (err.issues && Array.isArray(err.issues))) {
    errorCode = 'VALIDATION_ERROR';
    statusCode = 400;
  } else if (err.code === 11000) {
    errorCode = 'DUPLICATE_KEY_ERROR';
    statusCode = 409;
  } else if (err.name === 'CastError') {
    errorCode = 'RESOURCE_NOT_FOUND';
    statusCode = 404;
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    errorCode = 'UNAUTHORIZED';
    statusCode = 401;
  }

  const requestId = req.requestId || req.headers['x-request-id'] || 'unknown-req';
  const isProduction = process.env.NODE_ENV === 'production';

  // Comprehensive error logging via Winston
  logger.error({
    message: err.message || 'Unknown error occurred',
    code: errorCode,
    statusCode,
    requestId,
    stack: err.stack,
    route: req.originalUrl,
    method: req.method,
    ip: req.ip
  });

  // Client JSON response payload
  res.status(statusCode).json({
    success: false,
    code: errorCode,
    message: isProduction && statusCode === 500 ? 'Internal Server Error' : (err.message || 'Something went wrong'),
    errors: err.errors || err.issues || undefined,
    requestId,
    retryable: statusCode >= 500 || statusCode === 408
  });
};

module.exports = { errorHandler };