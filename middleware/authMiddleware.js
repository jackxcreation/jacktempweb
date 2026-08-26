// middleware/authMiddleware.js
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

  // 🔥 UPDATED: Check Customer HttpOnly cookie first, fallback to Authorization header
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      // 🔥 AUDIT FIX: Explicit algorithm allowlist to prevent algorithm confusion attacks (e.g. 'none' or RS256/HS256 exploits)
      const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
      
      // Fetch user from DB and project necessary fields securely
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        return res.status(401).json({ message: 'User not found. Invalid token.' });
      }

      // 🔥 AUDIT FIX: Strict account status & lock validation on every protected request
      if (req.user.isLocked || req.user.isActive === false) {
        return res.status(403).json({ message: 'Access Denied: Account is locked, suspended, or inactive.' });
      }

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
// 🔥 SEPARATE ADMIN PROTECT MIDDLEWARE (Strict Admin Cookie Isolation)
// ==========================================
const adminProtect = async (req, res, next) => {
  let token;

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
      
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        return res.status(401).json({ message: 'Admin not found. Invalid token.' });
      }

      if (req.user.isLocked || req.user.isActive === false) {
        return res.status(403).json({ message: 'Access Denied: Account is locked, suspended, or inactive.' });
      }

      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access Denied: Requires Admin privileges.' });
      }

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
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as an admin' });
  }
};

module.exports = { protect, adminProtect, admin };