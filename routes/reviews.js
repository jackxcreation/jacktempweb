const express = require('express');
const router = express.Router();
const { Review, Product, Order } = require('../models');
const { protect } = require('../middleware/authMiddleware');

// ==========================================
// ⭐️ CREATE REVIEW (WITH VERIFIED BUYER BADGE CHECK)
// ==========================================
router.post('/api/reviews', protect, async (req, res) => {
  try {
    const { productId, rating, comment } = req.body;
    const userId = req.user._id;

    if (!productId || !rating) {
      return res.status(400).json({ success: false, message: "Product ID and rating are required." });
    }

    // Check if the user is a verified buyer of this product
    const hasOrdered = await Order.findOne({
      userId,
      status: { $in: ['Delivered', 'Paid', 'Processing', 'Shipped'] },
      'items.productId': productId
    });

    const isVerifiedBuyer = !!hasOrdered;

    // Check if user already reviewed this product
    const existingReview = await Review.findOne({ 
      $or: [{ productId: productId }, { product: productId }], 
      userId 
    });

    if (existingReview) {
      existingReview.rating = rating;
      existingReview.comment = comment;
      existingReview.isVerifiedBuyer = isVerifiedBuyer;
      await existingReview.save();
      return res.status(200).json({ success: true, message: "Review updated successfully", review: existingReview });
    }

    const newReview = new Review({
      productId,
      product: productId, // Fallback safely
      userId,
      userName: req.user.name || 'Customer',
      rating,
      comment,
      isVerifiedBuyer
    });

    await newReview.save();
    res.status(201).json({ success: true, message: "Review added successfully", review: newReview });
  } catch (error) {
    console.error("Create Review Error:", error);
    res.status(500).json({ success: false, message: "Failed to add review" });
  }
});

// ==========================================
// 📦 GET REVIEWS FOR A PRODUCT (Original Route)
// ==========================================
router.get('/api/reviews/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const reviews = await Review.find({ 
      $or: [{ productId: productId }, { product: productId }] 
    }).sort({ createdAt: -1 }).lean();
    
    // Calculate average rating
    let averageRating = 0;
    if (reviews.length > 0) {
      const sum = reviews.reduce((acc, rev) => acc + rev.rating, 0);
      averageRating = (sum / reviews.length).toFixed(1);
    }

    res.status(200).json({
      success: true,
      count: reviews.length,
      averageRating: Number(averageRating),
      reviews: reviews.map(r => ({ ...r, id: r._id.toString() }))
    });
  } catch (error) {
    console.error("Fetch Reviews Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch reviews" });
  }
});

// ==========================================
// 📦 GET REVIEWS FOR A PRODUCT (🔥 FIXED: Added Frontend Compatible Route Alias)
// ==========================================
router.get('/api/products/:productId/reviews', async (req, res) => {
  try {
    const { productId } = req.params;
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
    res.status(200).json(reviews.map(r => ({ ...r, id: r._id.toString() })));
  } catch (error) {
    console.error("Fetch Product Reviews Alias Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch reviews" });
  }
});

module.exports = router;