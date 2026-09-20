// services/authService.js
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { JWT_SECRET } = require('../config/env');

/**
 * 🔥 TASK #53: Generate a cryptographically secure JWT token with session tracking (sid)
 * @param {Object} user - User mongoose document or plain object
 * @param {String} sessionId - Unique session correlation ID
 */
const generateToken = (user, sessionId = null) => {
  if (!JWT_SECRET) {
    throw new Error("Server Configuration Error: JWT_SECRET is missing");
  }
  const sid = sessionId || crypto.randomBytes(16).toString('hex');
  const privilegedRoles = [
    'admin', 'super_admin', 'operations_manager', 'catalog_manager', 
    'warehouse_manager', 'customer_support', 'finance_manager', 
    'marketing_manager', 'content_manager', 'analyst', 'read_only_auditor', 
    'manager', 'catalog', 'support'
  ];
  const isAdmin = privilegedRoles.includes(user.role);

  return jwt.sign(
    { 
      id: user._id || user.id, 
      role: user.role,
      sid 
    }, 
    JWT_SECRET, 
    { expiresIn: isAdmin ? '8h' : '7d' }
  );
};

/**
 * 🔥 TASK #52: Format user object to strip sensitive information before sending to client
 */
const formatSafeUser = (user) => {
  const userObj = user.toObject ? user.toObject() : user;
  
  delete userObj.password;
  delete userObj.resetOTP;
  delete userObj.resetOTPExpires;
  delete userObj.securityCode;
  delete userObj.twoFactorSecret;
  delete userObj.resetPasswordToken;
  delete userObj.resetPasswordExpire;
  
  return {
    id: userObj._id?.toString() || userObj.id,
    name: userObj.name,
    email: userObj.email,
    phone: userObj.phone,
    role: userObj.role,
    isActive: userObj.isActive,
    isLocked: userObj.isLocked,
    twoFactorEnabled: userObj.twoFactorEnabled,
    recentlyViewed: userObj.recentlyViewed || [],
    wishlist: userObj.wishlist || [],
    createdAt: userObj.createdAt
  };
};

/**
 * 🔥 TASKS #51, #52 & #53: Authenticate user credentials and register an active session
 */
const authenticateUser = async ({ email, password, ip = 'Unknown', userAgent = 'Unknown Device' }) => {
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    throw new Error("Invalid email or password");
  }

  if (user.isActive === false) {
    throw new Error("Account is inactive. Please contact support.");
  }

  if (user.isLocked) {
    const error = new Error("Account is locked.");
    error.isLocked = true;
    error.email = user.email;
    throw error;
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new Error("Invalid email or password");
  }

  // Generate unique session ID for server-side session invalidation (Task #53)
  const sessionId = crypto.randomBytes(16).toString('hex');
  
  user.activeSessions = user.activeSessions || [];
  user.activeSessions.push({
    sessionId,
    ipAddress: ip,
    device: userAgent,
    loginAt: new Date()
  });

  // Enforce max 5 concurrent active sessions per user for robust security hygiene
  if (user.activeSessions.length > 5) {
    user.activeSessions.shift();
  }

  user.loginHistory = user.loginHistory || [];
  user.loginHistory.unshift({
    ipAddress: ip,
    device: userAgent,
    timestamp: new Date()
  });
  if (user.loginHistory.length > 10) user.loginHistory.pop();

  await user.save();

  const token = generateToken(user, sessionId);
  return {
    token,
    user: formatSafeUser(user),
    sessionId
  };
};

/**
 * 🔥 TASKS #51, #52 & #53: Register a new user and initialize an active session
 */
const registerUser = async ({ name, email, password, phone, role = 'customer', ip = 'Unknown', userAgent = 'Unknown Device' }) => {
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new Error("Email is already registered. Please login.");
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const sessionId = crypto.randomBytes(16).toString('hex');

  const user = new User({
    name,
    email,
    password: hashedPassword,
    phone: phone || undefined,
    role: role || 'customer',
    isPhoneVerified: !!phone,
    activeSessions: [{
      sessionId,
      ipAddress: ip,
      device: userAgent,
      loginAt: new Date()
    }],
    auditLogs: [{
      action: 'REGISTER',
      details: 'User account created successfully via secure registration',
      ip
    }]
  });

  await user.save();

  const token = generateToken(user, sessionId);
  return {
    token,
    user: formatSafeUser(user),
    sessionId
  };
};

module.exports = {
  generateToken,
  formatSafeUser,
  authenticateUser,
  registerUser
};