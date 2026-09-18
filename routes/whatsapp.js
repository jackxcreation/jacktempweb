// routes/whatsapp.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const User = require('../models/User');

// ==========================================
// 🛡️ ADVANCED SERVER-SIDE RATE LIMITERS
// ==========================================
const sendOtpIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, 
  message: { success: false, message: 'Too many OTP requests from this IP. Please try again after an hour.' }
});

const verifyOtpIpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 15, 
  message: { success: false, message: 'Too many verification attempts from this IP. Please try again later.' }
});

// ==========================================
// 🔐 DATA PROTECTION: SAFE USER RESPONSE FORMATTER
// ==========================================
const formatSafeUser = (user) => {
  if (!user) return null;
  return {
    id: user._id || user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role || 'customer',
    isPhoneVerified: user.isPhoneVerified || false,
    isActive: user.isActive,
    twoFactorEnabled: user.twoFactorEnabled || false,
    addresses: user.addresses || [],
    wishlist: user.wishlist || [],
    recentlyViewed: user.recentlyViewed || []
  };
};

// ==========================================
// 🛡️ SECURE DB-BACKED OTP SCHEMA (Per-Phone & Per-Challenge Tracking)
// ==========================================
const whatsappOtpSchema = new mongoose.Schema({
  phone: { type: String, required: true, index: true },
  hashedOtp: { type: String, required: true },
  purpose: { type: String, default: 'signup' },
  attempts: { type: Number, default: 0 },
  requestCount: { type: Number, default: 1 }, 
  lastRequestedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, index: { expires: '5m' } } // Auto-deletes after 5 mins
});

const WhatsappOtp = mongoose.models.WhatsappOtp || mongoose.model('WhatsappOtp', whatsappOtpSchema);

// ==========================================
// 1. STRICT META WEBHOOK SIGNATURE VERIFICATION (P0 SECURITY)
// ==========================================
const verifyMetaSignature = (req) => {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature || !process.env.WHATSAPP_APP_SECRET) {
    console.error("🚨 CRITICAL SECURITY ERROR: WHATSAPP_APP_SECRET is missing or X-Hub-Signature-256 header is absent!");
    return false; // Strict failure: No dev fallback allowed!
  }
  
  try {
    const elements = signature.split('=');
    if (elements.length !== 2) return false;
    const signatureHash = elements[1];
    const expectedHash = crypto
      .createHmac('sha256', process.env.WHATSAPP_APP_SECRET)
      .update(JSON.stringify(req.body))
      .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(signatureHash, 'hex'), Buffer.from(expectedHash, 'hex'));
  } catch (err) {
    console.error("❌ Signature Verification Exception:", err.message);
    return false;
  }
};

// ==========================================
// 2. META WEBHOOK VERIFICATION (GET) - Strict Token Check (No Fallback)
// ==========================================
router.get('/webhook', (req, res) => {
  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!VERIFY_TOKEN) {
    console.error("🚨 CRITICAL CONFIG ERROR: WHATSAPP_VERIFY_TOKEN is missing in environment variables!");
    return res.status(500).json({ success: false, message: 'Server Configuration Error: Missing Verify Token' });
  }

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('✅ WEBHOOK_VERIFIED successfully by Meta!');
      return res.status(200).send(challenge);
    } else {
      console.warn('❌ Webhook verification failed: Token mismatch.');
      return res.sendStatus(403);
    }
  }
  return res.sendStatus(400);
});

// ==========================================
// 3. INCOMING WHATSAPP EVENTS & MESSAGES (POST) - Strict Signature Check
// ==========================================
router.post('/webhook', async (req, res) => {
  try {
    if (!verifyMetaSignature(req)) {
      console.warn('❌ Webhook signature verification failed. Request rejected.');
      return res.status(401).json({ success: false, message: 'Invalid or missing signature' });
    }

    const body = req.body;
    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry) {
        for (const change of (entry.changes || [])) {
          const value = change.value;
          if (value.messages && value.messages.length > 0) {
            const incomingMessage = value.messages[0];
            console.log(`📩 WhatsApp Message from ${incomingMessage.from}: "${incomingMessage.text?.body}"`);
          }
        }
      }
      return res.status(200).send('EVENT_RECEIVED');
    }
    return res.sendStatus(404);
  } catch (error) {
    console.error('❌ WhatsApp Webhook POST Error:', error.message);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// ==========================================
// 4. SEND WHATSAPP OTP (POST) - Per-Phone & Per-IP Rate Limited + Cooldown
// ==========================================
router.post('/send-otp', sendOtpIpLimiter, async (req, res) => {
  try {
    const { phone, purpose = 'signup' } = req.body;
    if (!phone || phone.length < 10) {
      return res.status(400).json({ success: false, message: 'Valid phone number is required.' });
    }

    const cleanPhone = phone.replace(/^\+91/, '').trim();
    const formattedPhone = `+91${cleanPhone}`;

    const existingRecord = await WhatsappOtp.findOne({ phone: formattedPhone });
    const now = Date.now();

    if (existingRecord) {
      const timeSinceLastRequest = now - new Date(existingRecord.lastRequestedAt).getTime();
      if (timeSinceLastRequest < 30 * 1000) {
        const waitSeconds = Math.ceil((30 * 1000 - timeSinceLastRequest) / 1000);
        return res.status(429).json({ 
          success: false, 
          message: `Please wait ${waitSeconds} seconds before requesting a new OTP.` 
        });
      }

      const windowTime = 15 * 60 * 1000;
      if (now - new Date(existingRecord.createdAt).getTime() < windowTime) {
        if (existingRecord.requestCount >= 5) {
          return res.status(429).json({ 
            success: false, 
            message: 'Too many OTP requests for this phone number. Please try again after 15 minutes.' 
          });
        }
      } else {
        await WhatsappOtp.deleteOne({ _id: existingRecord._id });
      }
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
    const expiresAt = new Date(now + 5 * 60 * 1000);

    if (existingRecord && (now - new Date(existingRecord.createdAt).getTime() < 15 * 60 * 1000)) {
      existingRecord.hashedOtp = hashedOtp;
      existingRecord.requestCount += 1;
      existingRecord.lastRequestedAt = new Date(now);
      existingRecord.expiresAt = expiresAt;
      existingRecord.attempts = 0; 
      await existingRecord.save();
    } else {
      await WhatsappOtp.deleteMany({ phone: formattedPhone });
      await WhatsappOtp.create({
        phone: formattedPhone,
        hashedOtp,
        purpose,
        attempts: 0,
        requestCount: 1,
        lastRequestedAt: new Date(now),
        expiresAt
      });
    }

    const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
    const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_ID;

    if (WHATSAPP_TOKEN && PHONE_NUMBER_ID) {
      await axios.post(
        `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: 'whatsapp',
          to: formattedPhone,
          type: 'template',
          template: {
            name: 'jack_essentials_otp',
            language: { code: 'en' },
            components: [
              {
                type: 'body',
                parameters: [{ type: 'text', text: otp }]
              },
              {
                type: 'button',
                sub_type: 'url',
                index: '0', 
                parameters: [{ type: 'text', text: otp }]
              }
            ]
          }
        },
        { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } }
      );
    } else {
      console.log(`[DEV MODE] WhatsApp OTP for ${formattedPhone}: ${otp}`);
    }

    return res.status(200).json({ success: true, message: 'OTP sent successfully to WhatsApp.' });
  } catch (error) {
    console.error('❌ WhatsApp Send OTP Error:', error.response?.data || error.message);
    return res.status(500).json({ success: false, message: 'Failed to send WhatsApp OTP.' });
  }
});

// ==========================================
// 5. VERIFY WHATSAPP OTP (POST) -> Sets Canonical HttpOnly Cookie & Sanitized User Response
// ==========================================
router.post('/verify-otp', verifyOtpIpLimiter, async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ success: false, message: 'Phone and OTP are required.' });
    }

    const cleanPhone = phone.replace(/^\+91/, '').trim();
    const formattedPhone = `+91${cleanPhone}`;

    const record = await WhatsappOtp.findOne({ phone: formattedPhone });
    if (!record) {
      return res.status(400).json({ success: false, message: 'OTP request not found or expired.' });
    }

    if (Date.now() > new Date(record.expiresAt).getTime()) {
      await WhatsappOtp.deleteOne({ _id: record._id });
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    if (record.attempts >= 5) {
      await WhatsappOtp.deleteOne({ _id: record._id });
      return res.status(400).json({ success: false, message: 'Too many incorrect attempts. Challenge invalidated. Request a new OTP.' });
    }

    const incomingHashedOtp = crypto.createHash('sha256').update(String(otp).trim()).digest('hex');
    if (record.hashedOtp !== incomingHashedOtp) {
      record.attempts += 1;
      await record.save();
      const remainingAttempts = 5 - record.attempts;
      return res.status(400).json({ 
        success: false, 
        message: `Invalid OTP code. ${remainingAttempts} attempts remaining.` 
      });
    }

    await WhatsappOtp.deleteOne({ _id: record._id });

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is missing");
    }

    const existingUser = await User.findOne({ 
      $or: [
        { phone: cleanPhone },
        { phone: formattedPhone }
      ]
    });

    if (existingUser) {
      const userToken = jwt.sign(
        { id: existingUser._id, role: existingUser.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // 🔥 ALIGNED WITH CANONICAL COOKIE NAMESPACES (`admin_session` / `customer_session`)
      const privilegedRoles = [
        'admin', 'super_admin', 'operations_manager', 'catalog_manager', 
        'warehouse_manager', 'customer_support', 'finance_manager', 
        'marketing_manager', 'content_manager', 'analyst', 'read_only_auditor', 
        'manager', 'catalog', 'support'
      ];
      const isAdminRole = privilegedRoles.includes(existingUser.role);
      const cookieName = isAdminRole ? 'admin_session' : 'customer_session';
      const maxAgeValue = isAdminRole ? 8 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;

      res.cookie(cookieName, userToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: maxAgeValue
      });

      return res.status(200).json({
        success: true,
        isExistingUser: true,
        message: 'Phone verified & logged in successfully!',
        user: formatSafeUser(existingUser)
      });
    }

    const verificationToken = jwt.sign(
      { phone: cleanPhone, verified: true },
      process.env.JWT_SECRET,
      { expiresIn: '10m' }
    );

    return res.status(200).json({
      success: true,
      isExistingUser: false,
      verificationToken,
      message: 'Phone verified successfully. Please complete your registration.'
    });

  } catch (error) {
    console.error('❌ WhatsApp Verify OTP Error:', error.message);
    return res.status(500).json({ success: false, message: error.message || 'Verification failed.' });
  }
});

module.exports = router;