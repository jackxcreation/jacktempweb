// routes/reviews.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { protect } = require('../middleware/authMiddleware');

// 🔥 FIX: Only require Review directly to prevent 'undefined' crash. 
// Completely removed the unneeded Product import that was causing the crash.
const Review = require('../models/Review');

// 🔥 Safely get Order from your main models index just like you originally had
const { Order } = require('../models');

// ==========================================
// ⭐️ CREATE REVIEW (WITH VERIFIED BUYER BADGE CHECK)
// ==========================================
router.post('/api/reviews', protect, async (req, res) => {
  try {
    const { productId, rating, comment, title, images } = req.body;
    const userId = req.user._id;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: "Valid Product ID is required." });
    }

    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: "Rating must be a number between 1 and 5." });
    }

    if (!comment || typeof comment !== 'string' || comment.trim().length === 0) {
      return res.status(400).json({ success: false, message: "Comment cannot be empty." });
    }

    // Check if the user is a verified buyer of this product
    let hasOrdered = null;
    if (Order) {
      hasOrdered = await Order.findOne({
        userId: userId,
        status: { $in: ['Delivered', 'Paid', 'Processing', 'Shipped'] },
        $or: [{ 'items.productId': productId }, { 'items.product': productId }]
      });
    }

    const isVerifiedPurchase = !!hasOrdered;

    // 🔥 CRITICAL FIX: Wrapped multiple $or conditions inside $and so they don't overwrite each other
    const existingReview = await Review.findOne({ 
      $and: [
        { $or: [{ product: productId }, { productId: productId }] },
        { $or: [{ user: userId }, { userId: userId }] }
      ]
    });

    if (existingReview) {
      existingReview.rating = rating;
      existingReview.comment = comment.trim();
      if (title !== undefined) existingReview.title = title.trim();
      if (images !== undefined) existingReview.images = images;
      existingReview.isVerifiedPurchase = isVerifiedPurchase;
      existingReview.isVerifiedBuyer = isVerifiedPurchase; // Dual property support
      await existingReview.save();
      return res.status(200).json({ success: true, message: "Review updated successfully", review: existingReview });
    }

    const newReview = new Review({
      product: productId,
      productId: productId, // Fallback safely
      user: userId,
      userId: userId, // Fallback safely
      userName: req.user.name || 'Customer',
      rating,
      comment: comment.trim(),
      title: title ? title.trim() : '',
      images: Array.isArray(images) ? images : [],
      isVerifiedPurchase,
      isVerifiedBuyer: isVerifiedPurchase
    });

    await newReview.save();
    return res.status(201).json({ success: true, message: "Review added successfully", review: newReview });
  } catch (error) {
    console.error("Create Review Error:", error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: "You have already reviewed this product." });
    }
    return res.status(500).json({ success: false, message: "Failed to add review" });
  }
});

// ==========================================
// 👍 VOTE REVIEW AS HELPFUL (New Pro Feature)
// ==========================================
router.post('/api/reviews/:id/helpful', protect, async (req, res) => {
  try {
    const reviewId = req.params.id;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({ success: false, message: "Invalid Review ID" });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }

    review.votedUsers = review.votedUsers || [];
    const hasVoted = review.votedUsers.some(id => id.toString() === userId.toString());

    if (hasVoted) {
      review.votedUsers = review.votedUsers.filter(id => id.toString() !== userId.toString());
      review.helpfulVotes = Math.max(0, (review.helpfulVotes || 1) - 1);
      await review.save();
      return res.status(200).json({ success: true, message: "Helpful vote removed", helpfulVotes: review.helpfulVotes });
    } else {
      review.votedUsers.push(userId);
      review.helpfulVotes = (review.helpfulVotes || 0) + 1;
      await review.save();
      return res.status(200).json({ success: true, message: "Marked as helpful", helpfulVotes: review.helpfulVotes });
    }
  } catch (error) {
    console.error("Helpful Vote Error:", error);
    return res.status(500).json({ success: false, message: "Failed to record vote" });
  }
});

// ==========================================
// 📦 GET REVIEWS FOR A PRODUCT (Original Route)
// ==========================================
router.get('/api/reviews/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: "Invalid Product ID format" });
    }

    const reviews = await Review.find({ 
      $or: [{ productId: productId }, { product: productId }] 
    }).sort({ createdAt: -1 }).lean();

    // Calculate average rating
    let averageRating = 0;
    if (reviews.length > 0) {
      const sum = reviews.reduce((acc, rev) => acc + rev.rating, 0);
      averageRating = (sum / reviews.length).toFixed(1);
    }

    return res.status(200).json({
      success: true,
      count: reviews.length,
      averageRating: Number(averageRating),
      reviews: reviews.map(r => ({ ...r, id: r._id.toString() }))
    });
  } catch (error) {
    console.error("Fetch Reviews Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch reviews" });
  }
});

// ==========================================
// 📦 GET REVIEWS FOR A PRODUCT (🔥 FIXED: Added Frontend Compatible Route Alias)
// ==========================================
router.get('/api/products/:productId/reviews', async (req, res) => {
  try {
    const { productId } = req.params;
    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: "Invalid Product ID format" });
    }

    const reviews = await Review.find({ 
      $or: [{ productId: productId }, { product: productId }] 
    }).sort({ createdAt: -1 }).lean();

    // Calculate average rating
    let averageRating = 0;
    if (reviews.length > 0) {
      const sum = reviews.reduce((acc, rev) => acc + rev.rating, 0);
      averageRating = (sum / reviews.length).toFixed(1);
    }

    // Frontend component directly expects an array of reviews
    return res.status(200).json(reviews.map(r => ({ ...r, id: r._id.toString() })));
  } catch (error) {
    console.error("Fetch Product Reviews Alias Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch reviews" });
  }
});

module.exports = router;