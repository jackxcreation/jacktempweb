// routes/userRouter.js
const express = require('express');
const mongoose = require('mongoose'); // 🔥 CRITICAL FIX: Imported mongoose to prevent ReferenceError
const router = express.Router();
const { User, Product, Order, Ticket, Review } = require('../models'); 
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken'); // 🔥 ADDED FOR AUTHENTICATION
const { Resend } = require('resend');
const rateLimit = require('express-rate-limit'); // 🔥 ADDED FOR OTP BRUTE-FORCE PROTECTION
const { getLoginAlertTemplate, getWelcomeTemplate } = require('../emailTemplates'); 
const { z } = require('zod'); // 🔥 ADDED: Zod for strict input validation

// 🚨 IMPORT SECURE MIDDLEWARES
const { protect, admin } = require('../middleware/authMiddleware');

const resend = new Resend(process.env.RESEND_API_KEY);

const otpStore = new Map();

// ==========================================
// 🔥 PRO FEATURE: MEMORY LEAK CLEANUP INTERVAL FOR OTP
// ==========================================
setInterval(() => {
  const now = Date.now();
  for (const [email, record] of otpStore.entries()) {
    if (now > record.expiresAt) {
      otpStore.delete(email);
    }
  }
}, 15 * 60 * 1000); // Run every 15 minutes

// 🔥 Generate Secure JWT Token Helper
const generateToken = (id) => {
  if (!process.env.JWT_SECRET) {
    console.error("🚨 CRITICAL: JWT_SECRET is missing in .env!");
    throw new Error("Server Configuration Error");
  }
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// ==========================================
// 🛡️ ZOD VALIDATION SCHEMAS FOR USERS & AUTH
// ==========================================
const otpSchema = z.object({
  email: z.string().email("Invalid email address"),
  otp: z.string().regex(/^\d{6}$/, "Invalid OTP format. Must be 6 digits").optional()
});

const userUpdateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  mobile: z.string().regex(/^\d{10}$/).optional(),
  addresses: z.array(z.any()).optional(),
  role: z.string().optional()
});

// ==========================================
// 🛡️ ANTI-BRUTE-FORCE OTP LIMITERS
// ==========================================
const otpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Limit each IP to 3 OTP requests per window
  message: { message: "Too many OTP requests from this IP, please try again after 15 minutes." }
});

const otpVerifyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // Max 5 wrong attempts
  message: { message: "Too many failed attempts. Please request a new OTP." }
});

// ==========================================
// 🔓 1. PUBLIC APIs (OTP & Verification)
// ==========================================

router.post('/api/public/send-otp', otpSendLimiter, async (req, res) => {
  try {
    const validationResult = otpSchema.pick({ email: true }).safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ success: false, message: "Invalid email format", errors: validationResult.error.format() });
    }

    const { email } = validationResult.data;
    const cleanEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({ message: "User already available. Please login." });
    }

    const otp = crypto.randomInt(100000, 999999).toString();

    otpStore.set(cleanEmail, {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000 
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
        to: [cleanEmail],
        subject: 'Your Verification Code - Jack Essentials',
        html: htmlContent
      });
    }

    return res.status(200).json({ message: "OTP sent successfully!" });
  } catch (error) {
    console.error("Send OTP Error:", error);
    return res.status(500).json({ message: "Server error while sending OTP" });
  }
});

router.post('/api/public/verify-otp', otpVerifyLimiter, async (req, res) => {
  try {
    const validationResult = otpSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: validationResult.error.format() });
    }

    const { email, otp } = validationResult.data;
    const cleanEmail = email.toLowerCase().trim();
    const record = otpStore.get(cleanEmail);

    if (!record) {
      return res.status(400).json({ message: "No OTP requested or it has expired." });
    }
    
    if (Date.now() > record.expiresAt) {
      otpStore.delete(cleanEmail); 
      return res.status(400).json({ message: "OTP has expired. Please resend." });
    }
    
    if (record.otp !== String(otp).trim()) {
      return res.status(400).json({ message: "Invalid OTP." });
    }

    otpStore.delete(cleanEmail);
    return res.status(200).json({ message: "OTP verified successfully." });
  } catch (error) {
    console.error("Verify OTP Error:", error);
    return res.status(500).json({ message: "Server error during verification" });
  }
});

// ==========================================
// 👤 2. USER RESOURCE MANAGEMENT APIs
// ==========================================

// 🔥 STRICTLY ADMIN ONLY
router.get('/api/users', protect, admin, async (req, res) => {
  try {
    const users = await User.find({}, 'name email createdAt role').lean();
    return res.json(users);
  } catch (error) { 
    console.error("Fetch Users Error:", error);
    return res.status(500).json({ message: "Error fetching users" }); 
  }
});

// ==========================================
// 🔥 CUSTOMER 360 CRM PROFILE API
// ==========================================
router.get('/api/users/:id/360-profile', protect, admin, async (req, res) => {
  try {
    const userId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid Customer ID format" });
    }

    const user = await User.findById(userId).populate('wishlist').populate('recentlyViewed').lean();
    if (!user) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    // Fetch customer orders
    const orders = await Order.find({ userId: userId.toString() }).sort({ createdAt: -1 }).lean();

    // Calculate Lifetime Value & Average Order Value
    const totalOrdersCount = orders.length;
    const lifetimeValuePaise = orders.reduce((sum, o) => sum + (o.totalPaise || 0), 0);
    const averageOrderValuePaise = totalOrdersCount > 0 ? lifetimeValuePaise / totalOrdersCount : 0;

    // Calculate Return & RTO Rates
    const returnedOrdersCount = orders.filter(o => ['Returned', 'ReturnRequested', 'ReturnApproved'].includes(o.status)).length;
    const rtoOrdersCount = orders.filter(o => o.status === 'RTO').length;
    const returnRate = totalOrdersCount > 0 ? ((returnedOrdersCount / totalOrdersCount) * 100).toFixed(1) : 0;
    const rtoRate = totalOrdersCount > 0 ? ((rtoOrdersCount / totalOrdersCount) * 100).toFixed(1) : 0;

    // Fetch customer support tickets
    const tickets = await Ticket.find({ userId: userId.toString() }).sort({ createdAt: -1 }).lean();

    // Fetch customer reviews
    const reviews = await Review.find({ userId: userId.toString() }).sort({ createdAt: -1 }).lean();

    // Build Activity Timeline from orders, tickets, and audit logs
    const timeline = [];
    orders.forEach(o => timeline.push({ type: 'order', date: o.createdAt || o.date, title: `Placed Order #${(o._id || o.id).toString().slice(-8).toUpperCase()}`, subtitle: `Amount: ₹${o.totalAmount || o.totalPaise/100} • Status: ${o.status}` }));
    tickets.forEach(t => timeline.push({ type: 'ticket', date: t.createdAt, title: `Support Ticket Created`, subtitle: `Status: ${t.status} • Order: #${t.orderId || 'N/A'}` }));
    if (user.auditLogs) {
      user.auditLogs.forEach(a => timeline.push({ type: 'audit', date: a.timestamp, title: `Security Action: ${a.action}`, subtitle: a.details }));
    }
    timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

    return res.json({
      success: true,
      profile: user,
      metrics: {
        lifetimeValue: `₹${(lifetimeValuePaise / 100).toLocaleString('en-IN')}`,
        averageOrderValue: `₹${(averageOrderValuePaise / 100).toLocaleString('en-IN')}`,
        totalOrders: totalOrdersCount,
        returnRate: `${returnRate}%`,
        rtoRate: `${rtoRate}%`
      },
      orders,
      wishlist: user.wishlist || [],
      recentlyViewed: user.recentlyViewed || [],
      tickets,
      reviews,
      timeline
    });
  } catch (error) {
    console.error("Customer 360 Error:", error);
    return res.status(500).json({ success: false, message: "Failed to generate Customer 360 profile" });
  }
});

// ==========================================
// 🔥 VERIFY LOCK LINK
// ==========================================
router.get('/api/users/verify-lock-link', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.json({ valid: false, reason: 'expired' });
    }

    const user = await User.findOne({ resetPasswordToken: token });
    if (!user || user.resetPasswordExpire < Date.now()) {
      return res.json({ valid: false, reason: 'expired' });
    }
    
    if (user.isLocked) {
      return res.json({ valid: false, reason: 'used' });
    }

    return res.json({ valid: true, email: user.email });
  } catch (error) {
    console.error("Verify Lock Link Error:", error);
    return res.json({ valid: false, reason: 'expired' });
  }
});

// ==========================================
// 🔥 LOCK ACCOUNT USING TOKEN
// ==========================================
router.post('/api/users/lock-account', async (req, res) => {
  try {
    const { token, newSecurityCode } = req.body;
    if (!token || !newSecurityCode) {
      return res.status(400).json({ message: "Token and new Security PIN are required." });
    }

    const user = await User.findOne({ resetPasswordToken: token });
    if (!user || user.resetPasswordExpire < Date.now()) {
      return res.status(400).json({ message: "Link has expired. Please login again to get a new link." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedCode = await bcrypt.hash(newSecurityCode, salt);

    user.isLocked = true;
    user.securityCode = hashedCode;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    return res.json({ success: true, message: "Account locked securely.", userId: user._id });
  } catch (error) { 
    console.error("Lock Account Error:", error);
    return res.status(500).json({ message: "Failed to lock account." }); 
  }
});

// ==========================================
// 🔥 UNLOCK ACCOUNT
// ==========================================
router.post('/api/users/unlock-account', async (req, res) => {
  try {
    const { email, securityCode } = req.body;
    if (!email || !securityCode) {
      return res.status(400).json({ error: "Email and security PIN are required." });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail }).select('+securityCode');
    if (!user || !user.isLocked) {
      return res.status(400).json({ error: "Account is not locked or not found." });
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

    return res.json({ success: true, message: "Account Unlocked" });
  } catch (error) {
    console.error("Unlock Account Error:", error);
    return res.status(500).json({ error: "Failed to unlock account." });
  }
});

// ==========================================
// 🔥 SECURED: UPDATE USER (IDOR FIXED & ZOD VALIDATED)
// ==========================================
router.put('/api/users/:id', protect, async (req, res) => {
  try {
    const targetUserId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({ success: false, message: "Invalid User ID format" });
    }

    // Only the user themselves OR an admin can update the profile
    if (req.user._id.toString() !== targetUserId && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ message: "Access Denied: You cannot update someone else's profile." });
    }

    // 🔥 Strict Zod Validation
    const validationResult = userUpdateSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        success: false, 
        message: "Validation failed", 
        errors: validationResult.error.format() 
      });
    }

    const updateData = validationResult.data;

    // Protect role modification (only admins can make other admins)
    if (updateData.role && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      delete updateData.role; 
    }

    const updatedUser = await User.findByIdAndUpdate(targetUserId, updateData, { new: true, runValidators: true }).lean();
    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({ ...updatedUser, id: updatedUser._id.toString() });
  } catch (error) { 
    console.error("Update User Error:", error);
    return res.status(500).json({ message: "Update failed" }); 
  }
});

// ==========================================
// 🔥 SECURED: Clean Recently Viewed
// ==========================================
router.get('/api/users/get-valid-recently-viewed/:userId', protect, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({ success: false, message: "Invalid User ID format" });
    }

    // IDOR Check
    if (req.user._id.toString() !== targetUserId && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ message: "Access Denied" });
    }

    const user = await User.findById(targetUserId).lean();
    if (!user || !user.recentlyViewed || user.recentlyViewed.length === 0) {
      return res.json([]);
    }

    const validProducts = await Product.find({ _id: { $in: user.recentlyViewed } }).lean();
    return res.json(validProducts.map(p => ({ ...p, id: p._id.toString() })));
  } catch (error) {
    console.error("Get Recently Viewed Error:", error);
    return res.status(500).json({ message: "Error fetching recently viewed products" });
  }
});

module.exports = router;