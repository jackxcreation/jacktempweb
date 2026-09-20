// routes/authRouter.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken'); 
const crypto = require('crypto'); 
const rateLimit = require('express-rate-limit'); 
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware'); 
const { z } = require('zod'); 
const { JWT_SECRET } = require('../config/env'); // 🔥 STRICT ZERO-FALLBACK JWT SECRET IMPORT
const { authenticateUser, registerUser, formatSafeUser, generateToken } = require('../services/authService'); // 🔥 CENTRALIZED AUTH SERVICE
const { verifyAndAuthenticateGoogleToken } = require('../services/socialAuth'); // 🔥 SECURE SERVER-SIDE GOOGLE TOKEN VERIFICATION

// 🔥 TASK #49 & #50: Standardized API response helpers and structured logger
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { logInfo, logError, logWarn } = require('../utils/logger');

const { Resend } = require('resend');
const { 
  getResetOtpTemplate, 
  getPASSWORDChangedTemplate, 
  getEncryptionChangedTemplate, 
  getLoginAlertTemplate 
} = require('../emailTemplates'); 

const resend = new Resend(process.env.RESEND_API_KEY);

const otpStore = new Map();

// ==================================================
// 🔥 PRO FEATURE: MEMORY LEAK CLEANUP INTERVAL FOR OTP
// ==================================================
setInterval(() => {
  const now = Date.now();
  for (const [email, record] of otpStore.entries()) {
    if (now > record.expiresAt) {
      otpStore.delete(email);
    }
  }
}, 15 * 60 * 1000); // Run every 15 minutes

// ==================================================
// 🛡️ ZOD VALIDATION SCHEMAS FOR AUTHENTICATION (TASK #48)
// ==================================================
const registerSchema = z.object({
  name: z.string().min(2, "Name is required").max(100, "Name is too long"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
  phone: z.string().regex(/^\d{10}$/, "Invalid mobile number format").optional(),
  verificationToken: z.string().optional()
});

const registerStartSchema = z.object({
  email: z.string().email("Invalid email address"),
  phone: z.string().regex(/^\d{10}$/, "Invalid mobile number format").optional()
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  twoFactorCode: z.string().optional()
});

// 🔥 SECURE SOCIAL LOGIN SCHEMA (Accepts idToken instead of raw spoofable identity fields)
const socialLoginSchema = z.object({
  idToken: z.string().min(1, "Google ID Token is required")
});

const otpRequestSchema = z.object({
  email: z.string().email("Invalid email address")
});

const verifyOtpSchema = z.object({
  email: z.string().email("Invalid email address"),
  otp: z.string().regex(/^\d{6}$/, "Invalid OTP format. Must be 6 digits")
});

const resetPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
  otp: z.string().regex(/^\d{6}$/, "Invalid OTP format. Must be 6 digits"),
  newPassword: z.string().min(6, "Password must be at least 6 characters long")
});

const lockAccountSchema = z.object({
  token: z.string().min(1, "Token is required"),
  newSecurityCode: z.string().min(4, "Security PIN must be at least 4 digits")
});

const unlockAccountSchema = z.object({
  email: z.string().email("Invalid email address"),
  pin: z.string().min(1, "Security PIN is required")
});

const rotatePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters long")
});

// ==================================================
// 🛡️ ACCOUNT-LEVEL FAILED LOGIN TRACKER (Anti-Brute Force)
// ==================================================
const failedLoginAttempts = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [email, data] of failedLoginAttempts.entries()) {
    if (now > data.resetTime) {
      failedLoginAttempts.delete(email);
    }
  }
}, 15 * 60 * 1000);

const checkAccountLockout = (email) => {
  const record = failedLoginAttempts.get(email);
  if (!record) return { isLocked: false };

  if (Date.now() > record.resetTime) {
    failedLoginAttempts.delete(email);
    return { isLocked: false };
  }

  if (record.attempts >= 5) {
    const remainingTime = Math.ceil((record.resetTime - Date.now()) / 1000 / 60);
    return { isLocked: true, remainingTime };
  }

  return { isLocked: false };
};

const recordFailedAttempt = (email) => {
  const now = Date.now();
  const record = failedLoginAttempts.get(email);

  if (!record || now > record.resetTime) {
    failedLoginAttempts.set(email, { attempts: 1, resetTime: now + 15 * 60 * 1000 });
  } else {
    record.attempts += 1;
  }
};

const clearFailedAttempts = (email) => {
  failedLoginAttempts.delete(email);
};

// ==================================================
// 🛡️ DEDICATED UNLOCK ATTEMPT TRACKER
// ==================================================
const failedUnlockAttempts = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [email, data] of failedUnlockAttempts.entries()) {
    if (now > data.resetTime) {
      failedUnlockAttempts.delete(email);
    }
  }
}, 15 * 60 * 1000);

const checkUnlockLockout = (email) => {
  const record = failedUnlockAttempts.get(email);
  if (!record) return { isLocked: false };

  if (Date.now() > record.resetTime) {
    failedUnlockAttempts.delete(email);
    return { isLocked: false };
  }

  if (record.attempts >= 3) {
    const remainingTime = Math.ceil((record.resetTime - Date.now()) / 1000 / 60);
    return { isLocked: true, remainingTime };
  }

  return { isLocked: false };
};

const recordFailedUnlock = (email) => {
  const now = Date.now();
  const record = failedUnlockAttempts.get(email);

  if (!record || now > record.resetTime) {
    failedUnlockAttempts.set(email, { attempts: 1, resetTime: now + 15 * 60 * 1000 });
  } else {
    record.attempts += 1;
  }
};

const clearFailedUnlock = (email) => {
  failedUnlockAttempts.delete(email);
};

// ==================================================
// 🛡️ PHASE 9 / TASK #47: ENDPOINT-SPECIFIC RATE LIMITERS
// ==================================================
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, 
  max: 5, 
  message: { success: false, code: 'RATE_LIMIT_EXCEEDED', error: "Too many login attempts from this IP. Please try again after 5 minutes." }
});

const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, 
  max: 3, 
  message: { success: false, code: 'RATE_LIMIT_EXCEEDED', error: "Too many OTP requests. Please wait before trying again." }
});

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 5, 
  message: { success: false, code: 'RATE_LIMIT_EXCEEDED', error: "Too many password reset attempts. Please try later." }
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, 
  max: 5, 
  message: { success: false, code: 'RATE_LIMIT_EXCEEDED', error: "Too many accounts created from this IP. Please try later." }
});

const unlockLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 5, 
  message: { success: false, code: 'RATE_LIMIT_EXCEEDED', error: "Too many unlock requests from this IP. Please try later." }
});

// ==================================================
// 🔥 TASK #51: SEPARATED NAMESPACE COOKIE HELPER (CUSTOMER vs ADMIN)
// ==================================================
const setAuthCookie = (res, token, role) => {
  const privilegedRoles = [
    'admin', 'super_admin', 'operations_manager', 'catalog_manager', 
    'warehouse_manager', 'customer_support', 'finance_manager', 
    'marketing_manager', 'content_manager', 'analyst', 'read_only_auditor', 
    'manager', 'catalog', 'support'
  ];
  const isAdminRole = privilegedRoles.includes(role);
  const cookieName = isAdminRole ? 'admin_session' : 'customer_session';
  const maxAgeValue = isAdminRole ? 8 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000; 

  res.cookie(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: maxAgeValue
  });
};

// ==================================================
// 1. CANONICAL REGISTRATION: START 🔥
// ==================================================
router.post('/register/start', registerLimiter, async (req, res) => {
  try {
    const validationResult = registerStartSchema.safeParse(req.body);
    if (!validationResult.success) {
      return sendError(res, 'VALIDATION_FAILED', "Validation failed", 400, req, validationResult.error.format());
    }

    const { email } = validationResult.data;
    const cleanEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return sendError(res, 'EMAIL_ALREADY_REGISTERED', "This email is already registered. Please login.", 400, req);
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const salt = await bcrypt.genSalt(10);
    const hashedOTP = await bcrypt.hash(otp, salt);
    const expiresAt = Date.now() + 600000; // 10 mins

    await User.collection.updateOne(
      { email: cleanEmail },
      { $set: { resetOTP: hashedOTP, resetOTPExpires: expiresAt, emailTemp: cleanEmail } },
      { upsert: true }
    );

    if (process.env.RESEND_API_KEY) {
      const htmlContent = getResetOtpTemplate(otp);
      await resend.emails.send({
        from: 'Jack Essentials Security <updates@thejackessentials.com>',
        to: [cleanEmail],
        subject: 'Registration Verification Code - Jack Essentials',
        html: htmlContent
      });
    }

    return sendSuccess(res, { message: "Verification code started and sent successfully." }, "Success", 200, req);
  } catch (error) {
    logError("Register Start Error:", error, { requestId: req.requestId });
    return sendError(res, 'INTERNAL_SERVER_ERROR', "Failed to start registration process.", 500, req);
  }
});

// ==================================================
// 1.1 CANONICAL REGISTRATION: VERIFY & FINISH (Unified via authService) 🔥
// ==================================================
router.post('/register/verify', registerLimiter, async (req, res) => {
  try {
    const validationResult = registerSchema.safeParse(req.body);
    if (!validationResult.success) {
      return sendError(res, 'VALIDATION_FAILED', "Validation failed", 400, req, validationResult.error.format());
    }

    const { name, email, password, phone, verificationToken } = validationResult.data;
    const cleanEmail = email.toLowerCase().trim();

    let cleanPhone = phone ? phone.replace(/^\+91/, '').trim() : undefined;

    if (verificationToken && cleanPhone) {
      try {
        const decoded = jwt.verify(verificationToken, JWT_SECRET);
        if (!decoded.verified || decoded.phone !== cleanPhone) {
          return sendError(res, 'INVALID_TOKEN', "Invalid or expired phone verification token.", 400, req);
        }
      } catch (err) {
        return sendError(res, 'TOKEN_EXPIRED', "Phone verification session expired. Please verify again.", 400, req);
      }
    }

    // 🔥 Delegated to centralized authService (returns token & user with sessionId)
    const { token, user } = await registerUser({
      name,
      email: cleanEmail,
      password,
      phone: cleanPhone,
      role: 'customer',
      ip: req.ip || 'Unknown',
      userAgent: req.headers['user-agent'] || 'Unknown Device'
    });

    setAuthCookie(res, token, user.role);

    return sendSuccess(res, { user }, "Welcome to Jack Essentials! Account created successfully.", 201, req);

  } catch (error) {
    logError("Registration Verify Error:", error, { requestId: req.requestId });
    return sendError(res, 'REGISTRATION_FAILED', error.message || "Internal Server Error. Please try again.", 500, req);
  }
});

// Backward-compatible alias for /register
router.post('/register', registerLimiter, async (req, res) => {
  return router.handle({ ...req, url: '/register/verify' }, res);
});

// ==================================================
// 2. CANONICAL USER / ADMIN LOGIN (Unified via authService) 🔥
// ==================================================
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const validationResult = loginSchema.safeParse(req.body);
    if (!validationResult.success) {
      return sendError(res, 'VALIDATION_FAILED', "Validation failed", 400, req, validationResult.error.format());
    }

    const { email, password, twoFactorCode } = validationResult.data;
    const cleanEmail = email.toLowerCase().trim();
    
    const lockoutStatus = checkAccountLockout(cleanEmail);
    if (lockoutStatus.isLocked) {
      return sendError(
        res, 
        'ACCOUNT_LOCKED', 
        `Too many failed login attempts for this account. Please try again after ${lockoutStatus.remainingTime} minutes.`, 
        429, 
        req
      );
    }

    // Additional 2FA check pre-validation if required
    if (twoFactorCode) {
      const tempUser = await User.findOne({ email: cleanEmail }).select('+twoFactorSecret');
      if (tempUser && tempUser.twoFactorEnabled && twoFactorCode !== tempUser.twoFactorSecret) {
        return sendError(res, 'INVALID_2FA', "Invalid 2FA code.", 400, req);
      }
    }

    // 🔥 Delegated to centralized authService
    const { token, user } = await authenticateUser({
      email: cleanEmail,
      password,
      ip: req.ip || 'Unknown Location',
      userAgent: req.headers['user-agent'] || 'Unknown Device'
    });

    clearFailedAttempts(cleanEmail);
    setAuthCookie(res, token, user.role);

    // Generate emergency lock token for email alerts
    const fullUserDoc = await User.findById(user.id);
    if (fullUserDoc) {
      const lockToken = crypto.randomBytes(32).toString('hex');
      fullUserDoc.resetPasswordToken = lockToken;
      fullUserDoc.resetPasswordExpire = Date.now() + 3000000; 
      await fullUserDoc.save();

      const time = new Date();
      const timeString = time.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      const lockLink = `https://thejackessentials.com/secure-account?token=${lockToken}`;
      const accountAgeInMinutes = (Date.now() - new Date(fullUserDoc.createdAt || Date.now()).getTime()) / 60000;

      if (process.env.RESEND_API_KEY && accountAgeInMinutes >= 2) {
        const htmlContent = getLoginAlertTemplate(fullUserDoc.name || 'User', req.headers['user-agent'] || 'Unknown Device', timeString, req.ip || 'Unknown', lockLink);
        resend.emails.send({
          from: 'Jack Essentials Security <updates@thejackessentials.com>', 
          to: [fullUserDoc.email],
          subject: '⚠️ Security Alert: New Login to your Account',
          html: htmlContent
        }).catch(err => logWarn("Failed to send login alert email", { error: err.message }));
      }
    }

    return sendSuccess(res, { user }, "Authentication successful.", 200, req);
  } catch (error) {
    logError("Login Error:", error, { requestId: req.requestId });
    if (error.isLocked) {
      return res.status(403).json({ success: false, code: 'ACCOUNT_LOCKED', error: "Account is LOCKED.", isLocked: true, email: error.email, requestId: req.requestId });
    }
    recordFailedAttempt(req.body?.email?.toLowerCase()?.trim() || '');
    return sendError(res, 'AUTHENTICATION_FAILED', error.message || "An unexpected error occurred during authentication.", 401, req);
  }
});

// ==================================================
// 3. CANONICAL SECURE SOCIAL LOGIN: GOOGLE 🔥 (Server-Side Verified)
// ==================================================
router.post('/social/google', loginLimiter, async (req, res) => {
  try {
    const validationResult = socialLoginSchema.safeParse(req.body);
    if (!validationResult.success) {
      return sendError(res, 'VALIDATION_FAILED', "Validation failed", 400, req, validationResult.error.format());
    }

    const { idToken } = validationResult.data;

    // 🔥 Delegated to centralized socialAuth service for cryptographic verification
    const { token, user, isNewUser } = await verifyAndAuthenticateGoogleToken({
      idToken,
      ip: req.ip || 'Unknown Location',
      userAgent: req.headers['user-agent'] || 'Unknown Device'
    });

    setAuthCookie(res, token, user.role);
    
    return sendSuccess(res, { user, isNewUser }, "Social Login Successful", 200, req);
  } catch (error) {
    logError("Secure Social Login Error:", error, { requestId: req.requestId });
    if (error.isLocked) {
      return res.status(403).json({ success: false, code: 'ACCOUNT_LOCKED', error: "Account is LOCKED.", isLocked: true, email: error.email, requestId: req.requestId });
    }
    return sendError(res, 'SOCIAL_LOGIN_FAILED', error.message || "Google authentication failed on server.", 401, req);
  }
});

// Backward-compatible alias for /social-login
router.post('/social-login', loginLimiter, async (req, res) => {
  return router.handle({ ...req, url: '/social/google' }, res);
});

// ==================================================
// 4. CANONICAL SESSION REFRESH 🔥
// ==================================================
router.post('/refresh', async (req, res) => {
  try {
    const token = req.cookies.admin_session || req.cookies.customer_session || req.cookies.token || req.cookies.admin_token;
    if (!token) {
      return sendError(res, 'NO_SESSION', 'No active session token found in cookies', 401, req);
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || user.isActive === false || user.isLocked) {
      return sendError(res, 'INVALID_SESSION', 'Session invalid or user inactive/locked', 401, req);
    }

    const newSessionId = decoded.sid || crypto.randomBytes(16).toString('hex');
    const newToken = generateToken(user, newSessionId);
    setAuthCookie(res, newToken, user.role);

    return sendSuccess(res, {}, 'Session refreshed successfully', 200, req);
  } catch (error) {
    logError("Token Refresh Error:", error, { requestId: req.requestId });
    return sendError(res, 'INVALID_SESSION', 'Invalid or expired session token', 401, req);
  }
});

// ==================================================
// 5. PASSWORD RESET: SEND SECURE OTP
// ==================================================
router.post('/send-otp', otpLimiter, async (req, res) => {
  try {
    const validationResult = otpRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return sendError(res, 'VALIDATION_FAILED', "Validation failed", 400, req, validationResult.error.format());
    }

    const cleanEmail = validationResult.data.email.toLowerCase().trim();
    const userExists = await User.findOne({ email: cleanEmail });
    if (!userExists) return sendError(res, 'USER_NOT_FOUND', "Account not found.", 404, req);

    const otp = crypto.randomInt(100000, 999999).toString();
    const salt = await bcrypt.genSalt(10);
    const hashedOTP = await bcrypt.hash(otp, salt);
    const expiresAt = Date.now() + 600000; 
    
    userExists.auditLogs = userExists.auditLogs || [];
    userExists.auditLogs.push({ action: 'OTP_REQUESTED', details: 'Password reset OTP requested', ip: req.ip || 'Unknown' });
    await userExists.save();

    await User.collection.updateOne(
      { _id: userExists._id },
      { $set: { resetOTP: hashedOTP, resetOTPExpires: expiresAt } }
    );

    if (process.env.RESEND_API_KEY) {
      const htmlContent = getResetOtpTemplate(otp); 
      await resend.emails.send({
        from: 'Jack Essentials Security <updates@thejackessentials.com>', 
        to: [userExists.email],
        subject: 'Password Reset OTP - Jack Essentials',
        html: htmlContent
      });
    }

    return sendSuccess(res, {}, "OTP sent to your email.", 200, req);
  } catch (error) {
    logError("Send OTP Error:", error, { requestId: req.requestId });
    return sendError(res, 'OTP_SEND_FAILED', "Failed to send OTP.", 500, req);
  }
});

// ==================================================
// 6. PASSWORD RESET: VERIFY OTP
// ==================================================
router.post('/verify-otp', resetLimiter, async (req, res) => {
  try {
    const validationResult = verifyOtpSchema.safeParse(req.body);
    if (!validationResult.success) {
      return sendError(res, 'VALIDATION_FAILED', "Validation failed", 400, req, validationResult.error.format());
    }

    const { email, otp } = validationResult.data;
    const cleanEmail = email.toLowerCase().trim();
    const cleanOtp = String(otp).trim(); 
    
    const user = await User.findOne({ email: cleanEmail }).lean();
    if (!user || !user.resetOTP || !user.resetOTPExpires) {
      return sendError(res, 'OTP_NOT_FOUND', "No OTP request found for this email.", 400, req);
    }

    if (Date.now() > user.resetOTPExpires) {
      return sendError(res, 'OTP_EXPIRED', "OTP has expired. Please request a new one.", 400, req);
    }

    const isMatch = await bcrypt.compare(cleanOtp, user.resetOTP);
    if (!isMatch) {
      return sendError(res, 'INCORRECT_OTP', "Incorrect OTP. Please try again.", 400, req);
    }

    return sendSuccess(res, {}, "OTP Verified successfully.", 200, req);
  } catch (error) {
    logError("Verify OTP Error:", error, { requestId: req.requestId });
    return sendError(res, 'VERIFICATION_FAILED', "Verification failed.", 500, req);
  }
});

// ==================================================
// 7. RESET PASSWORD
// ==================================================
router.post('/reset-password', resetLimiter, async (req, res) => {
  try {
    const validationResult = resetPasswordSchema.safeParse(req.body);
    if (!validationResult.success) {
      return sendError(res, 'VALIDATION_FAILED', "Validation failed", 400, req, validationResult.error.format());
    }

    const { email, otp, newPassword } = validationResult.data;
    const cleanEmail = email.toLowerCase().trim();
    const cleanOtp = String(otp).trim();
    
    const user = await User.findOne({ email: cleanEmail });
    if (!user || !user.resetOTP || Date.now() > user.resetOTPExpires) {
      return sendError(res, 'SESSION_EXPIRED', "Session expired. Please request a new OTP.", 400, req);
    }

    const isMatch = await bcrypt.compare(cleanOtp, user.resetOTP);
    if (!isMatch) {
      return sendError(res, 'INCORRECT_OTP', "Security validation failed. Incorrect OTP.", 400, req);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    user.resetOTP = undefined;
    user.resetOTPExpires = undefined;
    user.activeSessions = [];
    user.auditLogs = user.auditLogs || [];
    user.auditLogs.push({ action: 'PASSWORD_RESET', details: 'Password reset successfully via OTP', ip: req.ip || 'Unknown' });
    await user.save();

    if (process.env.RESEND_API_KEY) {
      const loginLink = "https://thejackessentials.com/login"; 
      const successHtml = getPASSWORDChangedTemplate(user.name, loginLink);
      await resend.emails.send({
        from: 'Jack Essentials Security <updates@thejackessentials.com>',
        to: [user.email],
        subject: '✅ Password Successfully Changed - Jack Essentials',
        html: successHtml
      });
    }

    return sendSuccess(res, {}, "Password successfully updated!", 200, req);
  } catch (error) {
    logError("Reset Password Error:", error, { requestId: req.requestId });
    return sendError(res, 'RESET_FAILED', "Failed to reset password.", 500, req);
  }
});

// ==================================================
// 7.1 🔥 PASSWORD ROTATION (Logged-in User)
// ==================================================
router.post('/rotate-password', protect, async (req, res) => {
  try {
    const validationResult = rotatePasswordSchema.safeParse(req.body);
    if (!validationResult.success) {
      return sendError(res, 'VALIDATION_FAILED', "Validation failed", 400, req, validationResult.error.format());
    }

    const { currentPassword, newPassword } = validationResult.data;
    const user = await User.findById(req.user._id).select('+password');

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return sendError(res, 'INCORRECT_PASSWORD', "Incorrect current password.", 400, req);
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.auditLogs = user.auditLogs || [];
    user.auditLogs.push({ action: 'PASSWORD_ROTATE', details: 'Password rotated successfully from account settings', ip: req.ip || 'Unknown' });
    await user.save();

    return sendSuccess(res, {}, "Password rotated successfully.", 200, req);
  } catch (error) {
    logError("Password Rotation Error:", error, { requestId: req.requestId });
    return sendError(res, 'ROTATE_FAILED', "Failed to rotate password.", 500, req);
  }
});

// ==================================================
// 7.2 🔥 2FA TOGGLE & SETUP ENDPOINTS
// ==================================================
router.post('/2fa/toggle', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.twoFactorEnabled = !user.twoFactorEnabled;
    if (user.twoFactorEnabled) {
      user.twoFactorSecret = crypto.randomInt(100000, 999999).toString();
    } else {
      user.twoFactorSecret = undefined;
    }
    user.auditLogs = user.auditLogs || [];
    user.auditLogs.push({ action: '2FA_TOGGLE', details: `2FA set to ${user.twoFactorEnabled}`, ip: req.ip || 'Unknown' });
    await user.save();

    return sendSuccess(res, { 
      twoFactorEnabled: user.twoFactorEnabled, 
      tempSecret: user.twoFactorSecret 
    }, `2FA is now ${user.twoFactorEnabled ? 'Enabled' : 'Disabled'}`, 200, req);
  } catch (error) {
    logError("2FA Toggle Error:", error, { requestId: req.requestId });
    return sendError(res, '2FA_UPDATE_FAILED', "Failed to update 2FA settings.", 500, req);
  }
});

// ==================================================
// 7.3 🔥 ACTIVE SESSIONS & SECURITY CENTER ENDPOINTS
// ==================================================
router.get('/security/audit-center', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('activeSessions loginHistory auditLogs twoFactorEnabled isLocked');
    if (!user) return sendError(res, 'USER_NOT_FOUND', "User not found", 404, req);

    return sendSuccess(res, {
      twoFactorEnabled: user.twoFactorEnabled || false,
      isLocked: user.isLocked || false,
      activeSessions: user.activeSessions || [],
      loginHistory: user.loginHistory || [],
      auditLogs: user.auditLogs || []
    }, "Security analytics fetched successfully", 200, req);
  } catch (error) {
    logError("Fetch Security Center Error:", error, { requestId: req.requestId });
    return sendError(res, 'AUDIT_FETCH_FAILED', "Failed to fetch security analytics.", 500, req);
  }
});

router.post('/sessions/revoke', protect, async (req, res) => {
  try {
    const { sessionId } = req.body;
    const user = await User.findById(req.user._id);

    user.activeSessions = user.activeSessions || [];
    user.activeSessions = user.activeSessions.filter(s => s.sessionId !== sessionId);
    user.auditLogs = user.auditLogs || [];
    user.auditLogs.push({ action: 'SESSION_REVOKE', details: `Revoked session ID: ${sessionId}`, ip: req.ip || 'Unknown' });
    await user.save();

    return sendSuccess(res, {}, "Session revoked successfully.", 200, req);
  } catch (error) {
    logError("Revoke Session Error:", error, { requestId: req.requestId });
    return sendError(res, 'REVOKE_FAILED', "Failed to revoke session.", 500, req);
  }
});

router.post('/sessions/logout-all', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.activeSessions = [];
    user.auditLogs = user.auditLogs || [];
    user.auditLogs.push({ action: 'LOGOUT_ALL_SESSIONS', details: 'Terminated all active sessions across devices', ip: req.ip || 'Unknown' });
    await user.save();

    const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax' };
    res.clearCookie('customer_session', cookieOptions);
    res.clearCookie('admin_session', cookieOptions);
    res.clearCookie('token', cookieOptions);
    res.clearCookie('admin_token', cookieOptions);

    return sendSuccess(res, {}, "All sessions terminated successfully.", 200, req);
  } catch (error) {
    logError("Logout All Error:", error, { requestId: req.requestId });
    return sendError(res, 'LOGOUT_ALL_FAILED', "Failed to terminate all sessions.", 500, req);
  }
});

// ==================================================
// 8. SECURE LOCK ACCOUNT
// ==================================================
router.post('/lock-account', async (req, res) => {
  try {
    const validationResult = lockAccountSchema.safeParse(req.body);
    if (!validationResult.success) {
      return sendError(res, 'VALIDATION_FAILED', "Validation failed", 400, req, validationResult.error.format());
    }

    const { token, newSecurityCode } = validationResult.data;
    const user = await User.findOne({ resetPasswordToken: token });
    if (!user || user.resetPasswordExpire < Date.now()) {
      return sendError(res, 'INVALID_LOCK_TOKEN', "Lock link is invalid or expired. Please login again.", 400, req);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPin = await bcrypt.hash(newSecurityCode, salt);

    user.isLocked = true;
    user.securityCode = hashedPin;
    user.resetPasswordToken = undefined; 
    user.resetPasswordExpire = undefined;
    user.activeSessions = []; 
    user.auditLogs = user.auditLogs || [];
    user.auditLogs.push({ action: 'EMERGENCY_LOCK', details: 'Account manually locked via security alert link', ip: req.ip || 'Unknown' });
    await user.save();
    
    return sendSuccess(res, { userId: user._id }, "Account locked securely.", 200, req);
  } catch (error) { 
    logError("Lock Account Error:", error, { requestId: req.requestId });
    return sendError(res, 'LOCK_FAILED', "Failed to lock account.", 500, req); 
  }
});

// ==================================================
// 9. HARDENED UNLOCK ACCOUNT API
// ==================================================
router.post('/unlock-account', unlockLimiter, async (req, res) => {
  try {
    const validationResult = unlockAccountSchema.safeParse(req.body);
    if (!validationResult.success) {
      return sendError(res, 'VALIDATION_FAILED', "Validation failed", 400, req, validationResult.error.format());
    }

    const { email, pin } = validationResult.data;
    const cleanEmail = email.toLowerCase().trim();

    const lockoutStatus = checkUnlockLockout(cleanEmail);
    if (lockoutStatus.isLocked) {
      return sendError(
        res,
        'UNLOCK_RATE_LIMIT_EXCEEDED',
        `Too many incorrect PIN attempts. Account unlock is temporarily blocked. Try again after ${lockoutStatus.remainingTime} minutes.`,
        429,
        req
      );
    }

    const user = await User.findOne({ email: cleanEmail }).select('+securityCode');
    if (!user || !user.isLocked) {
      recordFailedUnlock(cleanEmail);
      return sendError(res, 'INVALID_UNLOCK', "Invalid unlock request or account is not locked.", 400, req);
    }

    const isMatch = await bcrypt.compare(pin, user.securityCode);
    if (!isMatch) {
      recordFailedUnlock(cleanEmail);
      return sendError(res, 'INCORRECT_PIN', "Incorrect Security PIN.", 400, req);
    }

    clearFailedUnlock(cleanEmail);

    const sessionId = crypto.randomBytes(16).toString('hex');
    const ip = req.ip || 'Unknown';

    user.isLocked = false;
    user.securityCode = undefined;
    user.activeSessions = user.activeSessions || [];
    user.auditLogs = user.auditLogs || [];

    user.activeSessions.push({ sessionId, ipAddress: ip, device: req.headers['user-agent'] || 'Unlock Device', loginAt: new Date() });
    user.auditLogs.push({ action: 'ACCOUNT_UNLOCKED', details: 'Account successfully unlocked via Security PIN', ip });
    await user.save();

    const token = generateToken(user, sessionId);
    setAuthCookie(res, token, user.role);

    return sendSuccess(res, { user: formatSafeUser(user) }, "Account Unlocked Successfully!", 200, req);
  } catch (error) { 
    logError("Unlock Account Critical Error:", error, { requestId: req.requestId });
    return sendError(res, 'UNLOCK_CRITICAL_ERROR', "Failed to process account unlock.", 500, req); 
  }
});

// ==================================================
// 10. 🔥 TASK #53: CANONICAL LOGOUT ENDPOINT WITH SERVER-SIDE SESSION INVALIDATION
// ==================================================
router.post('/logout', protect, async (req, res) => {
  try {
    const targetSessionId = req.sessionId || (req.user && req.user.sessionId);
    if (req.user && targetSessionId) {
      // Server-side session invalidation from User model's activeSessions
      await User.findByIdAndUpdate(req.user._id, {
        $pull: { activeSessions: { sessionId: targetSessionId } }
      });
    }
  } catch (e) {
    logWarn("Logout session pull warning", { error: e.message });
  }

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
  };

  res.clearCookie('customer_session', cookieOptions);
  res.clearCookie('admin_session', cookieOptions);
  res.clearCookie('token', cookieOptions);
  res.clearCookie('admin_token', cookieOptions);

  return sendSuccess(res, {}, "Logged out successfully.", 200, req);
});

// ==================================================
// 11. 🔥 TASK #52: CANONICAL SESSION VALIDATION ENDPOINT (/auth/me)
// ==================================================
router.get('/me', protect, async (req, res) => {
  try {
    const user = req.user; 
    if (!user || user.isActive === false) {
      return sendError(res, 'USER_INACTIVE', 'User not found or inactive', 401, req);
    }

    return res.status(200).json(formatSafeUser(user));
  } catch (error) {
    logError("Auth /me error:", error, { requestId: req.requestId });
    return sendError(res, 'SESSION_VALIDATION_ERROR', 'Server error during session validation', 500, req);
  }
});

module.exports = router;