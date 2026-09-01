const winston = require('winston');

const logger = winston.createLogger({
  level: 'error',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);
  const errorCode = err.code || 'INTERNAL_SERVER_ERROR';
  const requestId = req.requestId || 'unknown-req';
  const isProduction = process.env.NODE_ENV === 'production';

  logger.error({
    message: err.message,
    requestId,
    stack: err.stack,
    route: req.originalUrl
  });

  res.status(statusCode).json({
    success: false,
    code: errorCode,
    message: isProduction && statusCode === 500 ? 'Internal Server Error' : (err.message || 'Something went wrong'),
    requestId,
    retryable: statusCode >= 500 || statusCode === 408
  });
};

module.exports = { errorHandler };