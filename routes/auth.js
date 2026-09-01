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
  password: z.string().min(6, "Password must be at least 6 characters long")
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
// 🛡️ HELPER: Set Separated Secure HttpOnly Cookies
// ==================================================
const setAuthCookie = (res, token, role) => {
  const cookieName = role === 'admin' ? 'admin_token' : 'token';
  const maxAgeValue = role === 'admin' ? 8 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000; 

  res.cookie(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: maxAgeValue
  });
};

// ==================================================
// 1. PUBLIC REGISTRATION (Customers) - ZOD VALIDATED 🔥
// ==================================================
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const validationResult = registerSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ success: false, error: "Validation failed", errors: validationResult.error.format() });
    }

    const { name, email, password } = validationResult.data;
    const cleanEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({ error: "This email is already registered. Please login." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({ 
      name, 
      email: cleanEmail, 
      password: hashedPassword, 
      role: 'customer',
      auditLogs: [{ action: 'REGISTER', details: 'User account created', ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress }]
    });

    await newUser.save();
    res.status(201).json({ message: "Welcome to Jack Essentials! Account created successfully." });

  } catch (error) {
    console.error("Registration Error:", error);
    res.status(500).json({ error: "Internal Server Error. Please try again." });
  }
});

// ==================================================
// 2. USER / ADMIN LOGIN (HARDENED WITH SESSIONS & 2FA) 🔥
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
      
      // 🔥 SAFE ARRAY FALLBACK TO PREVENT UNDEFINED PUSH CRASH
      user.auditLogs = user.auditLogs || [];
      user.auditLogs.push({ action: 'FAILED_LOGIN', details: 'Incorrect password entered', ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress });
      
      await user.save();
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // 🔥 Check 2FA if enabled
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

    // 🔥 Generate Session ID & Track Active Session
    const sessionId = crypto.randomBytes(16).toString('hex');
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown Location';
    const userAgent = req.headers['user-agent'] || 'Unknown Device';
    const time = new Date();

    // 🔥 SAFE ARRAY INITIALIZATIONS
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

    user.password = undefined;
    user.twoFactorSecret = undefined;

    res.json({ message: "Authentication successful.", token, user });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: "An unexpected error occurred during authentication." });
  }
});

// ==================================================
// 3. SOCIAL LOGIN (HARDENED WITH SESSION TRACKING) 🔥
// ==================================================
router.post('/social-login', loginLimiter, async (req, res) => {
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
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown Location';
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

    user.password = undefined;
    res.json({ message: "Social Login Successful", token, user, isNewUser });
  } catch (error) {
    console.error("Social Login Error:", error);
    res.status(500).json({ error: "Google authentication failed on server." });
  }
});

// ==================================================
// 4. PASSWORD RESET: SEND SECURE OTP
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
    userExists.auditLogs.push({ action: 'OTP_REQUESTED', details: 'Password reset OTP requested', ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress });
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

    res.json({ message: "OTP sent to your email." });
  } catch (error) {
    console.error("Send OTP Error:", error);
    res.status(500).json({ error: "Failed to send OTP." });
  }
});

// ==================================================
// 5. PASSWORD RESET: VERIFY OTP
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

    res.json({ message: "OTP Verified successfully." });
  } catch (error) {
    console.error("Verify OTP Error:", error);
    res.status(500).json({ error: "Verification failed." });
  }
});

// ==================================================
// 6. RESET PASSWORD
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
    user.auditLogs.push({ action: 'PASSWORD_RESET', details: 'Password reset successfully via OTP', ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress });
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

    res.json({ message: "Password successfully updated!" });
  } catch (error) {
    console.error("Reset Password Error:", error);
    res.status(500).json({ error: "Failed to reset password." });
  }
});

// ==================================================
// 6.1 🔥 PASSWORD ROTATION (Logged-in User)
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
    user.auditLogs.push({ action: 'PASSWORD_ROTATE', details: 'Password rotated successfully from account settings', ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress });
    await user.save();

    res.json({ success: true, message: "Password rotated successfully." });
  } catch (error) {
    console.error("Password Rotation Error:", error);
    res.status(500).json({ error: "Failed to rotate password." });
  }
});

// ==================================================
// 6.2 🔥 2FA TOGGLE & SETUP ENDPOINTS
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
    user.auditLogs.push({ action: '2FA_TOGGLE', details: `2FA set to ${user.twoFactorEnabled}`, ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress });
    await user.save();

    res.json({ 
      success: true, 
      twoFactorEnabled: user.twoFactorEnabled, 
      tempSecret: user.twoFactorSecret, 
      message: `2FA is now ${user.twoFactorEnabled ? 'Enabled' : 'Disabled'}` 
    });
  } catch (error) {
    console.error("2FA Toggle Error:", error);
    res.status(500).json({ error: "Failed to update 2FA settings." });
  }
});

// ==================================================
// 6.3 🔥 ACTIVE SESSIONS & SECURITY CENTER ENDPOINTS
// ==================================================
router.get('/security/audit-center', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('activeSessions loginHistory auditLogs twoFactorEnabled isLocked');
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({
      success: true,
      twoFactorEnabled: user.twoFactorEnabled || false,
      isLocked: user.isLocked || false,
      activeSessions: user.activeSessions || [],
      loginHistory: user.loginHistory || [],
      auditLogs: user.auditLogs || []
    });
  } catch (error) {
    console.error("Fetch Security Center Error:", error);
    res.status(500).json({ error: "Failed to fetch security analytics." });
  }
});

router.post('/sessions/revoke', protect, async (req, res) => {
  try {
    const { sessionId } = req.body;
    const user = await User.findById(req.user._id);

    user.activeSessions = user.activeSessions || [];
    user.activeSessions = user.activeSessions.filter(s => s.sessionId !== sessionId);
    user.auditLogs = user.auditLogs || [];
    user.auditLogs.push({ action: 'SESSION_REVOKE', details: `Revoked session ID: ${sessionId}`, ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress });
    await user.save();

    res.json({ success: true, message: "Session revoked successfully." });
  } catch (error) {
    console.error("Revoke Session Error:", error);
    res.status(500).json({ error: "Failed to revoke session." });
  }
});

router.post('/sessions/logout-all', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.activeSessions = [];
    user.auditLogs = user.auditLogs || [];
    user.auditLogs.push({ action: 'LOGOUT_ALL_SESSIONS', details: 'Terminated all active sessions across devices', ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress });
    await user.save();

    const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax' };
    res.clearCookie('token', cookieOptions);
    res.clearCookie('admin_token', cookieOptions);

    res.json({ success: true, message: "All sessions terminated successfully." });
  } catch (error) {
    console.error("Logout All Error:", error);
    res.status(500).json({ error: "Failed to terminate all sessions." });
  }
});

// ==================================================
// 7. SECURE LOCK ACCOUNT
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
    user.auditLogs.push({ action: 'EMERGENCY_LOCK', details: 'Account manually locked via security alert link', ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress });
    await user.save();
    
    res.json({ success: true, message: "Account locked securely.", userId: user._id });
  } catch (error) { 
    console.error("Lock Account Error:", error);
    res.status(500).json({ error: "Failed to lock account." }); 
  }
});

// ==================================================
// 8. HARDENED UNLOCK ACCOUNT API
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
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    user.isLocked = false;
    user.securityCode = undefined;
    user.activeSessions = user.activeSessions || [];
    user.auditLogs = user.auditLogs || [];

    user.activeSessions.push({ sessionId, ipAddress: ip, device: req.headers['user-agent'] || 'Unlock Device', loginAt: new Date() });
    user.auditLogs.push({ action: 'ACCOUNT_UNLOCKED', details: 'Account successfully unlocked via Security PIN', ip });
    await user.save();

    const token = generateSecureToken(user, sessionId);
    setAuthCookie(res, token, user.role);
    
    user.password = undefined;
    user.securityCode = undefined;

    res.json({ success: true, message: "Account Unlocked Successfully!", token, user });
  } catch (error) { 
    console.error("Unlock Account Critical Error:", error);
    res.status(500).json({ error: "Failed to process account unlock." }); 
  }
});

// ==================================================
// 9. LOGOUT ENDPOINT
// ==================================================
router.post('/logout', protect, async (req, res) => {
  try {
    if (req.user && req.user.sessionId) {
      await User.findByIdAndUpdate(req.user._id, {
        $pull: { activeSessions: { sessionId: req.user.sessionId } }
      });
    }
  } catch (e) {}

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
  };

  res.clearCookie('token', cookieOptions);
  res.clearCookie('admin_token', cookieOptions);

  res.json({ success: true, message: "Logged out successfully." });
});

// ==================================================
// 10. SESSION VALIDATION ENDPOINT (/auth/me)
// ==================================================
router.get('/me', protect, async (req, res) => {
  try {
    const user = req.user; 
    if (!user || user.isActive === false) {
      return res.status(401).json({ success: false, message: 'User not found or inactive' });
    }

    res.status(200).json({
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
    res.status(500).json({ success: false, message: 'Server error during session validation' });
  }
});

module.exports = router;