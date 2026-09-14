// models/Question.js
const mongoose = require('mongoose');

// 🔥 FIX: Completely removed the `Product` model require to stop the circular dependency crash.
// Mongoose handles the relation natively through the `ref` property.

const answerSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  userName: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['customer', 'seller', 'support'],
    default: 'customer'
  },
  answer: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  }
}, { timestamps: true });

const questionSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  productId: {
    type: mongoose.Schema.Types.Mixed // Safe fallback for router compatibility
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  userName: {
    type: String,
    required: true
  },
  question: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  answers: [answerSchema]
}, { timestamps: true });

// ==========================================
// 🔥 PRO FEATURE: PERFORMANCE & SEARCH INDEXES
// ==========================================
questionSchema.index({ product: 1, createdAt: -1 });
questionSchema.index({ question: 'text' }); // Search questions easily

// ==========================================
// 🔥 PRO FEATURE: HELPER STATIC METHODS
// ==========================================
questionSchema.statics.findByProductId = function(productId) {
  // 🔥 Updated to safely handle both 'product' and 'productId' database fields
  return this.find({ 
    $or: [{ product: productId }, { productId: productId }] 
  }).sort({ createdAt: -1 });
};

// 🔥 SAFE MODEL COMPILATION PATTERN TO PREVENT OVERWRITE ERROR
const Question = mongoose.models.Question || mongoose.model('Question', questionSchema);

module.exports = Question;