// middleware/rateLimit.js
const rateLimit = require('express-rate-limit');

/**
 * Standard Global API Rate Limiter
 */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests from this IP, please try again after 15 minutes.'
  }
});

/**
 * Strict Authentication / Login / Register Limiter
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Max 10 login/register attempts per 15 mins
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
    message: 'Too many authentication attempts. Please try again later.'
  }
});

/**
 * OTP Send Limiter (Prevents flooding & spamming)
 * Enforces IP rate limiting and resend cooldown behavior.
 */
const otpSendLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes window
  max: 3, // Max 3 OTP send requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: 'OTP_SEND_LIMIT_EXCEEDED',
    message: 'Too many OTP requests. Please wait 10 minutes before requesting a new code.'
  }
});

/**
 * OTP Verify Limiter (Protects against 6-digit brute-force guessing)
 * Enforces MAX_ATTEMPTS rule (Max 5 wrong guesses per window).
 */
const otpVerifyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes window
  max: 5, // Max 5 verification attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: 'OTP_VERIFY_LIMIT_EXCEEDED',
    message: 'Too many failed verification attempts. Please request a new OTP.'
  }
});

module.exports = {
  globalLimiter,
  authLimiter,
  otpSendLimiter,
  otpVerifyLimiter
};