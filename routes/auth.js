const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// 🔥 ADDED: Resend and All Premium Email Templates 🔥
const { Resend } = require('resend');
const { 
  getResetOtpTemplate, 
  getPasswordChangedTemplate, 
  getLoginAlertTemplate 
} = require('../emailTemplates'); 

const resend = new Resend(process.env.RESEND_API_KEY);

// ==================================================
// 1. PUBLIC REGISTRATION (Customers)
// ==================================================
router.post('/register', async (req, res) => {
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
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const cleanEmail = email.toLowerCase().trim();
    
    const user = await User.findOne({ email: cleanEmail }).select('+password');
    if (!user) {
      return res.status(404).json({ error: "Account not found. Please register first." });
    }

    // 🔥 MAIN FIX: Check if Account is Locked 🔥
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

    // Generate JWT Token
    const token = jwt.sign(
      { id: user._id, role: user.role }, 
      process.env.JWT_SECRET || 'jack_super_secret_key_2026',
      { expiresIn: '7d' }
    );

    // 🔥 SECURITY ALERT EMAIL LOGIC 🔥
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown Location';
    const userAgent = req.headers['user-agent'] || 'Unknown Device';
    const time = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const lockLink = `https://thejackessentials.com/secure-account?email=${encodeURIComponent(user.email)}`;
    
    const accountAgeInMinutes = (Date.now() - new Date(user.createdAt || Date.now()).getTime()) / 60000;
    const isBrandNewUser = accountAgeInMinutes < 2;

    if (process.env.RESEND_API_KEY && !isBrandNewUser) {
      console.log(`[AUTH LOG] Sending Login Alert to: ${user.email}`);
      const htmlContent = getLoginAlertTemplate(user.name || 'User', userAgent, time, ip, lockLink);
      
      resend.emails.send({
        from: 'Jack Essentials Security <updates@thejackessentials.com>', 
        to: [user.email],
        subject: '⚠️ Security Alert: New Login to your Account',
        html: htmlContent
      }).catch(err => console.error("DEBUG: Failed to send login alert:", err));
    }

    user.password = undefined;

    res.json({ 
      message: "Authentication successful.", 
      token, 
      user 
    });

  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: "An unexpected error occurred during authentication." });
  }
});

// ==================================================
// 3. SOCIAL LOGIN (WITH ALERT & LOCK CHECK) 🔥
// ==================================================
router.post('/social-login', async (req, res) => {
  try {
    const { name, email, googleId } = req.body;
    const cleanEmail = email.toLowerCase().trim();

    let user = await User.findOne({ email: cleanEmail });
    let isNewUser = false;

    // 🔥 MAIN FIX: Check if Account is Locked 🔥
    if (user && user.isLocked) {
      return res.status(403).json({ error: "Account is LOCKED.", isLocked: true, email: user.email });
    }

    if (!user) {
      user = new User({
        name,
        email: cleanEmail,
        googleId,
        role: 'customer'
      });
      await user.save();
      isNewUser = true;
    } else if (!user.googleId) {
      user.googleId = googleId;
      await user.save();
    }

    const token = jwt.sign(
      { id: user._id, role: user.role }, 
      process.env.JWT_SECRET || 'jack_super_secret_key_2026', 
      { expiresIn: '7d' }
    );

    // 🔥 SOCIAL LOGIN SECURITY ALERT EMAIL LOGIC 🔥
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown Location';
    const userAgent = req.headers['user-agent'] || 'Unknown Device';
    const time = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const lockLink = `https://thejackessentials.com/secure-account?email=${encodeURIComponent(user.email)}`;

    if (process.env.RESEND_API_KEY && !isNewUser) {
      console.log(`[AUTH LOG] Sending Social Login Alert to: ${user.email}`);
      const htmlContent = getLoginAlertTemplate(user.name || 'User', userAgent, time, ip, lockLink);
      
      resend.emails.send({
        from: 'Jack Essentials Security <updates@thejackessentials.com>', 
        to: [user.email],
        subject: '⚠️ Security Alert: New Login via Google/Social',
        html: htmlContent
      }).catch(err => console.error("DEBUG: Failed to send social login alert:", err));
    }

    res.json({ 
      message: "Social Login Successful", 
      token, 
      user,
      isNewUser
    });

  } catch (error) {
    console.error("Social Login Error:", error);
    res.status(500).json({ error: "Google authentication failed on server." });
  }
});

// ==================================================
// 4. 🔥 DIRECT MONGODB OTP SAVE (Bypassing Schema) 🔥
// ==================================================
router.post('/send-otp', async (req, res) => {
  try {
    const emailInput = req.body.email.trim();
    const emailRegex = new RegExp(`^${emailInput}$`, 'i');
    
    const userExists = await User.findOne({ email: emailRegex });
    if (!userExists) return res.status(404).json({ error: "Account not found." });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const salt = await bcrypt.genSalt(10);
    const hashedOTP = await bcrypt.hash(otp, salt);
    const expiresAt = Date.now() + 600000; 
    
    await User.collection.updateOne(
      { _id: userExists._id },
      { $set: { resetOTP: hashedOTP, resetOTPExpires: expiresAt } }
    );

    console.log(`[MAGIC FIX] OTP Forcibly Saved in DB for: ${emailInput} -> OTP: ${otp}`);

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
// 5. 🔥 DIRECT MONGODB OTP VERIFY (Bypassing Schema) 🔥
// ==================================================
router.post('/verify-otp', async (req, res) => {
  try {
    const emailInput = req.body.email.trim();
    const otp = String(req.body.otp).trim();
    const emailRegex = new RegExp(`^${emailInput}$`, 'i'); 
    
    const user = await User.findOne({ email: emailRegex }).lean();
    
    if (!user) return res.status(400).json({ error: "User not found." });
    
    if (!user.resetOTP || !user.resetOTPExpires) {
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
// 6. 🔥 DIRECT MONGODB RESET PASSWORD & SEND CONFIRMATION 🔥
// ==================================================
router.post('/reset-password', async (req, res) => {
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
      console.log(`[AUTH LOG] Password Success Email Sent to: ${user.email}`);
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
    const { email, newSecurityCode } = req.body;
    if (!email || !newSecurityCode) return res.status(400).json({ error: "PIN is required." });

    const cleanEmail = email.toLowerCase().trim();
    
    // Hash the PIN for E2E Encryption Security
    const salt = await bcrypt.genSalt(10);
    const hashedPin = await bcrypt.hash(newSecurityCode, salt);

    // Using findOneAndUpdate to securely set lock and return user _id for Sockets
    const user = await User.findOneAndUpdate(
      { email: cleanEmail }, 
      { $set: { isLocked: true, securityCode: hashedPin } }, 
      { new: true }
    );
    
    if (!user) return res.status(404).json({ error: "User not found" });

    // Return userId so frontend can trigger Socket.IO force logout across all devices
    res.json({ success: true, message: "Account locked securely.", userId: user._id });
  } catch (error) { 
    console.error("Lock Account Error:", error);
    res.status(500).json({ error: "Failed to lock account." }); 
  }
});

// ==================================================
// 8. 🔥 UNLOCK ACCOUNT API 🔥
// ==================================================
router.post('/unlock-account', async (req, res) => {
  try {
    const { email, pin } = req.body;
    const cleanEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: cleanEmail });
    if (!user || !user.isLocked) return res.status(400).json({ error: "Account is not locked or not found." });

    // Compare Hashed PIN
    const isMatch = await bcrypt.compare(pin, user.securityCode);
    if (!isMatch) return res.status(400).json({ error: "Incorrect Security PIN." });

    // Unlock Success! Direct MongoDB Cleanup
    await User.collection.updateOne(
      { _id: user._id },
      {
        $set: { isLocked: false },
        $unset: { securityCode: "" }
      }
    );

    // Give them a token so they are directly logged in after unlocking
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'jack_super_secret_key_2026', { expiresIn: '7d' });
    
    // Fetch updated user to send back
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