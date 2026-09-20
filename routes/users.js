// routes/userRouter.js
const express = require('express');
const mongoose = require('mongoose'); // 🔥 CRITICAL FIX: Imported mongoose to prevent ReferenceError
const router = express.Router();
const { User, Product, Order, Ticket, Review } = require('../models'); 
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken'); // 🔥 ADDED FOR AUTHENTICATION
const { Resend } = require('resend');
const { z } = require('zod'); // 🔥 ADDED: Zod for strict input validation
const { userUpdateValidator } = require('../validators/user'); // 🔥 STRICT WHITELIST VALIDATOR FOR MASS-ASSIGNMENT PREVENTION
const { JWT_SECRET } = require('../config/env'); // 🔥 STRICT ZERO-FALLBACK JWT SECRET IMPORT
const { generateAndStoreOtp, verifyOtp, issueVerificationToken } = require('../services/otpService'); // 🔥 SECURE DB-BACKED OTP SERVICE & TOKEN ISSUER
const { otpSendLimiter, otpVerifyLimiter } = require('../middleware/rateLimit'); // 🔥 TASK #14: IP & Abusive Throttling Limiters

// 🔥 TASK #49 & #50: Standardized API response helpers and structured logger
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { logger, logInfo, logError, logWarn } = require('../utils/logger');

// 🚨 IMPORT SECURE MIDDLEWARES
const { protect, admin } = require('../middleware/authMiddleware');

const resend = new Resend(process.env.RESEND_API_KEY);

// 🔥 Generate Secure JWT Token Helper (Zero Fallback)
const generateToken = (id) => {
  if (!JWT_SECRET) {
    logError("🚨 CRITICAL: JWT_SECRET is missing!");
    throw new Error("Server Configuration Error: JWT_SECRET is required");
  }
  return jwt.sign({ id }, JWT_SECRET, { expiresIn: '30d' });
};

// ==========================================
// 🛡️ ZOD VALIDATION SCHEMAS FOR USERS & AUTH (TASK #48)
// ==========================================
const otpSchema = z.object({
  email: z.string().email("Invalid email address"),
  otp: z.string().regex(/^\d{6}$/, "Invalid OTP format. Must be 6 digits").optional()
});

const registerSchema = z.object({
  name: z.string().min(2, "Name is required").max(100, "Name is too long"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
  phone: z.string().regex(/^\d{10}$/, "Invalid mobile number format").optional(),
  verificationToken: z.string().min(1, "Verification token is required. Complete OTP verification first.")
});

// ==========================================
// 🔓 1. PUBLIC APIs (OTP, Verification & Mandatory Registration Flow)
// ==========================================

router.post('/api/public/send-otp', otpSendLimiter, async (req, res) => {
  try {
    const validationResult = otpSchema.pick({ email: true }).safeParse(req.body);
    if (!validationResult.success) {
      return sendError(res, 'VALIDATION_FAILED', "Invalid email format", 400, req, validationResult.error.format());
    }

    const { email } = validationResult.data;
    const cleanEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return sendError(res, 'USER_ALREADY_EXISTS', "User already available. Please login.", 400, req);
    }

    // 🔥 Secure OTP generation via otpService (60s cooldown & max 5 OTPs/hour enforced)
    const otpResult = await generateAndStoreOtp(cleanEmail);
    if (!otpResult.success) {
      return sendError(res, otpResult.code || 'OTP_LIMIT_EXCEEDED', otpResult.message, 429, req);
    }

    const otp = otpResult.otp;

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

    return sendSuccess(res, {}, "OTP sent successfully!", 200, req);
  } catch (error) {
    logError("Send OTP Error:", error, { requestId: req.requestId });
    return sendError(res, 'OTP_SEND_FAILED', "Server error while sending OTP", 500, req);
  }
});

router.post('/api/public/verify-otp', otpVerifyLimiter, async (req, res) => {
  try {
    const validationResult = otpSchema.safeParse(req.body);
    if (!validationResult.success) {
      return sendError(res, 'VALIDATION_FAILED', "Validation failed", 400, req, validationResult.error.format());
    }

    const { email, otp } = validationResult.data;
    const cleanEmail = email.toLowerCase().trim();

    // 🔥 Secure verification via otpService (bcrypt compare + max 5 attempts invalidation)
    const verifyResult = await verifyOtp(cleanEmail, otp);
    if (!verifyResult.success) {
      return sendError(res, verifyResult.code || 'OTP_VERIFY_FAILED', verifyResult.message, 400, req);
    }

    // 🔥 Task #15: Issue short-lived verification token upon successful OTP verification
    const verificationToken = issueVerificationToken(cleanEmail);

    return sendSuccess(res, { verificationToken }, "OTP verified successfully.", 200, req);
  } catch (error) {
    logError("Verify OTP Error:", error, { requestId: req.requestId });
    return sendError(res, 'VERIFICATION_FAILED', "Server error during verification", 500, req);
  }
});

// 🔥 Task #15: Mandatory Registration Flow (Send OTP ➔ Verify OTP ➔ Issue Token ➔ Register)
router.post('/api/public/register', otpVerifyLimiter, async (req, res) => {
  try {
    const validationResult = registerSchema.safeParse(req.body);
    if (!validationResult.success) {
      return sendError(res, 'VALIDATION_FAILED', "Validation failed", 400, req, validationResult.error.format());
    }

    const { name, email, password, phone, verificationToken } = validationResult.data;
    const cleanEmail = email.toLowerCase().trim();

    // 1. Strictly verify short-lived verification token
    try {
      const decoded = jwt.verify(verificationToken, JWT_SECRET);
      if (!decoded.verified || decoded.identifier !== cleanEmail || decoded.purpose !== 'registration') {
        return sendError(res, 'INVALID_VERIFICATION_TOKEN', "Invalid or expired verification session. Please verify OTP again.", 400, req);
      }
    } catch (err) {
      return sendError(res, 'TOKEN_EXPIRED', "Verification token expired or tampered. Please restart registration.", 400, req);
    }

    // 2. Check if user already exists
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return sendError(res, 'EMAIL_REGISTERED', "Email is already registered. Please login.", 400, req);
    }

    // 3. Hash password and create user securely
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({
      name,
      email: cleanEmail,
      password: hashedPassword,
      phone: phone || undefined,
      role: 'customer',
      isPhoneVerified: !!phone,
      activeSessions: [],
      auditLogs: [{ action: 'REGISTER', details: 'User registered successfully via verified OTP token', ip: req.ip || 'Unknown' }]
    });

    await user.save();

    // 4. Issue Auth Token
    const token = generateToken(user._id);

    return sendSuccess(res, {
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role
      }
    }, "Welcome to Jack Essentials! Account created successfully.", 201, req);
  } catch (error) {
    logError("Secure Registration Error:", error, { requestId: req.requestId });
    return sendError(res, 'REGISTRATION_FAILED', "Internal server error during registration.", 500, req);
  }
});

// ==========================================
// 👤 2. USER RESOURCE MANAGEMENT APIs
// ==========================================

// 🔥 STRICTLY ADMIN ONLY
router.get('/api/users', protect, admin, async (req, res) => {
  try {
    const users = await User.find({}, 'name email createdAt role').lean();
    return sendSuccess(res, users, "Users fetched successfully", 200, req);
  } catch (error) { 
    logError("Fetch Users Error:", error, { requestId: req.requestId });
    return sendError(res, 'SERVER_ERROR', "Error fetching users", 500, req); 
  }
});

// ==========================================
// 🔥 CUSTOMER 360 CRM PROFILE API
// ==========================================
router.get('/api/users/:id/360-profile', protect, admin, async (req, res) => {
  try {
    const userId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return sendError(res, 'INVALID_USER_ID', "Invalid Customer ID format", 400, req);
    }

    const user = await User.findById(userId).populate('wishlist').populate('recentlyViewed').lean();
    if (!user) {
      return sendError(res, 'USER_NOT_FOUND', "Customer not found", 404, req);
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

    return sendSuccess(res, {
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
    }, "Customer 360 profile fetched successfully", 200, req);
  } catch (error) {
    logError("Customer 360 Error:", error, { requestId: req.requestId });
    return sendError(res, 'SERVER_ERROR', "Failed to generate Customer 360 profile", 500, req);
  }
});

// ==========================================
// 🔥 VERIFY LOCK LINK
// ==========================================
router.get('/api/users/verify-lock-link', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.json({ valid: false, reason: 'expired', requestId: req.requestId });
    }

    const user = await User.findOne({ resetPasswordToken: token });
    if (!user || user.resetPasswordExpire < Date.now()) {
      return res.json({ valid: false, reason: 'expired', requestId: req.requestId });
    }
    
    if (user.isLocked) {
      return res.json({ valid: false, reason: 'used', requestId: req.requestId });
    }

    return res.json({ valid: true, email: user.email, requestId: req.requestId });
  } catch (error) {
    logError("Verify Lock Link Error:", error, { requestId: req.requestId });
    return res.json({ valid: false, reason: 'expired', requestId: req.requestId });
  }
});

// ==========================================
// 🔥 LOCK ACCOUNT USING TOKEN
// ==========================================
router.post('/api/users/lock-account', async (req, res) => {
  try {
    const { token, newSecurityCode } = req.body;
    if (!token || !newSecurityCode) {
      return sendError(res, 'MISSING_FIELDS', "Token and new Security PIN are required.", 400, req);
    }

    const user = await User.findOne({ resetPasswordToken: token });
    if (!user || user.resetPasswordExpire < Date.now()) {
      return sendError(res, 'TOKEN_EXPIRED', "Link has expired. Please login again to get a new link.", 400, req);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedCode = await bcrypt.hash(newSecurityCode, salt);

    user.isLocked = true;
    user.securityCode = hashedCode;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    return sendSuccess(res, { userId: user._id }, "Account locked securely.", 200, req);
  } catch (error) { 
    logError("Lock Account Error:", error, { requestId: req.requestId });
    return sendError(res, 'SERVER_ERROR', "Failed to lock account.", 500, req); 
  }
});

// ==========================================
// 🔥 UNLOCK ACCOUNT
// ==========================================
router.post('/api/users/unlock-account', async (req, res) => {
  try {
    const { email, securityCode } = req.body;
    if (!email || !securityCode) {
      return sendError(res, 'MISSING_FIELDS', "Email and security PIN are required.", 400, req);
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail }).select('+securityCode');
    if (!user || !user.isLocked) {
      return sendError(res, 'NOT_LOCKED', "Account is not locked or not found.", 400, req);
    }

    let isMatch = false;
    if (user.securityCode && user.securityCode.startsWith('$2')) {
      isMatch = await bcrypt.compare(securityCode, user.securityCode);
    } else {
      isMatch = (securityCode === user.securityCode);
    }

    if (!isMatch) {
      return sendError(res, 'INCORRECT_PIN', "Incorrect Security PIN.", 400, req);
    }

    user.isLocked = false;
    user.securityCode = undefined;
    await user.save();

    return sendSuccess(res, {}, "Account Unlocked", 200, req);
  } catch (error) {
    logError("Unlock Account Error:", error, { requestId: req.requestId });
    return sendError(res, 'SERVER_ERROR', "Failed to unlock account.", 500, req);
  }
});

// ==========================================
// 🔥 SECURED: UPDATE USER (IDOR FIXED & STRICT WHITELIST ZOD VALIDATED)
// ==========================================
router.put('/api/users/:id', protect, async (req, res) => {
  try {
    const targetUserId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return sendError(res, 'INVALID_USER_ID', "Invalid User ID format", 400, req);
    }

    // Only the user themselves OR an admin can update the profile
    if (req.user._id.toString() !== targetUserId && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return sendError(res, 'ACCESS_DENIED', "Access Denied: You cannot update someone else's profile.", 403, req);
    }

    // 🔥 Strict Whitelist Zod Validation (Prevents Mass-Assignment of role, isLocked, etc.)
    const validationResult = userUpdateValidator.safeParse(req.body);
    if (!validationResult.success) {
      return sendError(res, 'VALIDATION_FAILED', "Validation failed", 400, req, validationResult.error.format());
    }

    const updateData = validationResult.data;

    const updatedUser = await User.findByIdAndUpdate(targetUserId, updateData, { new: true, runValidators: true }).lean();
    if (!updatedUser) {
      return sendError(res, 'USER_NOT_FOUND', "User not found", 404, req);
    }

    return sendSuccess(res, { ...updatedUser, id: updatedUser._id.toString() }, "User updated successfully", 200, req);
  } catch (error) { 
    logError("Update User Error:", error, { requestId: req.requestId });
    return sendError(res, 'SERVER_ERROR', "Update failed", 500, req); 
  }
});

// ==========================================
// 🔥 SECURED: Clean Recently Viewed
// ==========================================
router.get('/api/users/get-valid-recently-viewed/:userId', protect, async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return sendError(res, 'INVALID_USER_ID', "Invalid User ID format", 400, req);
    }

    // IDOR Check
    if (req.user._id.toString() !== targetUserId && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return sendError(res, 'ACCESS_DENIED', "Access Denied", 403, req);
    }

    const user = await User.findById(targetUserId).lean();
    if (!user || !user.recentlyViewed || user.recentlyViewed.length === 0) {
      return sendSuccess(res, [], "Recently viewed fetched successfully", 200, req);
    }

    const validProducts = await Product.find({ _id: { $in: user.recentlyViewed } }).lean();
    const mapped = validProducts.map(p => ({ ...p, id: p._id.toString() }));
    return sendSuccess(res, mapped, "Recently viewed fetched successfully", 200, req);
  } catch (error) {
    logError("Get Recently Viewed Error:", error, { requestId: req.requestId });
    return sendError(res, 'SERVER_ERROR', "Error fetching recently viewed products", 500, req);
  }
});

module.exports = router;