// models/Review.js
const mongoose = require('mongoose');

// 🔥 FIX: Completely removed `Product` and `Order` requires from the top.
// They are not needed here and were causing the "Cannot find module" / Circular Dependency crash.

const reviewSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: {
    type: String,
    required: true,
    trim: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
    index: true
  },
  title: {
    type: String,
    trim: true,
    maxlength: 100
  },
  comment: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  // 🔥 Mandatory Verified Purchase Flag for Trust & Authenticity
  isVerifiedPurchase: {
    type: Boolean,
    default: false,
    index: true
  },
  // Optional images uploaded by buyer
  images: [{
    type: String
  }],
  // Community engagement metric (Helpful votes)
  helpfulVotes: {
    type: Number,
    default: 0
  },
  // To track users who voted helpful to prevent spam
  votedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true
});

// Compound index to ensure one review per user per product (Prevents review spamming)
reviewSchema.index({ product: 1, user: 1 }, { unique: true });

// Static method to calculate and update average product rating automatically
reviewSchema.statics.calculateAverageRating = async function(productId) {
  try {
    const stats = await this.aggregate([
      { $match: { product: productId } },
      {
        $group: {
          _id: '$product',
          nRating: { $sum: 1 },
          avgRating: { $avg: '$rating' }
        }
      }
    ]);

    // 🔥 Dynamically calling Product model to prevent circular dependency
    const ProductModel = mongoose.model('Product');
    if (stats.length > 0) {
      await ProductModel.findByIdAndUpdate(productId, {
        rating: Math.round(stats[0].avgRating * 10) / 10, // Round to 1 decimal place
        reviews: stats[0].nRating
      });
    } else {
      await ProductModel.findByIdAndUpdate(productId, {
        rating: 4.8, // Fallback default
        reviews: 0
      });
    }
  } catch (err) {
    console.error("Error calculating average product rating:", err);
  }
};

// Trigger rating recalculation after saving a review
reviewSchema.post('save', function() {
  this.constructor.calculateAverageRating(this.product);
});

// Trigger rating recalculation after removing a review
reviewSchema.post('findOneAndDelete', async function(doc) {
  if (doc) {
    await doc.constructor.calculateAverageRating(doc.product);
  }
});

// 🔥 SAFE MODEL COMPILATION PATTERN TO PREVENT OVERWRITE ERROR
const Review = mongoose.models.Review || mongoose.model('Review', reviewSchema);

module.exports = Review;