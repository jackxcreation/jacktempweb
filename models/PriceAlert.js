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
    default: false
  }
}, { timestamps: true });

// Prevent duplicate alert subscription for same user & product
priceAlertSchema.index({ user: 1, product: 1 }, { unique: true });

const PriceAlert = mongoose.model('PriceAlert', priceAlertSchema);

module.exports = PriceAlert;