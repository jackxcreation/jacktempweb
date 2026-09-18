// services/otpService.js
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { logger } = require('../utils/logger');

// ==========================================
// 🛡️ OTP SECURITY CONFIGURATION CONSTANTS
// ==========================================
const OTP_EXPIRY_MS = 5 * 60 * 1000;      // 5 Minutes
const RESEND_COOLDOWN_MS = 60 * 1000;     // 60 Seconds Cooldown
const MAX_ATTEMPTS = 5;                   // Max wrong guesses allowed

// ==========================================
// 📦 OTP MONGOOSE SCHEMA & MODEL
// ==========================================
const otpSchema = new mongoose.Schema({
  identifier: { type: String, required: true, lowercase: true, trim: true, index: true }, // phone or email
  otpHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  lastResentAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, index: { expires: 0 } } // TTL Index for automatic DB cleanup
}, { timestamps: true });

const OtpModel = mongoose.models.Otp || mongoose.model('Otp', otpSchema);

/**
 * Generate and store a secure OTP for a given phone or email identifier.
 * Enforces resend cooldown to prevent spamming.
 * 
 * @param {string} identifier - Phone number or email address
 * @returns {Promise<{ success: boolean, otp?: string, message?: string, waitSeconds?: number }>}
 */
const generateAndStoreOtp = async (identifier) => {
  try {
    const cleanIdentifier = identifier.toString().toLowerCase().trim();

    // Check existing active OTP record for cooldown enforcement
    const existingRecord = await OtpModel.findOne({ identifier: cleanIdentifier });
    if (existingRecord) {
      const elapsed = Date.now() - new Date(existingRecord.lastResentAt).getTime();
      if (elapsed < RESEND_COOLDOWN_MS) {
        const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
        return {
          success: false,
          code: 'RESEND_COOLDOWN_ACTIVE',
          message: `Please wait ${waitSeconds} seconds before requesting a new OTP.`,
          waitSeconds
        };
      }
    }

    // Generate secure 6-digit random number
    const rawOtp = crypto.randomInt(100000, 999999).toString();
    const salt = await bcrypt.genSalt(10);
    const otpHash = await bcrypt.hash(rawOtp, salt);

    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

    // Upsert OTP record in database
    await OtpModel.findOneAndUpdate(
      { identifier: cleanIdentifier },
      {
        otpHash,
        attempts: 0,
        lastResentAt: new Date(),
        expiresAt
      },
      { upsert: true, new: true }
    );

    logger.info(`🔐 OTP generated successfully for identifier: [${cleanIdentifier.slice(0, 4)}****]`);

    // Return raw OTP so the caller service (WhatsApp / Email service) can dispatch it
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
 * 
 * @param {string} identifier - Phone number or email address
 * @param {string} candidateOtp - User provided OTP
 * @returns {Promise<{ success: boolean, message: string }>}
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

module.exports = {
  generateAndStoreOtp,
  verifyOtp,
  OtpModel
};