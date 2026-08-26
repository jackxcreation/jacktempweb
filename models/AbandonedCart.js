const mongoose = require('mongoose');

const abandonedCartSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    quantity: {
      type: Number,
      required: true,
      default: 1
    },
    pricePaise: Number
  }],
  recoveryEmailSent: {
    type: Boolean,
    default: false
  },
  recoveryToken: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 2592000 // Automatically delete after 30 days if not recovered
  }
});

// Index for high-performance querying by worker
abandonedCartSchema.index({ userId: 1, createdAt: -1 });

// 🔥 SAFE MODEL COMPILATION PATTERN TO PREVENT OVERWRITE ERROR
module.exports = mongoose.models.AbandonedCart || mongoose.model('AbandonedCart', abandonedCartSchema);