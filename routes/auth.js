const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto'); 
const rateLimit = require('express-rate-limit'); 
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware'); 
const { z } = require('zod'); // 🔥 ADDED: Zod for strict input validation

const { Resend } = require('resend');
const { 
  getResetOtpTemplate, 
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
  password: z.string().min(1, "Password is required")
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

// ==================================================
// 🛡️ ACCOUNT-LEVEL FAILED LOGIN TRACKER (Anti-Brute Force)
// ==================================================
const failedLoginAttempts = new Map();

// Cleanup old tracking data every 15 minutes to prevent memory leaks
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
// 🛡️ DEDICATED UNLOCK ATTEMPT TRACKER (Anti-Brute Force)
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
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // Max 5 login attempts per 5 minutes per IP
  message: { error: "Too many login attempts from this IP. Please try again after 5 minutes." }
});

const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 3, // Max 3 OTP requests per 10 minutes per IP
  message: { error: "Too many OTP requests. Please wait before trying again." }
});

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Max 5 attempts for password reset/verify
  message: { error: "Too many password reset attempts. Please try later." }
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Max 5 account creations per IP per hour
  message: { error: "Too many accounts created from this IP. Please try later." }
});

const unlockLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 5, // Max 5 unlock requests per 15 minutes per IP
  message: { error: "Too many unlock requests from this IP. Please try later." }
});

// 🔥 Helper Function to Generate JWT Safely (BUG FIXED HERE)
const generateSecureToken = (user) => {
  if (!process.env.JWT_SECRET) {
    console.error("🚨 CRITICAL: JWT_SECRET is missing in .env!");
    throw new Error("Server Configuration Error");
  }
  return jwt.sign(
    { id: user._id, role: user.role }, 
    process.env.JWT_SECRET, 
    { expiresIn: '7d' } // 🚨 Fixed: Removed algorithms: ['HS256'] from options
  );
};

// ==================================================
// 🛡️ HELPER: Set Separated Secure HttpOnly Cookies (Admin vs Customer)
// ==================================================
const setAuthCookie = (res, token, role) => {
  const cookieName = role === 'admin' ? 'admin_token' : 'token';
  const maxAgeValue = role === 'admin' ? 8 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000; // 8 hours for admin, 7 days for customer

  res.cookie(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
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
      role: 'customer' 
    });

    await newUser.save();
    res.status(201).json({ message: "Welcome to Jack Essentials! Account created successfully." });

  } catch (error) {
    console.error("Registration Error:", error);
    res.status(500).json({ error: "Internal Server Error. Please try again." });
  }
});

// ==================================================
// 2. USER / ADMIN LOGIN (ZOD VALIDATED) 🔥
// ==================================================
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const validationResult = loginSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ success: false, error: "Validation failed", errors: validationResult.error.format() });
    }

    const { email, password } = validationResult.data;
    const cleanEmail = email.toLowerCase().trim();
    
    // 🔥 Check Account-Level Rate Limit (5 failed attempts / 15 mins per account)
    const lockoutStatus = checkAccountLockout(cleanEmail);
    if (lockoutStatus.isLocked) {
      return res.status(429).json({ 
        error: `Too many failed login attempts for this account. Please try again after ${lockoutStatus.remainingTime} minutes.` 
      });
    }

    const user = await User.findOne({ email: cleanEmail }).select('+password');
    
    // 🛡️ SECURITY FIX: Prevent email enumeration by returning identical generic error
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
      recordFailedAttempt(cleanEmail); // 🔥 Increment failed count per account on incorrect password
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // 🔥 Clear failed attempts tracking on successful login
    clearFailedAttempts(cleanEmail);

    const token = generateSecureToken(user);
    
    // 🔥 SET SEPARATED SECURE HTTP-ONLY COOKIE (admin_token vs token)
    setAuthCookie(res, token, user.role);

    const lockToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = lockToken;
    user.resetPasswordExpire = Date.now() + 3000000; // 50 Mins
    await user.save();

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown Location';
    const userAgent = req.headers['user-agent'] || 'Unknown Device';
    const time = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    
    const lockLink = `https://thejackessentials.com/secure-account?token=${lockToken}`;
    
    const accountAgeInMinutes = (Date.now() - new Date(user.createdAt || Date.now()).getTime()) / 60000;
    const isBrandNewUser = accountAgeInMinutes < 2;

    if (process.env.RESEND_API_KEY && !isBrandNewUser) {
      const htmlContent = getLoginAlertTemplate(user.name || 'User', userAgent, time, ip, lockLink);
      resend.emails.send({
        from: 'Jack Essentials Security <updates@thejackessentials.com>', 
        to: [user.email],
        subject: '⚠️ Security Alert: New Login to your Account',
        html: htmlContent
      }).catch(err => console.error("DEBUG: Failed to send login alert:", err));
    }

    user.password = undefined;

    res.json({ message: "Authentication successful.", token, user });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: "An unexpected error occurred during authentication." });
  }
});

// ==================================================
// 3. SOCIAL LOGIN (ZOD VALIDATED) 🔥
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

    if (!user) {
      user = new User({ name, email: cleanEmail, googleId, role: 'customer' });
      await user.save();
      isNewUser = true;
    } else if (!user.googleId) {
      user.googleId = googleId;
      await user.save();
    }

    const token = generateSecureToken(user);
    
    // 🔥 SET SEPARATED SECURE HTTP-ONLY COOKIE
    setAuthCookie(res, token, user.role);
    
    const lockToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = lockToken;
    user.resetPasswordExpire = Date.now() + 3000000;
    await user.save();

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown Location';
    const userAgent = req.headers['user-agent'] || 'Unknown Device';
    const time = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const lockLink = `https://thejackessentials.com/secure-account?token=${lockToken}`;

    if (process.env.RESEND_API_KEY && !isNewUser) {
      const htmlContent = getLoginAlertTemplate(user.name || 'User', userAgent, time, ip, lockLink);
      resend.emails.send({
        from: 'Jack Essentials Security <updates@thejackessentials.com>', 
        to: [user.email],
        subject: '⚠️ Security Alert: New Login via Google/Social',
        html: htmlContent
      }).catch(err => {});
    }

    res.json({ message: "Social Login Successful", token, user, isNewUser });
  } catch (error) {
    console.error("Social Login Error:", error);
    res.status(500).json({ error: "Google authentication failed on server." });
  }
});

// ==================================================
// 4. 🔥 PASSWORD RESET: SEND SECURE OTP (ZOD VALIDATED)
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
    const expiresAt = Date.now() + 600000; // 10 Mins
    
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
// 5. 🔥 PASSWORD RESET: VERIFY OTP (ZOD VALIDATED)
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
      await User.collection.updateOne(
        { _id: user._id },
        { $unset: { resetOTP: "", resetOTPExpires: "" } }
      );
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
// 6. 🔥 RESET PASSWORD (ZOD VALIDATED)
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
    
    const user = await User.findOne({ email: cleanEmail }).lean();
    
    if (!user || !user.resetOTP || Date.now() > user.resetOTPExpires) {
      return res.status(400).json({ error: "Session expired. Please request a new OTP." });
    }

    const isMatch = await bcrypt.compare(cleanOtp, user.resetOTP);
    if (!isMatch) {
      return res.status(400).json({ error: "Security validation failed. Incorrect OTP." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await User.collection.updateOne(
      { _id: user._id },
      { 
        $set: { password: hashedPassword },
        $unset: { resetOTP: "", resetOTPExpires: "" }
      }
    );

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
// 7. 🔥 SECURE LOCK ACCOUNT (ZOD VALIDATED) 🔥
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
    await user.save();
    
    res.json({ success: true, message: "Account locked securely.", userId: user._id });
  } catch (error) { 
    console.error("Lock Account Error:", error);
    res.status(500).json({ error: "Failed to lock account." }); 
  }
});

// ==================================================
// 8. 🔥 HARDENED UNLOCK ACCOUNT API (ZOD VALIDATED) 🔥
// ==================================================
router.post('/unlock-account', unlockLimiter, async (req, res) => {
  try {
    const validationResult = unlockAccountSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ success: false, error: "Validation failed", errors: validationResult.error.format() });
    }

    const { email, pin } = validationResult.data;
    const cleanEmail = email.toLowerCase().trim();

    // 🛡️ 1. Check Account-Level Temporary Lockout for Unlock attempts
    const lockoutStatus = checkUnlockLockout(cleanEmail);
    if (lockoutStatus.isLocked) {
      console.warn(`🚨 SECURITY AUDIT: Brute-force attempt blocked on locked account: ${cleanEmail} from IP: ${req.headers['x-forwarded-for'] || req.socket.remoteAddress}`);
      return res.status(429).json({ 
        error: `Too many incorrect PIN attempts. Account unlock is temporarily blocked. Try again after ${lockoutStatus.remainingTime} minutes.` 
      });
    }

    const user = await User.findOne({ email: cleanEmail });
    
    // 🛡️ 2. Generic error to prevent enumeration or revealing status
    if (!user || !user.isLocked) {
      recordFailedUnlock(cleanEmail);
      return res.status(400).json({ error: "Invalid unlock request or account is not locked." });
    }

    const isMatch = await bcrypt.compare(pin, user.securityCode);
    if (!isMatch) {
      recordFailedUnlock(cleanEmail); // 🔥 Increment failed counter per account
      console.warn(`⚠️ SECURITY AUDIT: Failed PIN entry for locked account: ${cleanEmail} from IP: ${req.headers['x-forwarded-for'] || req.socket.remoteAddress}`);
      return res.status(400).json({ error: "Incorrect Security PIN." });
    }

    // 🔥 3. Clear tracking on successful unlock
    clearFailedUnlock(cleanEmail);

    await User.collection.updateOne(
      { _id: user._id },
      {
        $set: { isLocked: false },
        $unset: { securityCode: "" }
      }
    );

    const token = generateSecureToken(user);
    
    // 🔥 SET SEPARATED SECURE HTTP-ONLY COOKIE ON UNLOCK TOO
    setAuthCookie(res, token, user.role);
    
    const updatedUser = await User.findById(user._id);
    updatedUser.password = undefined;
    updatedUser.securityCode = undefined;

    // 🔥 4. Audit Log Successful Unlock Event
    console.info(`✅ SECURITY AUDIT: Account successfully unlocked for: ${cleanEmail} via IP: ${req.headers['x-forwarded-for'] || req.socket.remoteAddress}`);

    res.json({ success: true, message: "Account Unlocked Successfully!", token, user: updatedUser });
  } catch (error) { 
    console.error("Unlock Account Critical Error:", error);
    res.status(500).json({ error: "Failed to process account unlock." }); 
  }
});

// ==================================================
// 9. 🔥 LOGOUT ENDPOINT (Clears Both Admin and Customer Cookies)
// ==================================================
router.post('/logout', (req, res) => {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  };

  res.clearCookie('token', cookieOptions);
  res.clearCookie('admin_token', cookieOptions);

  res.json({ success: true, message: "Logged out successfully." });
});

// ==================================================
// 10. 🔥 SESSION VALIDATION ENDPOINT (/auth/me)
// ==================================================
router.get('/me', protect, async (req, res) => {
  try {
    const user = req.user; // protect middleware already fetched and attached user
    if (!user || user.isActive === false) {
      return res.status(401).json({ success: false, message: 'User not found or inactive' });
    }

    res.status(200).json({
      id: user._id || user.id,
      name: user.name,
      email: user.email,
      role: user.role || 'customer',
      isActive: user.isActive,
      recentlyViewed: user.recentlyViewed || [],
      addresses: user.addresses || []
    });
  } catch (error) {
    console.error("Auth /me error:", error);
    res.status(500).json({ success: false, message: 'Server error during session validation' });
  }
});

module.exports = router;