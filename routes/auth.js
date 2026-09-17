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

const { Resend } = require('resend');
const { 
  getResetOtpTemplate, 
  getPASSWORDChangedTemplate, 
  getPasswordChangedTemplate, 
  getLoginAlertTemplate 
} = require('../emailTemplates'); 

const resend = new Resend(process.env.RESEND_API_KEY);

// ==================================================
// 🛡️ ZOD VALIDATION SCHEMAS FOR AUTHENTICATION
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

const socialLoginSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  googleId: z.string().min(1, "Google ID is required")
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
// 🔐 DATA PROTECTION: SAFE USER RESPONSE FORMATTER
// ==================================================
const formatSafeUser = (user) => {
  if (!user) return null;
  return {
    id: user._id || user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role || 'customer',
    isPhoneVerified: user.isPhoneVerified || false,
    isActive: user.isActive,
    twoFactorEnabled: user.twoFactorEnabled || false,
    addresses: user.addresses || [],
    wishlist: user.wishlist || [],
    recentlyViewed: user.recentlyViewed || []
  };
};

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
// 🛡️ PHASE 9: ENDPOINT-SPECIFIC RATE LIMITERS
// ==================================================
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, 
  max: 5, 
  message: { error: "Too many login attempts from this IP. Please try again after 5 minutes." }
});

const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, 
  max: 3, 
  message: { error: "Too many OTP requests. Please wait before trying again." }
});

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 5, 
  message: { error: "Too many password reset attempts. Please try later." }
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, 
  max: 5, 
  message: { error: "Too many accounts created from this IP. Please try later." }
});

const unlockLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 5, 
  message: { error: "Too many unlock requests from this IP. Please try later." }
});

const generateSecureToken = (user, sessionId) => {
  if (!process.env.JWT_SECRET) {
    console.error("🚨 CRITICAL: JWT_SECRET is missing in .env!");
    throw new Error("Server Configuration Error");
  }
  return jwt.sign(
    { id: user._id, role: user.role, sid: sessionId }, 
    process.env.JWT_SECRET, 
    { expiresIn: '7d' } 
  );
};

// ==================================================
// 🔥 SEPARATED NAMESPACE COOKIE HELPER (CUSTOMER vs ADMIN)
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
      return res.status(400).json({ success: false, error: "Validation failed", errors: validationResult.error.format() });
    }

    const { email } = validationResult.data;
    const cleanEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({ success: false, error: "This email is already registered. Please login." });
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

    return res.status(200).json({ success: true, message: "Verification code started and sent successfully." });
  } catch (error) {
    console.error("Register Start Error:", error);
    return res.status(500).json({ success: false, error: "Failed to start registration process." });
  }
});

// ==================================================
// 1.1 CANONICAL REGISTRATION: VERIFY & FINISH 🔥
// ==================================================
router.post('/register/verify', registerLimiter, async (req, res) => {
  try {
    const validationResult = registerSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ success: false, error: "Validation failed", errors: validationResult.error.format() });
    }

    const { name, email, password, phone, verificationToken } = validationResult.data;
    const cleanEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({ success: false, error: "This email is already registered. Please login." });
    }

    let isPhoneVerified = false;
    let cleanPhone = phone ? phone.replace(/^\+91/, '').trim() : undefined;

    if (verificationToken && cleanPhone) {
      try {
        const decoded = jwt.verify(verificationToken, process.env.JWT_SECRET);
        if (decoded.verified && decoded.phone === cleanPhone) {
          isPhoneVerified = true;
          const phoneExists = await User.findOne({ phone: cleanPhone });
          if (phoneExists) {
            return res.status(400).json({ success: false, error: "This phone number is already linked to another account." });
          }
        } else {
          return res.status(400).json({ success: false, error: "Invalid or expired phone verification token." });
        }
      } catch (err) {
        return res.status(400).json({ success: false, error: "Phone verification session expired. Please verify again." });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({ 
      name, 
      email: cleanEmail, 
      password: hashedPassword, 
      phone: cleanPhone,
      isPhoneVerified,
      role: 'customer', 
      auditLogs: [{ action: 'REGISTER', details: 'User account created securely via canonical route', ip: req.ip || 'Unknown' }]
    });

    await newUser.save();

    const sessionId = crypto.randomBytes(16).toString('hex');
    const ip = req.ip || 'Unknown';
    const userAgent = req.headers['user-agent'] || 'Unknown Device';

    newUser.activeSessions = newUser.activeSessions || [];
    newUser.activeSessions.push({ sessionId, ipAddress: ip, device: userAgent, loginAt: new Date() });
    await newUser.save();

    const token = generateSecureToken(newUser, sessionId);
    setAuthCookie(res, token, newUser.role);

    return res.status(201).json({ 
      success: true, 
      message: "Welcome to Jack Essentials! Account created successfully.",
      user: formatSafeUser(newUser)
    });

  } catch (error) {
    console.error("Registration Verify Error:", error);
    return res.status(500).json({ success: false, error: "Internal Server Error. Please try again." });
  }
});

// Backward-compatible alias for /register
router.post('/register', registerLimiter, async (req, res) => {
  return router.handle({ ...req, url: '/register/verify' }, res);
});

// ==================================================
// 2. CANONICAL USER / ADMIN LOGIN 🔥
// ==================================================
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const validationResult = loginSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ success: false, error: "Validation failed", errors: validationResult.error.format() });
    }

    const { email, password, twoFactorCode } = validationResult.data;
    const cleanEmail = email.toLowerCase().trim();
    
    const lockoutStatus = checkAccountLockout(cleanEmail);
    if (lockoutStatus.isLocked) {
      return res.status(429).json({ 
        error: `Too many failed login attempts for this account. Please try again after ${lockoutStatus.remainingTime} minutes.` 
      });
    }

    const user = await User.findOne({ email: cleanEmail }).select('+password +twoFactorSecret');
    
    if (!user) {
      recordFailedAttempt(cleanEmail);
      return res.status(401).json({ error: "Invalid email or password." });
    }

    if (user.isLocked) {
      return res.status(403).json({ error: "Account is LOCKED.", isLocked: true, email: user.email });
    }

    if (!user.password) {
      return res.status(400).json({ error: "Please login using your Google account." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      recordFailedAttempt(cleanEmail); 
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      
      user.auditLogs = user.auditLogs || [];
      user.auditLogs.push({ action: 'FAILED_LOGIN', details: 'Incorrect password entered', ip: req.ip || 'Unknown' });
      
      await user.save();
      return res.status(401).json({ error: "Invalid email or password." });
    }

    if (user.twoFactorEnabled) {
      if (!twoFactorCode) {
        return res.status(200).json({ requiresTwoFactor: true, message: "2FA verification code required." });
      }
      if (twoFactorCode !== user.twoFactorSecret) {
        return res.status(400).json({ error: "Invalid 2FA code." });
      }
    }

    clearFailedAttempts(cleanEmail);
    user.failedLoginAttempts = 0;

    const sessionId = crypto.randomBytes(16).toString('hex');
    const ip = req.ip || 'Unknown Location';
    const userAgent = req.headers['user-agent'] || 'Unknown Device';
    const time = new Date();

    user.activeSessions = user.activeSessions || [];
    user.loginHistory = user.loginHistory || [];
    user.auditLogs = user.auditLogs || [];

    user.activeSessions.push({
      sessionId,
      ipAddress: ip,
      device: userAgent,
      loginAt: time
    });

    user.loginHistory.push({
      ipAddress: ip,
      device: userAgent,
      status: 'SUCCESS',
      timestamp: time
    });

    user.auditLogs.push({
      action: 'LOGIN',
      details: `Successful login from device: ${userAgent}`,
      ip
    });

    const token = generateSecureToken(user, sessionId);
    setAuthCookie(res, token, user.role);

    const lockToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = lockToken;
    user.resetPasswordExpire = Date.now() + 3000000; 
    await user.save();

    const timeString = time.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const lockLink = `https://thejackessentials.com/secure-account?token=${lockToken}`;
    const accountAgeInMinutes = (Date.now() - new Date(user.createdAt || Date.now()).getTime()) / 60000;

    if (process.env.RESEND_API_KEY && accountAgeInMinutes >= 2) {
      const htmlContent = getLoginAlertTemplate(user.name || 'User', userAgent, timeString, ip, lockLink);
      resend.emails.send({
        from: 'Jack Essentials Security <updates@thejackessentials.com>', 
        to: [user.email],
        subject: '⚠️ Security Alert: New Login to your Account',
        html: htmlContent
      }).catch(err => console.error("DEBUG: Failed to send login alert:", err));
    }

    return res.json({ message: "Authentication successful.", user: formatSafeUser(user) });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({ error: "An unexpected error occurred during authentication." });
  }
});

// ==================================================
// 3. CANONICAL SOCIAL LOGIN: GOOGLE 🔥
// ==================================================
router.post('/social/google', loginLimiter, async (req, res) => {
  try {
    const validationResult = socialLoginSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ success: false, error: "Validation failed", errors: validationResult.error.format() });
    }

    const { name, email, googleId } = validationResult.data;
    const cleanEmail = email.toLowerCase().trim();

    let user = await User.findOne({ email: cleanEmail });
    let isNewUser = false;

    if (user && user.isLocked) {
      return res.status(403).json({ error: "Account is LOCKED.", isLocked: true, email: user.email });
    }

    const sessionId = crypto.randomBytes(16).toString('hex');
    const ip = req.ip || 'Unknown Location';
    const userAgent = req.headers['user-agent'] || 'Unknown Device';

    if (!user) {
      user = new User({ 
        name, 
        email: cleanEmail, 
        googleId, 
        role: 'customer', 
        activeSessions: [{ sessionId, ipAddress: ip, device: userAgent, loginAt: new Date() }],
        auditLogs: [{ action: 'SOCIAL_REGISTER', details: 'Registered via Google OAuth', ip }]
      });
      await user.save();
      isNewUser = true;
    } else {
      if (!user.googleId) user.googleId = googleId;
      user.activeSessions = user.activeSessions || [];
      user.auditLogs = user.auditLogs || [];

      user.activeSessions.push({ sessionId, ipAddress: ip, device: userAgent, loginAt: new Date() });
      user.auditLogs.push({ action: 'SOCIAL_LOGIN', details: 'Logged in via Google OAuth', ip });
      await user.save();
    }

    const token = generateSecureToken(user, sessionId);
    setAuthCookie(res, token, user.role);
    
    return res.json({ message: "Social Login Successful", user: formatSafeUser(user), isNewUser });
  } catch (error) {
    console.error("Social Login Error:", error);
    return res.status(500).json({ error: "Google authentication failed on server." });
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
      return res.status(401).json({ success: false, error: 'No active session token found in cookies' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || user.isActive === false || user.isLocked) {
      return res.status(401).json({ success: false, error: 'Session invalid or user inactive/locked' });
    }

    const newSessionId = decoded.sid || crypto.randomBytes(16).toString('hex');
    const newToken = generateSecureToken(user, newSessionId);
    setAuthCookie(res, newToken, user.role);

    return res.status(200).json({ success: true, message: 'Session refreshed successfully' });
  } catch (error) {
    console.error("Token Refresh Error:", error);
    return res.status(401).json({ success: false, error: 'Invalid or expired session token' });
  }
});

// ==================================================
// 5. PASSWORD RESET: SEND SECURE OTP
// ==================================================
router.post('/send-otp', otpLimiter, async (req, res) => {
  try {
    const validationResult = otpRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ success: false, error: "Validation failed", errors: validationResult.error.format() });
    }

    const cleanEmail = validationResult.data.email.toLowerCase().trim();
    const userExists = await User.findOne({ email: cleanEmail });
    if (!userExists) return res.status(404).json({ error: "Account not found." });

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

    return res.json({ message: "OTP sent to your email." });
  } catch (error) {
    console.error("Send OTP Error:", error);
    return res.status(500).json({ error: "Failed to send OTP." });
  }
});

// ==================================================
// 6. PASSWORD RESET: VERIFY OTP
// ==================================================
router.post('/verify-otp', resetLimiter, async (req, res) => {
  try {
    const validationResult = verifyOtpSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ success: false, error: "Validation failed", errors: validationResult.error.format() });
    }

    const { email, otp } = validationResult.data;
    const cleanEmail = email.toLowerCase().trim();
    const cleanOtp = String(otp).trim(); 
    
    const user = await User.findOne({ email: cleanEmail }).lean();
    if (!user || !user.resetOTP || !user.resetOTPExpires) {
      return res.status(400).json({ error: "No OTP request found for this email." });
    }

    if (Date.now() > user.resetOTPExpires) {
      return res.status(400).json({ error: "OTP has expired. Please request a new one." });
    }

    const isMatch = await bcrypt.compare(cleanOtp, user.resetOTP);
    if (!isMatch) {
      return res.status(400).json({ error: "Incorrect OTP. Please try again." });
    }

    return res.json({ message: "OTP Verified successfully." });
  } catch (error) {
    console.error("Verify OTP Error:", error);
    return res.status(500).json({ error: "Verification failed." });
  }
});

// ==================================================
// 7. RESET PASSWORD
// ==================================================
router.post('/reset-password', resetLimiter, async (req, res) => {
  try {
    const validationResult = resetPasswordSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ success: false, error: "Validation failed", errors: validationResult.error.format() });
    }

    const { email, otp, newPassword } = validationResult.data;
    const cleanEmail = email.toLowerCase().trim();
    const cleanOtp = String(otp).trim();
    
    const user = await User.findOne({ email: cleanEmail });
    if (!user || !user.resetOTP || Date.now() > user.resetOTPExpires) {
      return res.status(400).json({ error: "Session expired. Please request a new OTP." });
    }

    const isMatch = await bcrypt.compare(cleanOtp, user.resetOTP);
    if (!isMatch) {
      return res.status(400).json({ error: "Security validation failed. Incorrect OTP." });
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
      const successHtml = getPasswordChangedTemplate(user.name, loginLink);
      await resend.emails.send({
        from: 'Jack Essentials Security <updates@thejackessentials.com>',
        to: [user.email],
        subject: '✅ Password Successfully Changed - Jack Essentials',
        html: successHtml
      });
    }

    return res.json({ message: "Password successfully updated!" });
  } catch (error) {
    console.error("Reset Password Error:", error);
    return res.status(500).json({ error: "Failed to reset password." });
  }
});

// ==================================================
// 7.1 🔥 PASSWORD ROTATION (Logged-in User)
// ==================================================
router.post('/rotate-password', protect, async (req, res) => {
  try {
    const validationResult = rotatePasswordSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ success: false, error: "Validation failed", errors: validationResult.error.format() });
    }

    const { currentPassword, newPassword } = validationResult.data;
    const user = await User.findById(req.user._id).select('+password');

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Incorrect current password." });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.auditLogs = user.auditLogs || [];
    user.auditLogs.push({ action: 'PASSWORD_ROTATE', details: 'Password rotated successfully from account settings', ip: req.ip || 'Unknown' });
    await user.save();

    return res.json({ success: true, message: "Password rotated successfully." });
  } catch (error) {
    console.error("Password Rotation Error:", error);
    return res.status(500).json({ error: "Failed to rotate password." });
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

    return res.json({ 
      success: true, 
      twoFactorEnabled: user.twoFactorEnabled, 
      tempSecret: user.twoFactorSecret, 
      message: `2FA is now ${user.twoFactorEnabled ? 'Enabled' : 'Disabled'}` 
    });
  } catch (error) {
    console.error("2FA Toggle Error:", error);
    return res.status(500).json({ error: "Failed to update 2FA settings." });
  }
});

// ==================================================
// 7.3 🔥 ACTIVE SESSIONS & SECURITY CENTER ENDPOINTS
// ==================================================
router.get('/security/audit-center', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('activeSessions loginHistory auditLogs twoFactorEnabled isLocked');
    if (!user) return res.status(404).json({ error: "User not found" });

    return res.json({
      success: true,
      twoFactorEnabled: user.twoFactorEnabled || false,
      isLocked: user.isLocked || false,
      activeSessions: user.activeSessions || [],
      loginHistory: user.loginHistory || [],
      auditLogs: user.auditLogs || []
    });
  } catch (error) {
    console.error("Fetch Security Center Error:", error);
    return res.status(500).json({ error: "Failed to fetch security analytics." });
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

    return res.json({ success: true, message: "Session revoked successfully." });
  } catch (error) {
    console.error("Revoke Session Error:", error);
    return res.status(500).json({ error: "Failed to revoke session." });
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

    return res.json({ success: true, message: "All sessions terminated successfully." });
  } catch (error) {
    console.error("Logout All Error:", error);
    return res.status(500).json({ error: "Failed to terminate all sessions." });
  }
});

// ==================================================
// 8. SECURE LOCK ACCOUNT
// ==================================================
router.post('/lock-account', async (req, res) => {
  try {
    const validationResult = lockAccountSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ success: false, error: "Validation failed", errors: validationResult.error.format() });
    }

    const { token, newSecurityCode } = validationResult.data;
    const user = await User.findOne({ resetPasswordToken: token });
    if (!user || user.resetPasswordExpire < Date.now()) {
      return res.status(400).json({ error: "Lock link is invalid or expired. Please login again." });
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
    
    return res.json({ success: true, message: "Account locked securely.", userId: user._id });
  } catch (error) { 
    console.error("Lock Account Error:", error);
    return res.status(500).json({ error: "Failed to lock account." }); 
  }
});

// ==================================================
// 9. HARDENED UNLOCK ACCOUNT API
// ==================================================
router.post('/unlock-account', unlockLimiter, async (req, res) => {
  try {
    const validationResult = unlockAccountSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ success: false, error: "Validation failed", errors: validationResult.error.format() });
    }

    const { email, pin } = validationResult.data;
    const cleanEmail = email.toLowerCase().trim();

    const lockoutStatus = checkUnlockLockout(cleanEmail);
    if (lockoutStatus.isLocked) {
      return res.status(429).json({ 
        error: `Too many incorrect PIN attempts. Account unlock is temporarily blocked. Try again after ${lockoutStatus.remainingTime} minutes.` 
      });
    }

    const user = await User.findOne({ email: cleanEmail }).select('+securityCode');
    if (!user || !user.isLocked) {
      recordFailedUnlock(cleanEmail);
      return res.status(400).json({ error: "Invalid unlock request or account is not locked." });
    }

    const isMatch = await bcrypt.compare(pin, user.securityCode);
    if (!isMatch) {
      recordFailedUnlock(cleanEmail);
      return res.status(400).json({ error: "Incorrect Security PIN." });
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

    const token = generateSecureToken(user, sessionId);
    setAuthCookie(res, token, user.role);

    return res.json({ success: true, message: "Account Unlocked Successfully!", user: formatSafeUser(user) });
  } catch (error) { 
    console.error("Unlock Account Critical Error:", error);
    return res.status(500).json({ error: "Failed to process account unlock." }); 
  }
});

// ==================================================
// 10. CANONICAL LOGOUT ENDPOINT 🔥
// ==================================================
router.post('/logout', protect, async (req, res) => {
  try {
    const targetSessionId = req.sessionId || (req.user && req.user.sessionId);
    if (req.user && targetSessionId) {
      await User.findByIdAndUpdate(req.user._id, {
        $pull: { activeSessions: { sessionId: targetSessionId } }
      });
    }
  } catch (e) {
    console.error("Logout session pull error:", e);
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

  return res.json({ success: true, message: "Logged out successfully." });
});

// ==================================================
// 11. CANONICAL SESSION VALIDATION ENDPOINT (/auth/me) 🔥
// ==================================================
router.get('/me', protect, async (req, res) => {
  try {
    const user = req.user; 
    if (!user || user.isActive === false) {
      return res.status(401).json({ success: false, message: 'User not found or inactive' });
    }

    return res.status(200).json({
      id: user._id || user.id,
      name: user.name,
      email: user.email,
      role: user.role || 'customer',
      isActive: user.isActive,
      twoFactorEnabled: user.twoFactorEnabled || false,
      recentlyViewed: user.recentlyViewed || [],
      addresses: user.addresses || []
    });
  } catch (error) {
    console.error("Auth /me error:", error);
    return res.status(500).json({ success: false, message: 'Server error during session validation' });
  }
});

module.exports = router;