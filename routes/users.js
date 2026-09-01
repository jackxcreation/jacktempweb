const express = require('express');
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

// 🔥 Generate Secure JWT Token Helper
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// ==========================================
// 🛡️ ZOD VALIDATION SCHEMAS FOR USERS & AUTH
// ==========================================
const registerSchema = z.object({
  name: z.string().min(2, "Name is required").max(100, "Name is too long"),
  email: z.string().email("Invalid email address"),
  mobile: z.string().regex(/^\d{10}$/, "Invalid mobile number. Must be 10 digits").optional(),
  password: z.string().min(6, "Password must be at least 6 characters long")
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required")
});

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
    // 🔥 Strict Zod Validation
    const validationResult = otpSchema.pick({ email: true }).safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ success: false, message: "Invalid email format", errors: validationResult.error.format() });
    }

    const { email } = validationResult.data;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already available. Please login." });
    }

    // Cryptographically secure OTP generation (Not just Math.random)
    const otp = crypto.randomInt(100000, 999999).toString();

    otpStore.set(email, {
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
        to: [email],
        subject: 'Your Verification Code - Jack Essentials',
        html: htmlContent
      });
    }

    res.status(200).json({ message: "OTP sent successfully!" });
  } catch (error) {
    console.error("Send OTP Error:", error);
    res.status(500).json({ message: "Server error while sending OTP" });
  }
});

router.post('/api/public/verify-otp', otpVerifyLimiter, async (req, res) => {
  try {
    // 🔥 Strict Zod Validation
    const validationResult = otpSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: validationResult.error.format() });
    }

    const { email, otp } = validationResult.data;
    const record = otpStore.get(email);

    if (!record) return res.status(400).json({ message: "No OTP requested or it has expired." });
    
    if (Date.now() > record.expiresAt) {
      otpStore.delete(email); 
      return res.status(400).json({ message: "OTP has expired. Please resend." });
    }
    
    if (record.otp !== otp) return res.status(400).json({ message: "Invalid OTP." });

    otpStore.delete(email);
    res.status(200).json({ message: "OTP verified successfully." });
  } catch (error) {
    res.status(500).json({ message: "Server error during verification" });
  }
});

// ==========================================
// 👤 2. USER APIs (AUTHENTICATION)
// ==========================================

// 🔥 STRICTLY ADMIN ONLY
router.get('/api/users', protect, admin, async (req, res) => {
  try {
    const users = await User.find({}, 'name email createdAt role').lean();
    res.json(users);
  } catch (error) { res.status(500).json({ message: "Error fetching users" }); }
});

// ==========================================
// 🔥 NEW: CUSTOMER 360 CRM PROFILE API
// ==========================================
router.get('/api/users/:id/360-profile', protect, admin, async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId).populate('wishlist').populate('recentlyViewed').lean();
    if (!user) return res.status(404).json({ success: false, message: "Customer not found" });

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

    res.json({
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
    res.status(500).json({ success: false, message: "Failed to generate Customer 360 profile" });
  }
});

router.post('/api/users/register', async (req, res) => {
  try {
    // 🔥 Strict Zod Validation
    const validationResult = registerSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: validationResult.error.format() });
    }

    const { name, email, mobile, password } = validationResult.data;
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: "User already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Default role should be 'user'. You can manually change your DB entry to 'admin' later.
    const newUser = new User({ name, email, mobile, password: hashedPassword, role: 'user' });
    await newUser.save();

    if (process.env.RESEND_API_KEY) {
      const htmlContent = getWelcomeTemplate(name || 'User');
      resend.emails.send({
        from: 'Jack Essentials <updates@thejackessentials.com>', 
        to: [email],
        subject: 'Welcome to the Elite Club! 🎉',
        html: htmlContent
      }).catch(err => {});
    }

    // 🔥 GENERATE JWT TOKEN
    const token = generateToken(newUser._id);

    res.status(201).json({ message: "User registered successfully", userId: newUser._id, token });
  } catch (error) { 
    res.status(500).json({ message: "Registration failed" }); 
  }
});

router.post('/api/users/login', async (req, res) => {
  try {
    // 🔥 Strict Zod Validation
    const validationResult = loginSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ success: false, message: "Validation failed", errors: validationResult.error.format() });
    }

    const { email, password } = validationResult.data;
    
    const user = await User.findOne({ email }).select('+password');
    if (!user) return res.status(400).json({ message: "Invalid email or password" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid email or password" });

    if (user.isLocked) {
      return res.status(403).json({ message: "Account is LOCKED for security. Please use the unlock page.", isLocked: true });
    }
    
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown Location';
    const userAgent = req.headers['user-agent'] || 'Unknown Device';
    const time = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    
    const lockToken = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = lockToken;
    user.resetPasswordExpire = Date.now() + 3000000; 
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
      }).catch(err => {});
    }
    
    // 🔥 GENERATE REAL JWT TOKEN
    const token = generateToken(user._id);

    // Filter password from response
    const userResponse = { ...user._doc, id: user._id.toString() };
    delete userResponse.password;

    res.json({ message: "Login successful", token, user: userResponse });
  } catch (error) { 
    console.error(error);
    res.status(500).json({ message: "Login failed" }); 
  }
});

// ==========================================
// 🔥 VERIFY LOCK LINK
// ==========================================
router.get('/api/users/verify-lock-link', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.json({ valid: false, reason: 'expired' });

    const user = await User.findOne({ resetPasswordToken: token });
    if (!user || user.resetPasswordExpire < Date.now()) {
      return res.json({ valid: false, reason: 'expired' });
    }
    
    if (user.isLocked) return res.json({ valid: false, reason: 'used' });

    res.json({ valid: true, email: user.email });
  } catch (error) {
    return res.json({ valid: false, reason: 'expired' });
  }
});

// ==========================================
// 🔥 LOCK ACCOUNT USING TOKEN
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
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.json({ success: true, message: "Account locked securely.", userId: user._id });
  } catch (error) { 
    res.status(500).json({ message: "Failed to lock account." }); 
  }
});

// ==========================================
// 🔥 UNLOCK ACCOUNT
// ==========================================
router.post('/api/users/unlock-account', async (req, res) => {
  try {
    const { email, securityCode } = req.body;

    const user = await User.findOne({ email });
    if (!user || !user.isLocked) return res.status(400).json({ error: "Account is not locked or not found." });

    let isMatch = false;
    if (user.securityCode && user.securityCode.startsWith('$2')) {
      isMatch = await bcrypt.compare(securityCode, user.securityCode);
    } else {
      isMatch = (securityCode === user.securityCode);
    }

    if (!isMatch) return res.status(400).json({ error: "Incorrect Security PIN." });

    user.isLocked = false;
    user.securityCode = undefined;
    await user.save();

    res.json({ success: true, message: "Account Unlocked" });
  } catch (error) {
    res.status(500).json({ error: "Failed to unlock account." });
  }
});

// ==========================================
// 🔥 SOCIAL LOGIN
// ==========================================
router.post('/api/users/social-login', async (req, res) => {
  try {
    const { name, email, firebaseId } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    let user = await User.findOne({ email });
    let isNewUser = false; 
    
    if (!user) {
      user = new User({ name: name || 'User', email, password: firebaseId || 'social_login', role: 'user' });
      await user.save();
      isNewUser = true; 
    }

    if (user.isLocked) return res.status(403).json({ message: "Account is LOCKED. Please login via Email/Password to enter your PIN.", isLocked: true });
    
    // 🔥 GENERATE REAL JWT TOKEN
    const token = generateToken(user._id);

    const userResponse = { ...user._doc, id: user._id.toString() };
    delete userResponse.password;
    
    res.json({ message: "Login successful", isNewUser, token, user: userResponse });
  } catch (error) { 
    res.status(500).json({ message: "Social login failed" }); 
  }
});

// ==========================================
// 🔥 SECURED: UPDATE USER (IDOR FIXED & ZOD VALIDATED)
// ==========================================
router.put('/api/users/:id', protect, async (req, res) => {
  try {
    // Only the user themselves OR an admin can update the profile
    if (req.user._id.toString() !== req.params.id && req.user.role !== 'admin') {
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
    if (updateData.role && req.user.role !== 'admin') {
      delete updateData.role; 
    }

    const updatedUser = await User.findByIdAndUpdate(req.params.id, updateData, { returnDocument: 'after' });
    res.json({ ...updatedUser._doc, id: updatedUser._id.toString() });
  } catch (error) { res.status(500).json({ message: "Update failed" }); }
});

// ==========================================
// 🔥 SECURED: Clean Recently Viewed
// ==========================================
router.get('/api/users/get-valid-recently-viewed/:userId', protect, async (req, res) => {
  try {
    // IDOR Check
    if (req.user._id.toString() !== req.params.userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: "Access Denied" });
    }

    const user = await User.findById(req.params.userId);
    if (!user || !user.recentlyViewed || user.recentlyViewed.length === 0) return res.json([]);

    const validProducts = await Product.find({ _id: { $in: user.recentlyViewed } });
    res.json(validProducts);
  } catch (error) {
    res.status(500).json({ message: "Error" });
  }
});

module.exports = router;