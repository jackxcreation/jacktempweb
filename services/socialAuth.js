// services/socialAuth.js
const { OAuth2Client } = require('google-auth-library');
const { User } = require('../models');
const crypto = require('crypto');
const { generateToken, formatSafeUser } = require('./authService');

// Initialize Google OAuth2 Client if client ID exists
const googleClient = process.env.GOOGLE_CLIENT_ID 
  ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID) 
  : null;

/**
 * Verify Google ID Token Server-Side and Securely Resolve Identity
 * Prevents identity spoofing by never trusting client-supplied email/name/googleId directly.
 */
const verifyAndAuthenticateGoogleToken = async ({ idToken, ip = 'Unknown', userAgent = 'Unknown Device' }) => {
  if (!googleClient) {
    throw new Error("Google OAuth Client ID is not configured on the server.");
  }

  if (!idToken) {
    throw new Error("Google ID Token is required for secure authentication.");
  }

  // 1. Verify the token cryptographically with Google's servers
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID, // Ensures token was minted for our app
  });

  const payload = ticket.getPayload();
  
  // 2. Extract authoritative identity claims from verified payload
  const googleId = payload.sub; // Unique, immutable Google Subject ID
  const email = payload.email;
  const name = payload.name || 'Google User';
  const emailVerified = payload.email_verified;

  if (!emailVerified) {
    throw new Error("Google account email is not verified.");
  }

  if (!googleId || !email) {
    throw new Error("Invalid Google token payload structure.");
  }

  const cleanEmail = email.toLowerCase().trim();

  // 3. Resolve or create user securely based on verified googleId / email
  let user = await User.findOne({ 
    $or: [{ googleId }, { email: cleanEmail }] 
  });

  let isNewUser = false;
  const sessionId = crypto.randomBytes(16).toString('hex');

  if (user) {
    if (user.isLocked) {
      const error = new Error("Account is LOCKED.");
      error.isLocked = true;
      error.email = user.email;
      throw error;
    }

    // Link googleId if logging in via Google for the first time with existing email
    if (!user.googleId) {
      user.googleId = googleId;
    }

    user.activeSessions = user.activeSessions || [];
    user.auditLogs = user.auditLogs || [];

    user.activeSessions.push({
      sessionId,
      ipAddress: ip,
      device: userAgent,
      loginAt: new Date()
    });

    user.auditLogs.push({
      action: 'SOCIAL_LOGIN',
      details: 'Securely logged in via verified Google ID Token',
      ip
    });

    await user.save();
  } else {
    // Register new user securely
    user = new User({
      name,
      email: cleanEmail,
      googleId,
      role: 'customer',
      isPhoneVerified: false,
      activeSessions: [{
        sessionId,
        ipAddress: ip,
        device: userAgent,
        loginAt: new Date()
      }],
      auditLogs: [{
        action: 'SOCIAL_REGISTER',
        details: 'Securely registered via verified Google ID Token',
        ip
      }]
    });

    await user.save();
    isNewUser = true;
  }

  // 4. Issue unified secure token via centralized auth service
  const token = generateToken(user, sessionId);

  return {
    token,
    sessionId,
    user: formatSafeUser(user),
    isNewUser
  };
};

module.exports = {
  verifyAndAuthenticateGoogleToken
};