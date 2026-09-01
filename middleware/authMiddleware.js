require('dotenv').config();
const jwt = require('jsonwebtoken');
const { User } = require('../models'); 

// ==========================================
// 🔥 CRITICAL STARTUP VALIDATION (JWT Secret check)
// ==========================================
if (!process.env.JWT_SECRET) {
  console.error("🚨 CRITICAL SECURITY ERROR: JWT_SECRET environment variable is missing!");
  process.exit(1);
}

const protect = async (req, res, next) => {
  let token;

  // 🔥 UPDATED: Check Admin Cookie first, then Customer Cookie, then Header fallback
  if (req.cookies && req.cookies.admin_token) {
    token = req.cookies.admin_token;
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      // 🔥 AUDIT FIX: Explicit algorithm allowlist
      const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
      
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        return res.status(401).json({ message: 'User not found. Invalid token.' });
      }

      // 🔥 AUDIT FIX: Strict account status & lock validation
      if (user.isLocked || user.isActive === false) {
        return res.status(403).json({ message: 'Access Denied: Account is locked, suspended, or inactive.' });
      }

      // 🔥 ACTIVE SESSION REVOCATION CHECK (If session ID exists in token)
      if (decoded.sid && user.activeSessions && user.activeSessions.length > 0) {
        const sessionExists = user.activeSessions.some(s => s.sessionId === decoded.sid);
        if (!sessionExists) {
          return res.status(401).json({ message: 'Session has been revoked or terminated. Please login again.' });
        }
      }

      req.user = user;
      req.sessionId = decoded.sid;

      next();
    } catch (error) {
      console.error("JWT Verification Error:", error.message);
      
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Token has expired. Please login again.' });
      }
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ message: 'Invalid token signature. Unauthorized.' });
      }

      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } else {
    res.status(401).json({ message: 'Not authorized, no token provided' });
  }
};

// ==========================================
// 🔥 SEPARATE ADMIN / PRIVILEGED PROTECT MIDDLEWARE (Granular Roles Supported)
// ==========================================
const adminProtect = async (req, res, next) => {
  let token;

  // 🔥 Priority check for Admin Token Cookie
  if (req.cookies && req.cookies.admin_token) {
    token = req.cookies.admin_token;
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token; // Fallback for transition
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
      
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        return res.status(401).json({ message: 'Admin not found. Invalid token.' });
      }

      if (user.isLocked || user.isActive === false) {
        return res.status(403).json({ message: 'Access Denied: Account is locked, suspended, or inactive.' });
      }

      // 🔥 Session revocation check for admin
      if (decoded.sid && user.activeSessions && user.activeSessions.length > 0) {
        const sessionExists = user.activeSessions.some(s => s.sessionId === decoded.sid);
        if (!sessionExists) {
          return res.status(401).json({ message: 'Admin session has been revoked. Please login again.' });
        }
      }

      // 🔥 Allow Admin, Super Admin, and all granular staff roles (Operations, Catalog, Warehouse, Support, Finance, etc.)
      const privilegedRoles = [
        'admin', 'super_admin', 'operations_manager', 'catalog_manager', 
        'warehouse_manager', 'customer_support', 'finance_manager', 
        'marketing_manager', 'content_manager', 'analyst', 'read_only_auditor', 'manager', 'catalog', 'support'
      ];

      if (!privilegedRoles.includes(user.role)) {
        return res.status(403).json({ message: 'Access Denied: Requires privileged staff role.' });
      }

      req.user = user;
      req.sessionId = decoded.sid;

      next();
    } catch (error) {
      console.error("Admin JWT Verification Error:", error.message);
      
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Admin token has expired. Please login again.' });
      }
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ message: 'Invalid admin token signature. Unauthorized.' });
      }

      res.status(401).json({ message: 'Not authorized, admin token failed' });
    }
  } else {
    res.status(401).json({ message: 'Not authorized, no admin token provided' });
  }
};

const admin = (req, res, next) => {
  // Strict Role Enforcement Check
  const privilegedRoles = ['admin', 'super_admin', 'operations_manager', 'catalog_manager', 'warehouse_manager', 'finance_manager'];
  if (req.user && privilegedRoles.includes(req.user.role)) {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as an admin or privileged manager' });
  }
};

module.exports = { protect, adminProtect, admin };