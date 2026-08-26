const express = require('express');
const router = express.Router();
const { StockAlert, Product } = require('../models');
const { protect } = require('../middleware/authMiddleware');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
  port: process.env.SMTP_PORT || 2525,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || ''
  }
});

// Subscribe to Back-in-Stock Notification
router.post('/api/stock-alerts/subscribe', protect, async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.user._id;

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    if (parseInt(product.inventory) > 0) {
      return res.status(400).json({ message: "Product is already in stock!" });
    }

    const existing = await StockAlert.findOne({ user: userId, product: productId });
    if (existing) {
      return res.json({ success: true, message: "You are already subscribed for back-in-stock alerts." });
    }

    const newAlert = new StockAlert({
      user: userId,
      product: productId,
      email: req.user.email
    });

    await newAlert.save();
    res.status(201).json({ success: true, message: "We'll notify you via email and push as soon as this item is back in stock!" });
  } catch (error) {
    console.error("Stock Alert Error:", error);
    res.status(500).json({ message: "Server error setting stock alert" });
  }
});

// 🔥 HELPER FUNCTION: Triggered inside Product Update Route whenever inventory > 0
const checkAndTriggerStockAlerts = async (productId, newInventory, io) => {
  try {
    if (newInventory > 0) {
      const alerts = await StockAlert.find({ product: productId, isNotified: false }).populate('product');
      
      for (const alert of alerts) {
        // 1. Send Real-time Push via Socket.io
        if (io) {
          io.to(alert.user.toString()).emit('back_in_stock_alert', {
            title: "📦 Back in Stock!",
            message: `Good news! ${alert.product.title} is now available for purchase.`,
            productId: alert.product._id
          });
        }

        // 2. Send Email Alert
        if (alert.email) {
          await transporter.sendMail({
            from: '"Jack Essentials" <support@thejackessentials.com>',
            to: alert.email,
            subject: `🚀 Back in Stock: ${alert.product.title} is available now!`,
            html: `
              <div style="font-family:sans-serif;padding:24px;background:#f8f9fa;border-radius:16px;">
                <h2 style="color:#16a34a;">It's Back!</h2>
                <p>The item you requested is finally restocked:</p>
                <h3 style="color:#1e293b;">${alert.product.title}</h3>
                <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/product/${alert.product._id}" style="background:#FF4500;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:bold;margin-top:10px;">Buy Now Before It Sells Out</a>
              </div>
            `
          }).catch(err => console.log("Stock alert email failed", err));
        }

        alert.isNotified = true;
        await alert.save();
      }
    }
  } catch (err) {
    console.error("Stock alert background check error:", err);
  }
};

module.exports = { router, checkAndTriggerStockAlerts };