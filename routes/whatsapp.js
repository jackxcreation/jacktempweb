const express = require('express');
const router = express.Router();
const axios = require('axios');
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Tera User model

// Temporary in-memory store for OTPs (Production ke liye Redis ya TTL DB collection best hai)
const otpStore = new Map(); 

// ==========================================
// 1. META WEBHOOK VERIFICATION (GET)
// Meta is endpoint par token match karne ke liye request bhejta hai
// ==========================================
router.get('/webhook', (req, res) => {
  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'jack_secure_whatsapp_token_2026';

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
// 2. INCOMING WHATSAPP EVENTS & MESSAGES (POST)
// Jab koi customer WhatsApp par message karega, Meta yahan data bhejega
// ==========================================
router.post('/webhook', async (req, res) => {
  try {
    const body = req.body;

    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry) {
        const changes = entry.changes;
        for (const change of changes) {
          const value = change.value;
          
          if (value.messages && value.messages.length > 0) {
            const incomingMessage = value.messages[0];
            const senderPhone = incomingMessage.from; // Customer ka phone number
            const messageText = incomingMessage.text?.body; // Message ka text

            console.log(`📩 WhatsApp Message from ${senderPhone}: "${messageText}"`);

            // Yahan tu chahe toh apne AI chatbot (Jack) ka logic trigger kar sakta hai!
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
// 3. SEND WHATSAPP OTP (POST)
// Website se user phone number dalega toh yeh OTP generate karke WhatsApp par bhejega
// ==========================================
router.post('/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone || phone.length < 10) {
      return res.status(400).json({ success: false, message: 'Valid phone number is required.' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes expiry

    otpStore.set(phone, { otp, expiresAt });

    const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
    const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_ID;

    if (WHATSAPP_TOKEN && PHONE_NUMBER_ID) {
      // Send via Meta Cloud API using standard template or text fallback
      await axios.post(
        `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: 'whatsapp',
          to: phone,
          type: 'template',
          template: {
            name: 'jack_essentials_otp', // Approved in your Meta Business Manager
            language: { code: 'en' },
            components: [
              {
                type: 'body',
                parameters: [{ type: 'text', text: otp }]
              },
              // 🔥 YEH BUTTON PARAMETER FIX HAI JO META MAANG RAHA THA 🔥
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
      // Dev mode fallback log if credentials are missing
      console.log(`[DEV MODE] WhatsApp OTP for ${phone}: ${otp}`);
    }

    return res.status(200).json({ success: true, message: 'OTP sent successfully to WhatsApp.' });
  } catch (error) {
    console.error('❌ WhatsApp Send OTP Error:', error.response?.data || error.message);
    return res.status(500).json({ success: false, message: 'Failed to send WhatsApp OTP.' });
  }
});

// ==========================================
// 4. VERIFY WHATSAPP OTP (POST)
// User jo OTP enter karega use verify karke login/register karega
// ==========================================
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ success: false, message: 'Phone and OTP are required.' });
    }

    const record = otpStore.get(phone);
    if (!record) {
      return res.status(400).json({ success: false, message: 'OTP request not found or expired.' });
    }

    if (Date.now() > record.expiresAt) {
      otpStore.delete(phone);
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    if (record.otp !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP code.' });
    }

    // Clear OTP after successful verification
    otpStore.delete(phone);

    // Normalize phone number variants to search safely in DB
    const cleanPhone = phone.replace(/^\+91/, '').trim();

    // 1. Find existing user matching any phone format variant
    let user = await User.findOne({ 
      $or: [
        { phone: phone },
        { phone: cleanPhone },
        { phone: `+91${cleanPhone}` }
      ]
    });

    // 2. If user doesn't exist, create one securely with fallback email to satisfy Mongoose schema
    if (!user) {
      user = await User.create({ 
        phone: cleanPhone, 
        email: `wa_${cleanPhone}@thejackessentials.com`, 
        name: 'WhatsApp User', 
        role: 'customer' 
      });
    }

    // 3. 🔥 Issue JWT Token for instant frontend login session state
    const token = jwt.sign(
      { id: user._id, userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    return res.status(200).json({
      success: true,
      message: 'Phone verified successfully!',
      token,
      user
    });
  } catch (error) {
    console.error('❌ WhatsApp Verify OTP Error:', error.message);
    return res.status(500).json({ success: false, message: error.message || 'Verification failed.' });
  }
});

module.exports = router;