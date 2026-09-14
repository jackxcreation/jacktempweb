// models/StockAlert.js
const mongoose = require('mongoose');

const stockAlertSchema = new mongoose.Schema({
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
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  isNotified: {
    type: Boolean,
    default: false,
    index: true
  },
  notifiedAt: {
    type: Date
  }
}, { timestamps: true });

// Prevent duplicate alert subscription for same user & product
stockAlertSchema.index({ user: 1, product: 1 }, { unique: true });

// ==========================================
// 🔥 PRO FEATURE: WORKER OPTIMIZATION INDEX
// ==========================================
stockAlertSchema.index({ product: 1, isNotified: 1 });

// ==========================================
// 🔥 PRO FEATURE: HELPER STATIC METHODS
// ==========================================
stockAlertSchema.statics.findPendingAlertsForProduct = function(productId) {
  return this.find({ product: productId, isNotified: false });
};

// 🔥 SAFE MODEL COMPILATION PATTERN TO PREVENT OVERWRITE ERROR
const StockAlert = mongoose.models.StockAlert || mongoose.model('StockAlert', stockAlertSchema);

module.exports = StockAlert;