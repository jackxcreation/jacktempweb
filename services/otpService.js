// services/otpService.js
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken'); // 🔥 ADDED FOR SHORT-LIVED VERIFICATION TOKENS
const mongoose = require('mongoose');
const { logger } = require('../utils/logger');
const { JWT_SECRET } = require('../config/env'); // 🔥 ZERO-FALLBACK JWT SECRET

// ==========================================
// 🛡️ OTP SECURITY CONFIGURATION CONSTANTS
// ==========================================
const OTP_EXPIRY_MS = 5 * 60 * 1000;      // 5 Minutes Expiry
const RESEND_COOLDOWN_MS = 60 * 1000;     // 60 Seconds Cooldown
const MAX_HOURLY_OTPS = 5;                // Max 5 OTP requests per hour per identifier
const MAX_ATTEMPTS = 5;                   // Max wrong guesses allowed per OTP

// ==========================================
// 📦 OTP MONGOOSE SCHEMA & MODEL
// ==========================================
const otpSchema = new mongoose.Schema({
  identifier: { type: String, required: true, lowercase: true, trim: true, index: true }, // phone or email
  otpHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  lastResentAt: { type: Date, default: Date.now },
  requestTimestamps: { type: [Date], default: [] }, // Tracks request times for hourly limit abuse prevention
  expiresAt: { type: Date, required: true, index: { expires: 0 } } // TTL Index for automatic DB cleanup
}, { timestamps: true });

const OtpModel = mongoose.models.Otp || mongoose.model('Otp', otpSchema);

/**
 * Generate and store a secure OTP for a given phone or email identifier.
 * Enforces 60-second resend cooldown and Max 5 OTPs per hour per identifier.
 */
const generateAndStoreOtp = async (identifier) => {
  try {
    const cleanIdentifier = identifier.toString().toLowerCase().trim();
    const now = Date.now();

    let record = await OtpModel.findOne({ identifier: cleanIdentifier });

    if (record) {
      // 1. Check 60-Second Resend Cooldown
      const elapsed = now - new Date(record.lastResentAt).getTime();
      if (elapsed < RESEND_COOLDOWN_MS) {
        const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
        return {
          success: false,
          code: 'RESEND_COOLDOWN_ACTIVE',
          message: `Please wait ${waitSeconds} seconds before requesting a new OTP.`,
          waitSeconds
        };
      }

      // 2. Filter request timestamps to keep only those within the last 1 hour (3600000ms)
      const oneHourAgo = now - 60 * 60 * 1000;
      const recentRequests = (record.requestTimestamps || []).filter(ts => new Date(ts).getTime() > oneHourAgo);

      // 3. Check 5 OTPs / Hour Limit per Identifier (Abuse Prevention)
      if (recentRequests.length >= MAX_HOURLY_OTPS) {
        logger.warn(`⚠️ Hourly OTP limit exceeded for identifier: [${cleanIdentifier.slice(0, 4)}****]`);
        return {
          success: false,
          code: 'HOURLY_LIMIT_EXCEEDED',
          message: 'Maximum 5 OTP requests per hour allowed for this account. Please try again later.'
        };
      }

      recentRequests.push(new Date(now));
      record.requestTimestamps = recentRequests;
    }

    // 🔥 Generate cryptographically secure 6-digit random number (100000 to 999999)
    const rawOtp = crypto.randomInt(100000, 1000000).toString();
    const salt = await bcrypt.genSalt(10);
    const otpHash = await bcrypt.hash(rawOtp, salt);

    const expiresAt = new Date(now + OTP_EXPIRY_MS);

    // Upsert OTP record in database
    await OtpModel.findOneAndUpdate(
      { identifier: cleanIdentifier },
      {
        otpHash,
        attempts: 0,
        lastResentAt: new Date(now),
        requestTimestamps: record ? record.requestTimestamps : [new Date(now)],
        expiresAt
      },
      { upsert: true, new: true }
    );

    logger.info(`🔐 OTP generated successfully for identifier: [${cleanIdentifier.slice(0, 4)}****]`);

    return {
      success: true,
      otp: rawOtp,
      expiresInMinutes: 5
    };
  } catch (error) {
    logger.error({ message: "OTP Generation Service Error", error: error.message, stack: error.stack });
    throw new Error("Failed to generate secure OTP");
  }
};

/**
 * Verify candidate OTP against stored hash with brute-force protection (MAX_ATTEMPTS).
 */
const verifyOtp = async (identifier, candidateOtp) => {
  try {
    const cleanIdentifier = identifier.toString().toLowerCase().trim();
    const record = await OtpModel.findOne({ identifier: cleanIdentifier });

    if (!record) {
      return { success: false, code: 'OTP_NOT_FOUND', message: 'No active OTP found or it has already expired.' };
    }

    // Check Expiration
    if (Date.now() > new Date(record.expiresAt).getTime()) {
      await OtpModel.deleteOne({ _id: record._id });
      return { success: false, code: 'OTP_EXPIRED', message: 'OTP has expired. Please request a new one.' };
    }

    // Check Max Attempts (Brute-force guard)
    if (record.attempts >= MAX_ATTEMPTS) {
      await OtpModel.deleteOne({ _id: record._id });
      return { success: false, code: 'MAX_ATTEMPTS_EXCEEDED', message: 'Too many incorrect guesses. OTP has been invalidated for security.' };
    }

    // Compare candidate OTP with stored hash
    const isMatch = await bcrypt.compare(String(candidateOtp).trim(), record.otpHash);

    if (!isMatch) {
      record.attempts += 1;
      await record.save();
      const remainingAttempts = MAX_ATTEMPTS - record.attempts;
      
      logger.warn(`🚨 Invalid OTP attempt for identifier [${cleanIdentifier.slice(0, 4)}****]. Remaining attempts: ${remainingAttempts}`);
      
      return { 
        success: false, 
        code: 'INVALID_OTP', 
        message: `Invalid OTP. You have ${remainingAttempts} attempt(s) remaining before lockout.` 
      };
    }

    // Success: Delete OTP record to prevent reuse (One-time use policy)
    await OtpModel.deleteOne({ _id: record._id });
    logger.info(`✅ OTP verified successfully for identifier: [${cleanIdentifier.slice(0, 4)}****]`);

    return { success: true, message: 'OTP verified successfully.' };
  } catch (error) {
    logger.error({ message: "OTP Verification Service Error", error: error.message, stack: error.stack });
    throw new Error("OTP verification failed");
  }
};

/**
 * 🔥 TASK #15: Issue a short-lived verification token (10 mins) after successful OTP verification.
 * This token acts as proof-of-verification required during registration.
 */
const issueVerificationToken = (identifier) => {
  if (!JWT_SECRET) {
    throw new Error("Server Configuration Error: JWT_SECRET is required");
  }
  const cleanIdentifier = identifier.toLowerCase().trim();
  return jwt.sign(
    { identifier: cleanIdentifier, verified: true, purpose: 'registration' },
    JWT_SECRET,
    { expiresIn: '10m' } // Short-lived
  );
};

// 🔥 Add alias export support for maximum compatibility
generateAndStoreOtp.generateAndStoreOtp = generateAndStoreOtp;
verifyOtp.verifyOtp = verifyOtp;
issueVerificationToken.issueVerificationToken = issueVerificationToken;

module.exports = {
  generateAndStoreOtp,
  verifyOtp,
  issueVerificationToken,
  OtpModel
};