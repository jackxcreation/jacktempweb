const jwt = require('jsonwebtoken');
const { User } = require('../models');

const authenticateSocket = async (socket, next) => {
  try {
    let token = null;

    // 1. Check handshake auth token first
    if (socket.handshake && socket.handshake.auth && socket.handshake.auth.token) {
      token = socket.handshake.auth.token;
    }

    // 2. 🔥 UPGRADE: Fallback to query parameters if auth token is missing
    if (!token && socket.handshake && socket.handshake.query && socket.handshake.query.token) {
      token = socket.handshake.query.token;
    }

    // 3. Check for tokens in cookies if still not provided
    if (!token && socket.handshake && socket.handshake.headers && socket.handshake.headers.cookie) {
      const cookies = socket.handshake.headers.cookie.split(';').reduce((acc, cookie) => {
        const eqIndex = cookie.indexOf('=');
        if (eqIndex > -1) {
          const name = cookie.substring(0, eqIndex).trim();
          const value = cookie.substring(eqIndex + 1).trim();
          acc[name] = value;
        }
        return acc;
      }, {});
      
      // 🔥 Expanded to include all isolated cookie namespaces used across backend
      token = cookies.customer_session || cookies.admin_session || cookies.admin_token || cookies.token || cookies.jwt || null;
    }

    // If token exists, verify and attach registered user
    if (token) {
      if (!process.env.JWT_SECRET) {
        console.error("🚨 CRITICAL SECURITY ERROR: JWT_SECRET environment variable is missing!");
      } else {
        // 🔥 AUDIT FIX: Explicit algorithm allowlist
        const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
        const userId = decoded.id || decoded.userId || decoded._id;

        if (userId) {
          const user = await User.findById(userId).select('-password');
          
          // 🔥 AUDIT FIX: Strict account lock and active status validation
          if (user && !user.isLocked && user.isActive !== false) {
            socket.user = user;
            socket.sessionId = decoded.sid;
            return next();
          }
        }
      }
    }

    // Fallback: Assign Guest Identity for public support chat
    socket.user = { 
      role: 'guest', 
      id: `guest_${socket.id}`, 
      name: 'Guest User',
      isGuest: true 
    };
    next();
    
  } catch (err) {
    console.warn("Socket Authentication Warning:", err.message);
    
    // If token is expired or invalid, still allow them to connect as a guest
    socket.user = { 
      role: 'guest', 
      id: `guest_${socket.id}`, 
      name: 'Guest User',
      isGuest: true 
    };
    next();
  }
};

module.exports = authenticateSocket;