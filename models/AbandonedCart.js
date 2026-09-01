const mongoose = require('mongoose');

const abandonedCartSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
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
  
  // 🔥 TOTAL CART VALUE IN PAISE/RUPEES FOR SCORING & METRICS
  totalValue: {
    type: Number,
    default: 0
  },

  // 🔥 INTELLIGENT CART RECOVERY & AI COPILOT FIELDS
  score: { 
    type: Number, 
    default: 0 
  },
  isHighValue: { 
    type: Boolean, 
    default: false 
  },
  isPreviousBuyer: { 
    type: Boolean, 
    default: false 
  },
  recoveryLikelihood: { 
    type: String, 
    enum: ['Low', 'Medium', 'High'], 
    default: 'Medium' 
  },
  recoveryStatus: { 
    type: String, 
    enum: ['Pending', 'Contacted', 'Converted'], 
    default: 'Pending', 
    index: true 
  },
  recoveredRevenue: { 
    type: Number, 
    default: 0 
  },
  campaign: { 
    type: String, 
    default: 'Standard Reminder' 
  },
  aiSuggestion: { 
    type: String, 
    default: '' 
  },

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