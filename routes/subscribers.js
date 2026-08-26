// routes/subscribers.js
const express = require('express');
const router = express.Router();
const { Subscriber } = require('../models');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');

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
// 1. PUBLIC SUBSCRIBE API (With Rate Limit & Validation)
// ==========================================
router.post('/api/subscribe', subscribeLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email || !email.includes('@')) {
        return res.status(400).json({ message: "Please provide a valid email address." });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await Subscriber.findOne({ email: cleanEmail });
    if (existing) {
        return res.status(400).json({ message: "Email is already subscribed." });
    }

    const newSub = new Subscriber({ email: cleanEmail });
    await newSub.save();
    
    res.status(201).json({ message: "Subscribed successfully!" });
  } catch (error) {
    res.status(400).json({ message: "Email already subscribed or error." });
  }
});

// ==========================================
// 2. FETCH ALL SUBSCRIBERS - RBAC ENFORCED (settings:all)
// ==========================================
router.get('/api/subscribers', protect, checkPermission('settings:all'), async (req, res) => {
  try {
    const subs = await Subscriber.find().sort({ subscribedAt: -1 }).lean();
    res.json(subs);
  } catch (error) {
    res.status(500).json({ message: "Error fetching subscribers" });
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
    
    res.json({ success: true, message: "Bulk emails sent securely via BCC." });
  } catch (error) {
    console.error("Bulk Email Error:", error);
    res.status(500).json({ error: "Failed to send bulk email." });
  }
});

module.exports = router;