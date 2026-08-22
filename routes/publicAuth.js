const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const crypto = require('crypto'); // 🔥 ADDED FOR SECURE OTP
const rateLimit = require('express-rate-limit'); // 🔥 ADDED FOR BRUTE FORCE PROTECTION
const User = require('../models/User');

// ==========================================
// 📧 SECURE EMAIL TRANSPORTER
// ==========================================
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, 
    pass: process.env.EMAIL_PASS  
  }
});

const otpStore = new Map();

// 🔥 Brute-Force Rate Limiter for Verification Route
const otpVerifyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, 
  max: 10, // Max 10 requests total to this IP for verification
  message: { error: "Too many attempts from this IP. Please wait." }
});

// ==========================================
// 1. 🚀 ROUTE: SEND SECURE OTP
// ==========================================
router.post('/send-otp', async (req, res) => {
  try {
    if (!req.body.email) return res.status(400).json({ error: "Email address is required." });

    const email = req.body.email.toLowerCase().trim();
    const now = Date.now();
    const existingRecord = otpStore.get(email);

    if (existingRecord && existingRecord.requestedAt > now - 60000) {
      return res.status(429).json({ error: "Please wait 60 seconds before requesting a new OTP." });
    }

    // 🔥 SECURITY FIX: Cryptographically Secure OTP instead of Math.random()
    const otp = crypto.randomInt(100000, 999999).toString();
    
    otpStore.set(email, { 
      otp, 
      expires: now + 5 * 60 * 1000,
      requestedAt: now,
      attempts: 0 // 🔥 Track wrong guesses
    });
    
    console.log(`[AUTH] OTP Generated for: '${email}'`);

    const mailOptions = {
      from: '"Jack Essentials Security" <no-reply@jackessentials.com>',
      to: email,
      subject: '🔐 Your Jack Essentials Verification Code',
      html: `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <div style="background-color: #0B0F19; padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; letter-spacing: -1px;">J<span style="color: #FF4500;">S</span></h1>
            <p style="color: #94a3b8; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; margin-top: 5px;">Premium D2C Brand</p>
          </div>
          <div style="padding: 30px; background-color: #ffffff;">
            <h2 style="color: #0f172a; margin-top: 0;">Verify Your Identity</h2>
            <p style="color: #64748b; font-size: 15px; line-height: 1.6;">Please use the following 6-digit security code to verify your email address. This code is valid for <strong>5 minutes</strong>.</p>
            
            <div style="margin: 30px 0; text-align: center;">
              <span style="font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #FF4500; background-color: #fff7ed; padding: 15px 25px; border-radius: 8px; border: 1px solid #ffedd5;">${otp}</span>
            </div>
            
            <p style="color: #94a3b8; font-size: 13px; border-top: 1px solid #f1f5f9; padding-top: 20px;">If you didn't request this code, you can safely ignore this email. Do not share this code with anyone.</p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: "Secure OTP sent to your email." });

  } catch (error) {
    console.error("OTP Send Error:", error);
    res.status(500).json({ error: "Failed to send verification email. Please try again." });
  }
});

// ==========================================
// 2. 🛡️ ROUTE: VERIFY OTP & LOGIN/REGISTER
// ==========================================
router.post('/verify-otp', otpVerifyLimiter, async (req, res) => {
  try {
    if (!req.body.email || !req.body.otp) {
      return res.status(400).json({ error: "Email and OTP are required." });
    }

    const email = req.body.email.toLowerCase().trim();
    const otp = req.body.otp.trim();

    const record = otpStore.get(email);

    if (!record) {
      return res.status(400).json({ error: "OTP has expired or was not requested." });
    }

    if (Date.now() > record.expires) {
      otpStore.delete(email); 
      return res.status(400).json({ error: "This OTP has expired. Please request a new one." });
    }

    // 🔥 SECURITY FIX: Anti-Brute Force (Max 3 wrong guesses allowed)
    if (record.attempts >= 3) {
      otpStore.delete(email);
      return res.status(403).json({ error: "Too many wrong guesses. OTP invalidated. Request a new one." });
    }

    if (record.otp !== otp) {
      record.attempts += 1;
      otpStore.set(email, record); // Save incremented attempt
      return res.status(400).json({ error: `Invalid verification code. Attempts left: ${3 - record.attempts}` });
    }

    // OTP Verified! Remove it from memory to prevent reuse
    otpStore.delete(email);

    let user = await User.findOne({ email });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      user = new User({ 
        name: "Valued Customer", 
        email, 
        role: "user" // Changed to 'user' for consistency with users.js
      });
      await user.save();
    }

    // 🔥 SECURITY FIX: Removed Fallback Secret. If env is missing, it MUST crash safely.
    if (!process.env.JWT_SECRET) {
      console.error("🚨 CRITICAL ALERT: JWT_SECRET IS MISSING IN ENVIRONMENT VARIABLES!");
      return res.status(500).json({ error: "Server Configuration Error" });
    }

    // Generate Secure JWT Token
    const token = jwt.sign(
      { id: user._id, role: user.role }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );

    res.status(200).json({ 
      message: "Authentication successful.", 
      token, 
      user,
      isNewUser 
    });

  } catch (error) {
    console.error("OTP Verify Error:", error);
    res.status(500).json({ error: "An unexpected error occurred during verification." });
  }
});

module.exports = router;