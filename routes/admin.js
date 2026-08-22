const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer'); 
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Resend } = require('resend');
const { Setting, Subscriber, EmailTemplate, Ticket, AbandonedCart } = require('../models');
const { getReportTemplate, getBulkEmailTemplate } = require('../emailTemplates');

// 🚨 IMPORT AUTH MIDDLEWARES HERE
const { protect, admin } = require('../middleware/authMiddleware');

const resend = new Resend(process.env.RESEND_API_KEY);

// ⚙️ 4. STORE SETTINGS
// GET is public (Frontend needs to show footer/links)
router.get('/api/settings', async (req, res) => {
  try {
    let settings = await Setting.findOne().lean();
    if (!settings) {
      const newSettings = new Setting();
      await newSettings.save();
      settings = newSettings.toObject(); 
    }
    res.json(settings);
  } catch (error) { res.status(500).json({ message: "Failed to fetch settings" }); }
});

// PUT is strictly ADMIN ONLY
router.put('/api/settings', protect, admin, async (req, res) => {
  try {
    const { footerAbout, socialLinks, shopLinks, supportLinks } = req.body;
    let settings = await Setting.findOne();
    if (settings) {
      settings.footerAbout = footerAbout || settings.footerAbout;
      settings.socialLinks = socialLinks || settings.socialLinks;
      settings.shopLinks = shopLinks || settings.shopLinks;
      settings.supportLinks = supportLinks || settings.supportLinks;
      await settings.save();
    } else {
      settings = new Setting(req.body);
      await settings.save();
    }
    res.json({ message: "Store configuration updated successfully!", settings });
  } catch (error) { res.status(500).json({ message: "Failed to update settings" }); }
});

// 📧 5. EMAIL MARKETING & SUBSCRIBERS
// Public can subscribe
router.post('/api/subscribe', async (req, res) => {
  try {
    const { email } = req.body;
    const newSub = new Subscriber({ email });
    await newSub.save();
    res.status(201).json({ message: "Subscribed successfully!" });
  } catch (error) { res.status(400).json({ message: "Email already subscribed or error." }); }
});

// Strictly ADMIN ONLY to view subscribers
router.get('/api/subscribers', protect, admin, async (req, res) => {
  try {
    const subscribers = await Subscriber.find({}, 'email subscribedAt').lean();
    res.json(subscribers);
  } catch (error) { res.status(500).json({ message: "Error fetching subscribers" }); }
});

// Strictly ADMIN ONLY to send bulk emails
router.post('/api/send-bulk-email', protect, admin, async (req, res) => {
  const { subject, message, emails } = req.body;
  if (!emails || emails.length === 0) return res.status(400).json({ success: false, message: "No users selected" });
  if (!process.env.RESEND_API_KEY) return res.status(500).json({ error: "RESEND_API_KEY is missing." });

  try {
    const htmlContent = getBulkEmailTemplate(subject, message);
    const { data, error } = await resend.emails.send({
      from: 'Jack Essentials <updates@thejackessentials.com>',
      to: ['jackessentialstm@gmail.com'], 
      bcc: emails, 
      subject: subject,
      html: htmlContent,
    });
    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true, message: "Emails sent successfully via Resend API!" });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Strictly ADMIN ONLY
router.post('/api/send-report', protect, admin, async (req, res) => {
  const { to, subject, data, dateRange } = req.body;
  if (!process.env.RESEND_API_KEY) return res.status(500).json({ error: "RESEND_API_KEY is missing" });

  try {
    const htmlContent = getReportTemplate(data, dateRange);
    const { data: resendData, error } = await resend.emails.send({
      from: 'Jack Essentials <updates@thejackessentials.com>', 
      to: [to], subject: subject, html: htmlContent
    });
    if (error) return res.status(400).json({ error: error.message });
    res.status(200).json({ success: true, message: "Report sent successfully!" });
  } catch (error) { res.status(500).json({ error: "Failed to send report email" }); }
});

// 📝 6. EMAIL TEMPLATES - Strictly ADMIN ONLY
router.get('/api/email-templates', protect, admin, async (req, res) => {
  try {
    const templates = await EmailTemplate.find().sort({ createdAt: -1 }).lean();
    res.json(templates);
  } catch (error) { res.status(500).json({ message: "Error fetching templates" }); }
});

router.post('/api/email-templates', protect, admin, async (req, res) => {
  try {
    const newTemplate = new EmailTemplate(req.body);
    await newTemplate.save();
    res.status(201).json(newTemplate);
  } catch (error) { res.status(500).json({ message: "Error saving template" }); }
});

router.delete('/api/email-templates/:id', protect, admin, async (req, res) => {
  try {
    await EmailTemplate.findByIdAndDelete(req.params.id);
    res.json({ message: "Template deleted" });
  } catch (error) { res.status(500).json({ message: "Error deleting template" }); }
});

// 🤖 7. GEMINI AI - Public (assuming chatbot is for normal users)
router.post('/api/gemini-chat', async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) return res.status(500).json({ text: "[TRANSFER_TO_AGENT]" });

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const { userMessage, chatHistory, systemInstruction } = req.body;

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash", 
      systemInstruction: systemInstruction,
    });

    let formattedHistory = chatHistory ? chatHistory.map(msg => ({
      role: (msg.role === 'model' || msg.role === 'bot') ? 'model' : 'user',
      parts: [{ text: msg.parts[0].text }],
    })) : [];

    while (formattedHistory.length > 0 && formattedHistory[0].role === 'model') {
      formattedHistory.shift(); 
    }

    const chat = model.startChat({ history: formattedHistory, generationConfig: { temperature: 0.3 } });
    const result = await chat.sendMessage(userMessage);
    res.json({ text: result.response.text() });
  } catch (error) { res.status(500).json({ text: "[TRANSFER_TO_AGENT]" }); }
});

// 🎟️ 8. TICKETS - Strictly ADMIN ONLY
router.get('/api/tickets', protect, admin, async (req, res) => {
  try {
    const tickets = await Ticket.find().sort({ createdAt: -1 }).lean();
    res.json(tickets);
  } catch (error) { res.status(500).json({ message: "Failed to load tickets" }); }
});

// 🛒 9. ABANDONED CARTS
// IDOR FIX: Only logged in users can sync their cart. 
// We NO LONGER trust req.body.user.id. We use req.user._id from the verified JWT.
router.post('/api/sync-cart', protect, async (req, res) => {
  try {
    const { items, totalValue } = req.body;
    
    // Server assigns the identity securely from the JWT token
    const secureUserId = req.user._id; 
    
    if (items.length === 0) {
      await AbandonedCart.findOneAndDelete({ "user.userId": secureUserId });
      return res.json({ message: "Cart cleared" });
    }

    const cartData = {
      user: { 
        userId: secureUserId, 
        name: req.user.name, 
        email: req.user.email, 
        phone: req.user.phone || "No Number" 
      },
      items, 
      totalValue, 
      updatedAt: new Date()
    };

    await AbandonedCart.findOneAndUpdate(
      { "user.userId": secureUserId }, 
      { $set: cartData }, 
      { upsert: true, returnDocument: 'after' }
    );
    res.json({ message: "Cart synced successfully" });
  } catch (error) { res.status(500).json({ message: "Error syncing cart" }); }
});

// Strictly ADMIN ONLY
router.get('/api/abandoned-carts', protect, admin, async (req, res) => {
  try {
    const carts = await AbandonedCart.find().sort({ updatedAt: -1 }).lean();
    res.json(carts);
  } catch (error) { res.status(500).json({ message: "Error fetching abandoned carts" }); }
});

// Strictly ADMIN ONLY
router.put('/api/abandoned-carts/:id/note', protect, admin, async (req, res) => {
  try {
    const { adminNote } = req.body;
    const updatedCart = await AbandonedCart.findByIdAndUpdate(req.params.id, { adminNote }, { returnDocument: 'after' });
    res.json(updatedCart);
  } catch (error) { res.status(500).json({ message: "Error updating note" }); }
});

module.exports = router;