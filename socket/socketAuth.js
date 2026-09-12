const jwt = require('jsonwebtoken');
const { User } = require('../models');

const authenticateSocket = async (socket, next) => {
  try {
    let token = socket.handshake.auth.token;

    // Check for tokens in cookies if not provided in handshake auth
    if (socket.handshake.headers.cookie) {
      const cookies = socket.handshake.headers.cookie.split(';').reduce((acc, cookie) => {
        const [name, value] = cookie.trim().split('=');
        acc[name] = value;
        return acc;
      }, {});
      
      token = cookies.admin_token || cookies.token || token;
    }

    // If token exists, verify and attach registered user
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      
      if (user && !user.isLocked) {
        socket.user = user;
        return next();
      }
    }

    // Fallback: Assign Guest Identity for public support chat
    socket.user = { role: 'guest', id: `guest_${socket.id}`, name: 'Guest User' };
    next();
  } catch (err) {
    // If token is expired or invalid, still allow them to connect as a guest
    socket.user = { role: 'guest', id: `guest_${socket.id}`, name: 'Guest User' };
    next();
  }
};

module.exports = authenticateSocket;