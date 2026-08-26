const express = require('express');
const router = express.Router();
const { User, Product } = require('../models');
const { protect } = require('../middleware/authMiddleware');

// Get User Wishlist Items (Populated with Product details)
router.get('/api/wishlist', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('wishlist').lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const wishlistProducts = (user.wishlist || []).map(p => ({
      ...p,
      id: p._id.toString()
    }));

    res.json({ success: true, wishlist: wishlistProducts });
  } catch (error) {
    console.error("Fetch Wishlist Error:", error);
    res.status(500).json({ message: "Error fetching wishlist" });
  }
});

// Toggle Add / Remove Product from Wishlist
router.post('/api/wishlist/toggle', protect, async (req, res) => {
  try {
    const { productId } = req.body;
    if (!productId) return res.status(400).json({ message: "Product ID is required" });

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const user = await User.findById(req.user._id);
    const index = user.wishlist.indexOf(productId);

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
      id: p._id.toString()
    }));

    res.json({ 
      success: true, 
      isAdded, 
      message: isAdded ? "Added to wishlist" : "Removed from wishlist",
      wishlist: wishlistProducts 
    });
  } catch (error) {
    console.error("Toggle Wishlist Error:", error);
    res.status(500).json({ message: "Error updating wishlist" });
  }
});

module.exports = router;