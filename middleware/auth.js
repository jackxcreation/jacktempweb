// middleware/auth.js
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { JWT_SECRET } = require('../config/env'); // 🔥 Strict zero-fallback secret import

const authenticateToken = async (req, res, next) => {
  try {
    let token;

    // 🔥 TASK #51: Support both Authorization headers and secure HttpOnly cookies for maximum flexibility
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && (req.cookies.customer_session || req.cookies.token || req.cookies.admin_session)) {
      token = req.cookies.customer_session || req.cookies.token || req.cookies.admin_session;
    }

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        code: 'NO_TOKEN_PROVIDED',
        message: 'Access denied. No token provided.',
        reference: `JE-AUTH-${Date.now().toString(36).toUpperCase()}`
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Fetch fresh user from DB to ensure account is active and not locked
    const user = await User.findById(decoded.id || decoded._id).select('-password');
    if (!user || user.isActive === false || user.isLocked) {
      return res.status(401).json({ 
        success: false, 
        code: 'INVALID_SESSION',
        message: 'Invalid session. User account not found, inactive, or locked.' 
      });
    }

    // 🔥 TASK #53: Server-side session invalidation check against activeSessions
    if (decoded.sid && user.activeSessions && Array.isArray(user.activeSessions) && user.activeSessions.length > 0) {
      const sessionExists = user.activeSessions.some(s => s.sessionId === decoded.sid);
      if (!sessionExists) {
        return res.status(401).json({
          success: false,
          code: 'SESSION_REVOKED',
          message: 'Session has been revoked or terminated. Please log in again.'
        });
      }
    }

    req.user = user;
    req.sessionId = decoded.sid; // 🔥 Attached session ID for unified tracking with authService
    next();
  } catch (err) {
    console.error("Auth Middleware Error:", err.message);
    return res.status(403).json({ 
      success: false, 
      code: 'INVALID_TOKEN',
      message: 'Invalid or expired token.' 
    });
  }
};

// 🔥 Dual export support for both direct use and destructuring ({ protect, authenticateToken })
authenticateToken.protect = authenticateToken;
authenticateToken.authenticateToken = authenticateToken;

// Optional admin guard alias if imported from auth middleware
authenticateToken.admin = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Not authorized' });
  }
  const privilegedRoles = [
    'admin', 'super_admin', 'operations_manager', 'catalog_manager', 
    'warehouse_manager', 'customer_support', 'finance_manager', 
    'marketing_manager', 'content_manager', 'analyst', 'read_only_auditor', 
    'manager', 'catalog', 'support'
  ];
  if (!privilegedRoles.includes(req.user.role)) {
    return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Admin access required' });
  }
  next();
};

module.exports = authenticateToken;