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
 * 🔥 TASK #47: Granular Login Limiter
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: 'LOGIN_RATE_LIMIT_EXCEEDED',
    message: 'Too many login attempts, please try again after 15 minutes.'
  }
});

/**
 * 🔥 TASK #47: Granular Register Limiter
 */
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: 'REGISTER_RATE_LIMIT_EXCEEDED',
    message: 'Too many registration attempts from this IP, please try again later.'
  }
});

/**
 * 🔥 BUG FIX: Generic OTP Limiter (Required by server.js line 188)
 */
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, 
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: 'OTP_RATE_LIMIT_EXCEEDED',
    message: 'Too many OTP requests. Please wait 10 minutes before trying again.'
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

/**
 * 🔥 TASK #47: Granular Chat / AI Limiter
 */
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: 'CHAT_RATE_LIMIT_EXCEEDED',
    message: 'Chat rate limit exceeded. Please slow down.'
  }
});

/**
 * 🔥 TASK #47: Granular Payment Limiter
 */
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: 'PAYMENT_RATE_LIMIT_EXCEEDED',
    message: 'Too many payment initiation attempts, please try again later.'
  }
});

/**
 * 🔥 TASK #47: Granular Search Limiter
 */
const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: 'SEARCH_RATE_LIMIT_EXCEEDED',
    message: 'Search rate limit exceeded.'
  }
});

/**
 * 🔥 TASK #47: Granular Newsletter Limiter
 */
const newsletterLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: 'NEWSLETTER_RATE_LIMIT_EXCEEDED',
    message: 'Too many newsletter subscription requests.'
  }
});

// 🔥 Add robust export mappings for maximum compatibility across different modules (Points 46-50 fully supported)
module.exports = {
  globalLimiter,
  authLimiter,
  loginLimiter,
  registerLimiter,
  otpLimiter,         // 👈 FIXED: This was missing and caused the crash in server.js
  otpSendLimiter,
  otpVerifyLimiter,
  chatLimiter,
  paymentLimiter,
  searchLimiter,
  newsletterLimiter,
  rateLimitMiddleware: globalLimiter,
  limiter: globalLimiter
};