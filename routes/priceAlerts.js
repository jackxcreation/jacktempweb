const express = require('express');
const router = express.Router();
const { PriceAlert, Product } = require('../models');
const { protect } = require('../middleware/authMiddleware');

// ==========================================
// 🔔 SUBSCRIBE TO PRICE DROP ALERT
// ==========================================
router.post('/api/price-alerts', protect, async (req, res) => {
  try {
    const { productId, targetPrice } = req.body;
    const userId = req.user._id;

    if (!productId || !targetPrice) {
      return res.status(400).json({ success: false, message: "Product ID and Target Price are required." });
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    // Check if alert already exists for this user and product
    const existingAlert = await PriceAlert.findOne({ productId, userId });
    if (existingAlert) {
      existingAlert.targetPrice = targetPrice;
      await existingAlert.save();
      return res.status(200).json({ success: true, message: "Price alert updated successfully.", alert: existingAlert });
    }

    const newAlert = new PriceAlert({
      productId,
      userId,
      userEmail: req.user.email,
      targetPrice
    });

    await newAlert.save();
    res.status(201).json({ success: true, message: "Price alert set successfully.", alert: newAlert });
  } catch (error) {
    console.error("Create Price Alert Error:", error);
    res.status(500).json({ success: false, message: "Failed to set price alert." });
  }
});

// ==========================================
// 📋 GET USER'S PRICE ALERTS
// ==========================================
router.get('/api/price-alerts', protect, async (req, res) => {
  try {
    const alerts = await PriceAlert.find({ userId: req.user._id })
      .populate('productId', 'title price image')
      .sort({ createdAt: -1 });
    
    res.status(200).json({ success: true, count: alerts.length, alerts });
  } catch (error) {
    console.error("Fetch Price Alerts Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch price alerts." });
  }
});

// ==========================================
// 🗑️ DELETE A PRICE ALERT
// ==========================================
router.delete('/api/price-alerts/:id', protect, async (req, res) => {
  try {
    const alert = await PriceAlert.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!alert) {
      return res.status(404).json({ success: false, message: "Alert not found." });
    }
    res.status(200).json({ success: true, message: "Price alert removed successfully." });
  } catch (error) {
    console.error("Delete Price Alert Error:", error);
    res.status(500).json({ success: false, message: "Failed to remove price alert." });
  }
});

// 🔥 EXPORT AS AN OBJECT CONTAINING ROUTER (Kyunki server.js .router expect kar raha hai)
module.exports = { router };