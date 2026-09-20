// services/authService.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User } = require('../models');
const { JWT_SECRET } = require('../config/env'); // 🔥 Strict zero-fallback secret import

/**
 * Enterprise Authentication Service
 * Centralizes all user authentication, token generation, and session logic.
 */

// 🔐 Hash Password Helper
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

// 🔐 Compare Password Helper
const comparePassword = async (candidatePassword, hashedPassword) => {
  return await bcrypt.compare(candidatePassword, hashedPassword);
};

// 🪙 Generate Secure JWT Token with Session ID (Zero Fallback)
const generateToken = (user, sessionId) => {
  if (!JWT_SECRET) {
    throw new Error("Server Configuration Error: JWT_SECRET is required");
  }
  return jwt.sign(
    { 
      id: user._id || user.id, 
      role: user.role || 'customer', 
      sid: sessionId 
    }, 
    JWT_SECRET, 
    { expiresIn: '7d' } 
  );
};

// 🛡️ Safe User Response Formatter (Prevents sensitive data leaks)
const formatSafeUser = (user) => {
  if (!user) return null;
  return {
    id: user._id || user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role || 'customer',
    isPhoneVerified: user.isPhoneVerified || false,
    isActive: user.isActive,
    twoFactorEnabled: user.twoFactorEnabled || false,
    addresses: user.addresses || [],
    wishlist: user.wishlist || [],
    recentlyViewed: user.recentlyViewed || []
  };
};

// 👤 Authenticate User Credentials Service
const authenticateUser = async ({ email, password, ip = 'Unknown', userAgent = 'Unknown Device' }) => {
  const cleanEmail = email.toLowerCase().trim();
  
  const user = await User.findOne({ email: cleanEmail }).select('+password +twoFactorSecret +securityCode');
  if (!user) {
    throw new Error("Invalid email or password.");
  }

  if (user.isLocked) {
    const error = new Error("Account is LOCKED.");
    error.isLocked = true;
    error.email = user.email;
    throw error;
  }

  if (!user.password) {
    throw new Error("Please login using your Google account.");
  }

  const isMatch = await comparePassword(password, user.password);
  if (!isMatch) {
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    user.auditLogs = user.auditLogs || [];
    user.auditLogs.push({ action: 'FAILED_LOGIN', details: 'Incorrect password entered', ip });
    await user.save();
    throw new Error("Invalid email or password.");
  }

  // Clear failed attempts on success
  user.failedLoginAttempts = 0;

  // Create active session
  const sessionId = crypto.randomBytes(16).toString('hex');
  const time = new Date();

  user.activeSessions = user.activeSessions || [];
  user.loginHistory = user.loginHistory || [];
  user.auditLogs = user.auditLogs || [];

  user.activeSessions.push({
    sessionId,
    ipAddress: ip,
    device: userAgent,
    loginAt: time
  });

  user.loginHistory.push({
    ipAddress: ip,
    device: userAgent,
    status: 'SUCCESS',
    timestamp: time
  });

  user.auditLogs.push({
    action: 'LOGIN',
    details: `Successful login from device: ${userAgent}`,
    ip
  });

  await user.save();

  const token = generateToken(user, sessionId);

  return {
    token,
    sessionId,
    user: formatSafeUser(user)
  };
};

// 📝 Register New User Service
const registerUser = async ({ name, email, password, phone, role = 'customer', ip = 'Unknown', userAgent = 'Unknown Device' }) => {
  const cleanEmail = email.toLowerCase().trim();
  const existingUser = await User.findOne({ email: cleanEmail });
  
  if (existingUser) {
    throw new Error("This email is already registered. Please login.");
  }

  const hashedPassword = await hashPassword(password);
  const cleanPhone = phone ? phone.replace(/^\+91/, '').trim() : undefined;

  const newUser = new User({
    name,
    email: cleanEmail,
    password: hashedPassword,
    phone: cleanPhone,
    role,
    auditLogs: [{ action: 'REGISTER', details: 'User account created securely via auth service', ip }]
  });

  const sessionId = crypto.randomBytes(16).toString('hex');
  newUser.activeSessions = [{
    sessionId,
    ipAddress: ip,
    device: userAgent,
    loginAt: new Date()
  }];

  await newUser.save();

  const token = generateToken(newUser, sessionId);

  return {
    token,
    sessionId,
    user: formatSafeUser(newUser)
  };
};

// 🔥 Add robustness aliases for cross-module compatibility
hashPassword.hashPassword = hashPassword;
comparePassword.comparePassword = comparePassword;
generateToken.generateToken = generateToken;
formatSafeUser.formatSafeUser = formatSafeUser;
authenticateUser.authenticateUser = authenticateUser;
registerUser.registerUser = registerUser;

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  formatSafeUser,
  authenticateUser,
  registerUser
};