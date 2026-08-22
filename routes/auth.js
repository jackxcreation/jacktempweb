const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto'); 
const rateLimit = require('express-rate-limit'); 
const User = require('../models/User');

const { Resend } = require('resend');
const { 
  getResetOtpTemplate, 
  getPasswordChangedTemplate, 
  getLoginAlertTemplate 
} = require('../emailTemplates'); 

const resend = new Resend(process.env.RESEND_API_KEY);

// ==================================================
// 🛡️ PHASE 9: ENDPOINT-SPECIFIC RATE LIMITERS
// ==================================================
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // Max 5 login attempts per 5 minutes
  message: { error: "Too many login attempts. Please try again after 5 minutes." }
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

// 🔥 Helper Function to Generate JWT Safely
const generateSecureToken = (user) => {
  if (!process.env.JWT_SECRET) {
    console.error("🚨 CRITICAL: JWT_SECRET is missing in .env!");
    throw new Error("Server Configuration Error");
  }
  return jwt.sign(
    { id: user._id, role: user.role }, 
    process.env.JWT_SECRET, 
    { expiresIn: '7d' }
  );
};

// ==================================================
// 1. PUBLIC REGISTRATION (Customers)
// ==================================================
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { name, email, password } = req.body;
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
// 2. USER / ADMIN LOGIN (WITH SECURITY ALERT & LOCK CHECK) 🔥
// ==================================================
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const cleanEmail = email.toLowerCase().trim();
    
    const user = await User.findOne({ email: cleanEmail }).select('+password');
    if (!user) {
      return res.status(404).json({ error: "Account not found. Please register first." });
    }

    if (user.isLocked) {
      return res.status(403).json({ error: "Account is LOCKED.", isLocked: true, email: user.email });
    }

    if (!user.password) {
      return res.status(400).json({ error: "Please login using your Google account." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid credentials. Please check your password." });
    }

    const token = generateSecureToken(user);

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
// 3. SOCIAL LOGIN (WITH ALERT & LOCK CHECK) 🔥
// ==================================================
router.post('/social-login', loginLimiter, async (req, res) => {
  try {
    const { name, email, googleId } = req.body;
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
// 4. 🔥 PASSWORD RESET: SEND SECURE OTP
// ==================================================
router.post('/send-otp', otpLimiter, async (req, res) => {
  try {
    const emailInput = req.body.email.trim();
    const emailRegex = new RegExp(`^${emailInput}$`, 'i');
    
    const userExists = await User.findOne({ email: emailRegex });
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
// 5. 🔥 PASSWORD RESET: VERIFY OTP
// ==================================================
router.post('/verify-otp', resetLimiter, async (req, res) => {
  try {
    const emailInput = req.body.email.trim();
    const otp = String(req.body.otp).trim();
    const emailRegex = new RegExp(`^${emailInput}$`, 'i'); 
    
    const user = await User.findOne({ email: emailRegex }).lean();
    
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

    const isMatch = await bcrypt.compare(otp, user.resetOTP);
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
// 6. 🔥 RESET PASSWORD
// ==================================================
router.post('/reset-password', resetLimiter, async (req, res) => {
  try {
    const emailInput = req.body.email.trim();
    const otp = String(req.body.otp).trim();
    const { newPassword } = req.body;
    const emailRegex = new RegExp(`^${emailInput}$`, 'i');
    
    const user = await User.findOne({ email: emailRegex }).lean();
    
    if (!user || !user.resetOTP || Date.now() > user.resetOTPExpires) {
      return res.status(400).json({ error: "Session expired. Please request a new OTP." });
    }

    const isMatch = await bcrypt.compare(otp, user.resetOTP);
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
// 7. 🔥 SECURE LOCK ACCOUNT (End-to-End Encrypted) 🔥
// ==================================================
router.post('/lock-account', async (req, res) => {
  try {
    const { token, newSecurityCode } = req.body;
    if (!token || !newSecurityCode) return res.status(400).json({ error: "Token and PIN are required." });

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
// 8. 🔥 UNLOCK ACCOUNT API 🔥
// ==================================================
router.post('/unlock-account', loginLimiter, async (req, res) => {
  try {
    const { email, pin } = req.body;
    const cleanEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: cleanEmail });
    if (!user || !user.isLocked) return res.status(400).json({ error: "Account is not locked or not found." });

    const isMatch = await bcrypt.compare(pin, user.securityCode);
    if (!isMatch) return res.status(400).json({ error: "Incorrect Security PIN." });

    await User.collection.updateOne(
      { _id: user._id },
      {
        $set: { isLocked: false },
        $unset: { securityCode: "" }
      }
    );

    const token = generateSecureToken(user);
    
    const updatedUser = await User.findById(user._id);
    updatedUser.password = undefined;
    updatedUser.securityCode = undefined;

    res.json({ success: true, message: "Account Unlocked!", token, user: updatedUser });
  } catch (error) { 
    console.error("Unlock Account Error:", error);
    res.status(500).json({ error: "Failed to unlock account." }); 
  }
});

module.exports = router;