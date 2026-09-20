// middleware/socketAuth.js
const jwt = require('jsonwebtoken');
const { User } = require('../models');

// 🔥 Privileged enterprise roles allowed for administrative socket actions
const PRIVILEGED_ROLES = [
  'admin', 'super_admin', 'operations_manager', 'catalog_manager', 
  'warehouse_manager', 'customer_support', 'finance_manager', 
  'marketing_manager', 'content_manager', 'analyst', 'read_only_auditor', 
  'manager', 'catalog', 'support'
];

/**
 * Socket.IO Authentication Middleware (Tasks #31, #32, #33)
 * Authenticates client connection via JWT handshake auth token or cookies,
 * and attaches role validation helpers to socket.user.
 */
const socketAuthMiddleware = async (socket, next) => {
  try {
    let token = socket.handshake.auth?.token;

    if (!token && socket.handshake.headers?.cookie) {
      const cookies = socket.handshake.headers.cookie.split(';').reduce((acc, cookie) => {
        const eqIndex = cookie.indexOf('=');
        if (eqIndex > -1) {
          const name = cookie.substring(0, eqIndex).trim();
          const value = cookie.substring(eqIndex + 1).trim();
          acc[name] = value;
        }
        return acc;
      }, {});
      
      token = cookies.admin_session || cookies.customer_session || cookies.admin_token || cookies.token || cookies.jwt || token;
    }

    if (!token) {
      socket.user = { 
        role: 'guest', 
        _id: `guest_${socket.id}`, 
        id: `guest_${socket.id}`, 
        name: 'Guest User', 
        isGuest: true,
        isPrivileged: false
      };
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id || decoded.userId || decoded._id;
    const user = await User.findById(userId).select('-password');
    
    if (!user || user.isLocked || user.isActive === false) {
      socket.user = { 
        role: 'guest', 
        _id: `guest_${socket.id}`, 
        id: `guest_${socket.id}`, 
        name: 'Guest User', 
        isGuest: true,
        isPrivileged: false
      };
      return next();
    }
    
    const userObj = user.toObject ? user.toObject() : user;
    socket.user = userObj; 
    socket.user.isPrivileged = PRIVILEGED_ROLES.includes(socket.user.role) || socket.user.role === 'admin' || socket.user.role === 'super_admin';

    next();
  } catch (err) {
    socket.user = { 
      role: 'guest', 
      _id: `guest_${socket.id}`, 
      id: `guest_${socket.id}`, 
      name: 'Guest User', 
      isGuest: true,
      isPrivileged: false
    };
    next();
  }
};

module.exports = socketAuthMiddleware;
module.exports.PRIVILEGED_ROLES = PRIVILEGED_ROLES;