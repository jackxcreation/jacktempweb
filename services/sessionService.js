// services/sessionService.js
const crypto = require('crypto');
const { User } = require('../models');

/**
 * 🔥 TASK #53: Create and persist a new active user session in the database
 * @param {String} userId - MongoDB User ID
 * @param {Object} req - Express request object for IP and User-Agent telemetry
 * @returns {String} sessionId (sid)
 */
const createUserSession = async (userId, req) => {
  const sessionId = crypto.randomBytes(16).toString('hex');
  const ip = req?.headers['x-forwarded-for'] || req?.socket?.remoteAddress || 'Unknown IP';
  const userAgent = req?.headers['user-agent'] || 'Unknown Device';

  const sessionEntry = {
    sessionId,
    ipAddress: ip,
    device: userAgent,
    loginAt: new Date(),
    lastActiveAt: new Date()
  };

  // Push to user's activeSessions array and maintain max 5 concurrent sessions per user for security hygiene
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found for session creation");
  }

  user.activeSessions = user.activeSessions || [];
  user.activeSessions.push(sessionEntry);

  if (user.activeSessions.length > 5) {
    user.activeSessions.shift(); // Remove oldest session
  }

  await user.save();
  return sessionId;
};

/**
 * 🔥 TASK #52 & #53: Validate if a session ID is currently active and valid for the user
 * @param {String} userId - MongoDB User ID
 * @param {String} sessionId - Session correlation ID (sid)
 * @returns {Boolean}
 */
const validateUserSession = async (userId, sessionId) => {
  if (!sessionId) return false;

  const user = await User.findById(userId).select('activeSessions isActive isLocked');
  if (!user || user.isActive === false || user.isLocked) {
    return false;
  }

  if (!user.activeSessions || !Array.isArray(user.activeSessions)) {
    return false;
  }

  const sessionExists = user.activeSessions.some(s => s.sessionId === sessionId);
  return sessionExists;
};

/**
 * 🔥 TASK #53: Revoke/Invalidate a specific session (Server-side session invalidation on logout)
 * @param {String} userId - MongoDB User ID
 * @param {String} sessionId - Session correlation ID to revoke
 */
const revokeUserSession = async (userId, sessionId) => {
  if (!userId || !sessionId) return;

  await User.findByIdAndUpdate(userId, {
    $pull: { activeSessions: { sessionId } }
  });
};

/**
 * 🔥 TASK #53: Terminate all active sessions across all devices (Logout-all capability)
 * @param {String} userId - MongoDB User ID
 */
const revokeAllUserSessions = async (userId) => {
  if (!userId) return;

  await User.findByIdAndUpdate(userId, {
    $set: { activeSessions: [] }
  });
};

/**
 * 🔥 TASK #51 & #53: Standardized Cookie Configuration Helper for HTTP-Only Secure Sessions
 * @param {Object} res - Express response object
 * @param {String} token - JWT token string
 * @param {String} role - User role (customer vs admin)
 */
const setSecureAuthCookie = (res, token, role = 'customer') => {
  const privilegedRoles = [
    'admin', 'super_admin', 'operations_manager', 'catalog_manager', 
    'warehouse_manager', 'customer_support', 'finance_manager', 
    'marketing_manager', 'content_manager', 'analyst', 'read_only_auditor', 
    'manager', 'catalog', 'support'
  ];
  
  const isAdminRole = privilegedRoles.includes(role);
  const cookieName = isAdminRole ? 'admin_session' : 'customer_session';
  const maxAgeValue = isAdminRole ? 8 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000; // 8 hours for admin, 7 days for customer

  res.cookie(cookieName, token, {
    httpOnly: true,                               // Protects against XSS token theft (Task #51)
    secure: process.env.NODE_ENV === 'production', // Requires HTTPS in production
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: maxAgeValue
  });
};

/**
 * 🔥 TASK #53: Clear all auth cookies during server-side logout
 * @param {Object} res - Express response object
 */
const clearSecureAuthCookies = (res) => {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
  };

  res.clearCookie('customer_session', cookieOptions);
  res.clearCookie('admin_session', cookieOptions);
  res.clearCookie('token', cookieOptions);
  res.clearCookie('admin_token', cookieOptions);
};

module.exports = {
  createUserSession,
  validateUserSession,
  revokeUserSession,
  revokeAllUserSessions,
  setSecureAuthCookie,
  clearSecureAuthCookies
};