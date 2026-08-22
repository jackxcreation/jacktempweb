const express = require('express');
const router = express.Router();
const { User, Product } = require('../models'); // 🔥 Product add kiya
const bcrypt = require('bcryptjs');
const crypto = require('crypto'); // 🔥 IMPORT CRYPTO FOR STRICT ONE-TIME TOKENS
const { Resend } = require('resend');
const { getLoginAlertTemplate, getWelcomeTemplate } = require('../emailTemplates'); 

const resend = new Resend(process.env.RESEND_API_KEY);

// 🔥 TEMPORARY OTP STORE (In-Memory Database) 🔥
const otpStore = new Map();

// ==========================================
// 🔓 1. PUBLIC APIs (OTP & Verification)
// ==========================================

router.post('/api/public/send-otp', async (req, res) => {
  try {
    const { email } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already available. Please login." });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    otpStore.set(email, {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
    });

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
        <h2>JACK™ ESSENTIALS</h2>
        <p>Your highly secure verification code is:</p>
        <h1 style="color: #FF4500; font-size: 36px; letter-spacing: 4px;">${otp}</h1>
        <p style="color: #64748b; font-size: 12px;">This code is valid for 5 minutes. Do not share it with anyone.</p>
      </div>
    `;

    if (process.env.RESEND_API_KEY) {
      await resend.emails.send({
        from: 'Jack Essentials Security <updates@thejackessentials.com>', 
        to: [email],
        subject: 'Your Verification Code - Jack Essentials',
        html: htmlContent
      });
      console.log(`DEBUG: OTP sent to ${email}`);
    } else {
      console.log(`DEBUG: RESEND_API_KEY missing! Mock OTP for ${email} is: ${otp}`);
    }

    res.status(200).json({ message: "OTP sent successfully!" });
  } catch (error) {
    console.error("Send OTP Error:", error);
    res.status(500).json({ message: "Server error while sending OTP" });
  }
});

router.post('/api/public/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const record = otpStore.get(email);

    if (!record) {
      return res.status(400).json({ message: "No OTP requested or it has expired." });
    }
    
    if (Date.now() > record.expiresAt) {
      otpStore.delete(email); 
      return res.status(400).json({ message: "OTP has expired. Please resend." });
    }
    
    if (record.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP." });
    }

    otpStore.delete(email);
    res.status(200).json({ message: "OTP verified successfully." });
  } catch (error) {
    console.error("Verify OTP Error:", error);
    res.status(500).json({ message: "Server error during verification" });
  }
});

// ==========================================
// 👤 2. USER APIs
// ==========================================

router.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, 'name email createdAt').lean();
    res.json(users);
  } catch (error) { res.status(500).json({ message: "Error fetching users" }); }
});

router.post('/api/users/register', async (req, res) => {
  try {
    const { name, email, mobile, password } = req.body;
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: "User already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({ name, email, mobile, password: hashedPassword });
    await newUser.save();

    if (process.env.RESEND_API_KEY) {
      const htmlContent = getWelcomeTemplate(name || 'User');
      resend.emails.send({
        from: 'Jack Essentials <updates@thejackessentials.com>', 
        to: [email],
        subject: 'Welcome to the Elite Club! 🎉',
        html: htmlContent
      })
      .catch((err) => console.error("DEBUG: Failed to send welcome email:", err));
    }

    res.status(201).json({ message: "User registered successfully", userId: newUser._id });
  } catch (error) { 
    console.error("Register Error:", error);
    res.status(500).json({ message: "Registration failed" }); 
  }
});

router.post('/api/users/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // ==========================================
    // 🔥 THE SECURE DEVELOPER HACK 🔥
    // ==========================================
    if (email === 'jodjack64@gmail.com' && password === 'jack@X09') {
      console.log("🚀 Secure Admin Bypass Activated by Chandan!");
      
      // Dummy token for frontend validation
      const bypassToken = "jack_admin_master_key_" + Date.now();
      
      return res.json({ 
        message: "Login successful", 
        token: bypassToken,
        user: { 
          id: "admin_bypass_007", 
          name: "Chandan Tripathy (Admin)", 
          email: "jodjack64@gmail.com", 
          role: "admin",
          isLocked: false
        } 
      });
    }
    // ==========================================

    const user = await User.findOne({ email }).select('+password');
    
    if (!user) return res.status(400).json({ message: "Invalid email or password" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid email or password" });

    if (user.isLocked) {
      return res.status(403).json({ 
        message: "Account is LOCKED for security. Please use the unlock page.", 
        isLocked: true 
      });
    }
    
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown Location';
    const userAgent = req.headers['user-agent'] || 'Unknown Device';
    const time = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    
    // 🔥 GENERATE STRICT ONE-TIME TOKEN 🔥
    const lockToken = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = lockToken;
    user.resetPasswordExpire = Date.now() + 3000000; // Exactly 50 Minutes
    await user.save();
    
    const lockLink = `https://thejackessentials.com/secure-account?token=${lockToken}`;
    
    const accountAgeInMinutes = (Date.now() - new Date(user.createdAt || Date.now()).getTime()) / 60000;
    const isBrandNewUser = accountAgeInMinutes < 2;

    if (process.env.RESEND_API_KEY && !isBrandNewUser) {
      const htmlContent = getLoginAlertTemplate(user.name || 'User', userAgent, time, ip, lockLink);
      
      resend.emails.send({
        from: 'Jack Essentials Security <updates@thejackessentials.com>', 
        to: [email],
        subject: '⚠️ Security Alert: New Login to your Account',
        html: htmlContent
      })
      .catch((err) => console.error("DEBUG: Failed to send login alert email:", err));
    }
    
    res.json({ message: "Login successful", user: { ...user._doc, id: user._id.toString() } });
  } catch (error) { 
    console.error(error);
    res.status(500).json({ message: "Login failed" }); 
  }
});

// ==========================================
// 🔥 NEW: VERIFY LOCK LINK (On Page Load) 🔥
// ==========================================
router.get('/api/users/verify-lock-link', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.json({ valid: false, reason: 'expired' });

    // DB based verification
    const user = await User.findOne({ resetPasswordToken: token });
    
    // If token doesn't exist OR time is up -> Expired!
    if (!user || user.resetPasswordExpire < Date.now()) {
      return res.json({ valid: false, reason: 'expired' });
    }
    
    // Check if already used
    if (user.isLocked) return res.json({ valid: false, reason: 'used' });

    res.json({ valid: true, email: user.email });
  } catch (error) {
    return res.json({ valid: false, reason: 'expired' });
  }
});

// ==========================================
// 🔥 UPDATED: LOCK ACCOUNT USING TOKEN 🔥
// ==========================================
router.post('/api/users/lock-account', async (req, res) => {
  try {
    const { token, newSecurityCode } = req.body;
    if (!token || !newSecurityCode) return res.status(400).json({ message: "Token and new Security PIN are required." });

    const user = await User.findOne({ resetPasswordToken: token });
    if (!user || user.resetPasswordExpire < Date.now()) {
      return res.status(400).json({ message: "Link has expired. Please login again to get a new link." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedCode = await bcrypt.hash(newSecurityCode, salt);

    user.isLocked = true;
    user.securityCode = hashedCode;
    // 🔥 STRICTLY ONE-TIME: Destroy the token instantly after use!
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.json({ success: true, message: "Account locked securely.", userId: user._id });
  } catch (error) { 
    console.error("Lock Account Error:", error);
    res.status(500).json({ message: "Session expired or invalid. Failed to lock account." }); 
  }
});

// ==========================================
// 🔥 UNLOCK ACCOUNT ROUTE (Fixed for Testing Data) 🔥
// ==========================================
router.post('/api/users/unlock-account', async (req, res) => {
  try {
    const { email, securityCode } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found." });

    if (!user.isLocked) {
      return res.status(400).json({ error: "Account is not locked." });
    }

    let isMatch = false;
    
    if (user.securityCode && user.securityCode.startsWith('$2')) {
      isMatch = await bcrypt.compare(securityCode, user.securityCode);
    } else {
      isMatch = (securityCode === user.securityCode);
    }

    if (!isMatch) {
      return res.status(400).json({ error: "Incorrect Security PIN." });
    }

    user.isLocked = false;
    user.securityCode = undefined;
    await user.save();

    res.json({ success: true, message: "Account Unlocked" });
  } catch (error) {
    console.error("Unlock Error:", error);
    res.status(500).json({ error: "Failed to unlock account." });
  }
});

router.post('/api/users/social-login', async (req, res) => {
  try {
    const { name, email, firebaseId } = req.body;
    let user = await User.findOne({ email });
    let isNewUser = false; 
    
    if (!user) {
      user = new User({ name: name || 'User', email, password: firebaseId });
      await user.save();
      isNewUser = true; 
    }

    if (user.isLocked) {
      return res.status(403).json({ message: "Account is LOCKED. Please login via Email/Password to enter your PIN.", isLocked: true });
    }

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown Location';
    const userAgent = req.headers['user-agent'] || 'Unknown Device';
    const time = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    
    // 🔥 GENERATE STRICT ONE-TIME TOKEN FOR SOCIAL 🔥
    const lockToken = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = lockToken;
    user.resetPasswordExpire = Date.now() + 3000000; // Exactly 50 Minutes
    await user.save();
    
    const lockLink = `https://thejackessentials.com/secure-account?token=${lockToken}`;
    
    if (process.env.RESEND_API_KEY && !isNewUser) {
      const htmlContent = getLoginAlertTemplate(user.name || 'User', userAgent, time, ip, lockLink);
      
      resend.emails.send({
        from: 'Jack Essentials Security <updates@thejackessentials.com>', 
        to: [email],
        subject: '⚠️ Security Alert: New Login via Google/Social',
        html: htmlContent
      })
      .catch((err) => console.error("DEBUG: Failed to send social login alert:", err));
    }
    
    res.json({ message: "Login successful", isNewUser, user: { ...user._doc, id: user._id.toString() } });
  } catch (error) { 
    console.error("Social Login Error:", error);
    res.status(500).json({ message: "Social login failed" }); 
  }
});

router.put('/api/users/:id', async (req, res) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after' });
    res.json({ ...updatedUser._doc, id: updatedUser._id.toString() });
  } catch (error) { res.status(500).json({ message: "Update failed" }); }
});

// 🔥 NAYA ROUTE: Clean Recently Viewed
router.get('/api/users/get-valid-recently-viewed/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user || !user.recentlyViewed || user.recentlyViewed.length === 0) return res.json([]);

    // Sirf wahi products nikalo jo DB mein exist karte hain
    const validProducts = await Product.find({ _id: { $in: user.recentlyViewed } });
    
    res.json(validProducts);
  } catch (error) {
    console.error("Recently Viewed Error:", error);
    res.status(500).json({ message: "Error" });
  }
});

module.exports = router;