// routes/subscribers.js
const express = require('express');
const router = express.Router();
const { Subscriber } = require('../models');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto'); // 🔥 Added for secure unsubscribe tokens

// 🚨 IMPORT AUTH & RBAC MIDDLEWARES
const { protect } = require('../middleware/authMiddleware');
const { checkPermission } = require('../middleware/rbacMiddleware');

// ==========================================
// 🛡️ SECURITY: Rate Limiter for Subscriptions
// ==========================================
const subscribeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 5, // Max 5 subscriptions per IP in 15 mins
    message: { message: "Too many subscription attempts. Please try again later." }
});

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

// ==========================================
// 1. PUBLIC SUBSCRIBE API (With Rate Limit, Validation & Reactivation)
// ==========================================
router.post('/api/subscribe', subscribeLimiter, async (req, res) => {
  try {
    const { email, source } = req.body;
    
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        return res.status(400).json({ success: false, message: "Please provide a valid email address." });
    }

    const cleanEmail = email.toLowerCase().trim();
    let subscriber = await Subscriber.findOne({ email: cleanEmail });
    
    const unsubscribeToken = crypto.randomBytes(16).toString('hex');

    if (subscriber) {
      if (subscriber.isActive) {
        return res.status(400).json({ success: false, message: "Email is already subscribed." });
      } else {
        // 🔥 Reactivate previously unsubscribed user smoothly
        subscriber.isActive = true;
        subscriber.unsubscribeToken = unsubscribeToken;
        subscriber.source = source || subscriber.source || 'footer';
        await subscriber.save();
        return res.status(200).json({ success: true, message: "Welcome back! Subscribed successfully." });
      }
    }

    const newSub = new Subscriber({ 
      email: cleanEmail,
      isActive: true,
      source: source || 'footer',
      unsubscribeToken
    });
    await newSub.save();
    
    return res.status(201).json({ success: true, message: "Subscribed successfully!" });
  } catch (error) {
    console.error("Subscribe Error:", error);
    return res.status(400).json({ success: false, message: "Email already subscribed or error." });
  }
});

// ==========================================
// 1.1 🔥 PUBLIC 1-CLICK UNSUBSCRIBE API
// ==========================================
router.get('/api/unsubscribe/:token', async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).send("Invalid unsubscribe link.");
    }

    const sub = await Subscriber.findOne({ unsubscribeToken: token });
    if (!sub) {
      return res.status(404).send("Subscription not found or already unsubscribed.");
    }

    sub.isActive = false;
    await sub.save();

    return res.send(`
      <div style="font-family: sans-serif; text-align: center; padding: 50px;">
        <h2 style="color: #16a34a;">Successfully Unsubscribed</h2>
        <p style="color: #64748b;">You have been removed from the Jack Essentials mailing list. We're sorry to see you go!</p>
      </div>
    `);
  } catch (error) {
    console.error("Unsubscribe Error:", error);
    return res.status(500).send("Server error processing unsubscribe request.");
  }
});

// ==========================================
// 2. FETCH ALL SUBSCRIBERS - RBAC ENFORCED (settings:all)
// ==========================================
router.get('/api/subscribers', protect, checkPermission('settings:all'), async (req, res) => {
  try {
    const subs = await Subscriber.find().sort({ subscribedAt: -1 }).lean();
    return res.json(subs);
  } catch (error) {
    console.error("Fetch Subscribers Error:", error);
    return res.status(500).json({ message: "Error fetching subscribers" });
  }
});

// ==========================================
// 3. SEND BULK EMAIL API - RBAC ENFORCED (settings:all)
// ==========================================
router.post('/api/send-bulk-email', protect, checkPermission('settings:all'), async (req, res) => {
  const { subject, message, emails } = req.body; 

  if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: "No recipient emails provided." });
  }

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return res.status(500).json({ error: "Server email credentials are not configured." });
  }

  try {
    await transporter.sendMail({
      from: `"Jack Essentials" <${process.env.EMAIL_USER}>`,
      bcc: emails, // BCC ensures privacy
      subject: subject,
      html: message
    });
    
    return res.json({ success: true, message: "Bulk emails sent securely via BCC." });
  } catch (error) {
    console.error("Bulk Email Error:", error);
    return res.status(500).json({ error: "Failed to send bulk email." });
  }
});

module.exports = router;