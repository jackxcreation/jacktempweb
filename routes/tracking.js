// routes/trackRouter.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { Order } = require('../models');

// Track Order by Order ID, Tracking Number, or AWB
router.get('/api/track/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    if (!orderId || typeof orderId !== 'string' || orderId.trim().length === 0) {
      return res.status(400).json({ success: false, message: "Please provide a valid Order ID or Tracking Number." });
    }

    const cleanId = orderId.trim();

    // 🔥 Pro Feature: Dynamically build query conditions for _id, trackingId, or AWB
    const queryConditions = [];
    if (mongoose.Types.ObjectId.isValid(cleanId)) {
      queryConditions.push({ _id: cleanId });
    }
    queryConditions.push({ trackingId: cleanId });
    queryConditions.push({ "shipment.awb": cleanId });

    const order = await Order.findOne({ 
      $or: queryConditions 
    }).populate('items.product').lean();

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found. Please check your Order ID or Tracking Number." });
    }

    // Standardized Tracking Milestones based on order status
    const statusSteps = ['Ordered', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered'];
    let currentStepIndex = statusSteps.indexOf(order.status || 'Ordered');
    if (currentStepIndex === -1) currentStepIndex = 0;

    const timeline = statusSteps.map((step, index) => ({
      title: step,
      completed: index <= currentStepIndex,
      current: index === currentStepIndex,
      date: index <= currentStepIndex ? new Date(order.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Pending'
    }));

    // 🔥 PRIVACY FIX: Masking sensitive personal data (PII) to prevent public leakage
    const sanitizedAddress = order.address ? {
      city: order.address.city || 'N/A',
      state: order.address.state || 'N/A',
      pincode: order.address.pincode ? order.address.pincode.slice(0, 3) + '***' : '******' // Masked pincode
    } : null;

    return res.json({
      success: true,
      orderId: order._id,
      trackingId: order.trackingId || order.shipment?.awb || `JCK-TRK-${order._id.toString().slice(-6).toUpperCase()}`,
      courierPartner: order.shipment?.provider || order.courierPartner || 'Delhivery Express',
      estimatedDelivery: order.estimatedDelivery || '3-5 Business Days',
      status: order.status || 'Ordered',
      timeline,
      shippingAddress: sanitizedAddress // Safe masked address returned publicly
    });
  } catch (error) {
    console.error("Tracking API Error:", error);
    return res.status(500).json({ success: false, message: "Server error tracking order" });
  }
});

module.exports = router;