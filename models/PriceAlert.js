// models/PriceAlert.js
const mongoose = require('mongoose');

const priceAlertSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  targetPricePaise: {
    type: Number,
    required: true // User kis price par alert chahta hai
  },
  initialPricePaise: {
    type: Number,
    required: true // Jis waqt alert set kiya tab kya price tha
  },
  isNotified: {
    type: Boolean,
    default: false,
    index: true
  },
  triggeredAt: {
    type: Date
  }
}, { timestamps: true });

// Prevent duplicate alert subscription for same user & product
priceAlertSchema.index({ user: 1, product: 1 }, { unique: true });

// ==========================================
// 🔥 PRO FEATURE: WORKER OPTIMIZATION INDEX
// ==========================================
priceAlertSchema.index({ product: 1, isNotified: 1 });

// ==========================================
// 🔥 PRO FEATURE: HELPER STATIC METHODS
// ==========================================
priceAlertSchema.statics.findPendingAlertsForProduct = function(productId) {
  return this.find({ product: productId, isNotified: false }).populate('user', 'email name');
};

// 🔥 SAFE MODEL COMPILATION PATTERN TO PREVENT OVERWRITE ERROR
const PriceAlert = mongoose.models.PriceAlert || mongoose.model('PriceAlert', priceAlertSchema);

module.exports = PriceAlert;