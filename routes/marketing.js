const express = require('express');
const router = express.Router();
const Subscriber = require('../models/Subscriber');
const nodemailer = require('nodemailer');

// 1. Subscribe API
router.post('/subscribe', async (req, res) => {
  try {
    const { email } = req.body;
    const newSub = new Subscriber({ email });
    await newSub.save();
    res.status(201).json({ message: "Subscribed successfully!" });
  } catch (error) {
    res.status(400).json({ message: "Email already subscribed or error." });
  }
});

// 2. Fetch all subscribers for Admin
router.get('/subscribers', async (req, res) => {
  const subs = await Subscriber.find();
  res.json(subs);
});

// 3. Send Bulk Email API
router.post('/send-bulk-email', async (req, res) => {
  const { subject, message, emails } = req.body; // emails array hona chahiye
  
  const transporter = nodemailer.createTransport({
    service: 'gmail', // Ya SendGrid/Mailgun use karo production ke liye
    auth: { user: 'your-email@gmail.com', pass: 'your-app-password' }
  });

  try {
    await transporter.sendMail({
      from: '"Jack Essentials" <your-email@gmail.com>',
      bcc: emails, // BCC use karna taaki ek dusre ko email na dikhe
      subject: subject,
      html: message
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;