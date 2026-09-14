// routes/wishlistRouter.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose'); // 🔥 Added for ObjectId validation
const { User, Product } = require('../models');
const { protect } = require('../middleware/authMiddleware');

// Get User Wishlist Items (Populated with Product details)
router.get('/api/wishlist', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('wishlist').lean();
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const wishlistProducts = (user.wishlist || []).map(p => ({
      ...p,
      id: p._id ? p._id.toString() : p.id
    }));

    return res.json({ success: true, wishlist: wishlistProducts });
  } catch (error) {
    console.error("Fetch Wishlist Error:", error);
    return res.status(500).json({ success: false, message: "Error fetching wishlist" });
  }
});

// Toggle Add / Remove Product from Wishlist
router.post('/api/wishlist/toggle', protect, async (req, res) => {
  try {
    const { productId } = req.body;
    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: "Valid Product ID is required" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    user.wishlist = user.wishlist || [];
    const index = user.wishlist.findIndex(id => id.toString() === productId.toString());

    let isAdded = false;
    if (index > -1) {
      // Remove from wishlist
      user.wishlist.splice(index, 1);
      isAdded = false;
    } else {
      // Add to wishlist
      user.wishlist.push(productId);
      isAdded = true;
    }

    await user.save();
    
    // Return updated populated wishlist array
    const updatedUser = await User.findById(req.user._id).populate('wishlist').lean();
    const wishlistProducts = (updatedUser.wishlist || []).map(p => ({
      ...p,
      id: p._id ? p._id.toString() : p.id
    }));

    return res.json({ 
      success: true, 
      isAdded, 
      message: isAdded ? "Added to wishlist" : "Removed from wishlist",
      wishlist: wishlistProducts 
    });
  } catch (error) {
    console.error("Toggle Wishlist Error:", error);
    return res.status(500).json({ success: false, message: "Error updating wishlist" });
  }
});

module.exports = router;