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
    required: true
  },
  isNotified: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Prevent duplicate alert subscription for same user & product
stockAlertSchema.index({ user: 1, product: 1 }, { unique: true });

const StockAlert = mongoose.model('StockAlert', stockAlertSchema);
module.exports = StockAlert;