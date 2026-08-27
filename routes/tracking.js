const express = require('express');
const router = express.Router();
const { Order } = require('../models');

// Track Order by Order ID or Tracking Number
router.get('/api/track/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await Order.findOne({ 
      $or: [{ _id: orderId.match(/^[0-9a-fA-F]{24}$/) ? orderId : null }, { trackingId: orderId }] 
    }).populate('items.product').lean();

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found. Please check your Order ID." });
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

    res.json({
      success: true,
      orderId: order._id,
      trackingId: order.trackingId || `JCK-TRK-${order._id.toString().slice(-6).toUpperCase()}`,
      courierPartner: order.courierPartner || 'Delhivery Express',
      estimatedDelivery: order.estimatedDelivery || '3-5 Business Days',
      status: order.status || 'Ordered',
      timeline,
      shippingAddress: sanitizedAddress // Safe masked address returned publicly
    });
  } catch (error) {
    console.error("Tracking API Error:", error);
    res.status(500).json({ success: false, message: "Server error tracking order" });
  }
});

module.exports = router;